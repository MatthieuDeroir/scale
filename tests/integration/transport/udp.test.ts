import dgram from 'node:dgram';
import { afterEach, describe, expect, it } from 'vitest';
import { sendUdp, stopAllUdp, subscribeUdp } from '../../../server/transport/transport-udp/udp.mjs';

const PORT = 19771;
const CB = { startByte: 0xcb, endByte: 0xcd, frameSize: 6 };
const CC = { startByte: 0xcc, endByte: 0xcd, frameSize: 6 };

const attendre = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function emetteur() {
  const socket = dgram.createSocket('udp4');
  return {
    envoyer: (bytes: number[]) =>
      new Promise<void>((r) => socket.send(Buffer.from(bytes), PORT, '127.0.0.1', () => r())),
    fermer: () => socket.close(),
  };
}

describe('transport UDP', () => {
  afterEach(() => stopAllUdp());

  it('exige un protocole : il ne le suppose jamais', () => {
    // Un défaut ici imposerait le protocole d'un produit à tous les autres.
    expect(() => subscribeUdp(PORT, undefined as never, () => {})).toThrow(/protocol/);
    expect(() => subscribeUdp(PORT, { startByte: 0xcb } as never, () => {})).toThrow(/protocol/);
  });

  it('redistribue à deux abonnés selon l’octet de tête, sur un seul port', async () => {
    const recu = { cb: [] as number[][], cc: [] as number[][] };
    subscribeUdp(PORT, CB, (f) => recu.cb.push([...f]));
    subscribeUdp(PORT, CC, (f) => recu.cc.push([...f]));
    await attendre();

    const e = emetteur();
    await e.envoyer([0xcb, 192, 168, 1, 86, 0xcd]);
    await e.envoyer([0xcc, 1, 2, 3, 4, 0xcd]);
    await attendre();
    e.fermer();

    expect(recu.cb).toHaveLength(1);
    expect(recu.cc).toHaveLength(1);
    expect(recu.cb[0].slice(1, 5)).toEqual([192, 168, 1, 86]);
  });

  it('ne livre ni terminateur faux, ni taille fausse, ni type inconnu', async () => {
    const recu: number[][] = [];
    subscribeUdp(PORT, CB, (f) => recu.push([...f]));
    await attendre();

    const e = emetteur();
    await e.envoyer([0xcb, 1, 2, 3, 4, 0x00]); // terminateur faux
    await e.envoyer([0xcb, 1, 2]); //             taille fausse
    await e.envoyer([0xff, 1, 2, 3, 4, 0xcd]); // type inconnu
    await attendre();
    e.fermer();

    expect(recu).toHaveLength(0);
  });

  it('émet vers un autre port depuis la socket qui écoute, sans second bind', async () => {
    subscribeUdp(PORT, CB, () => {});
    await attendre();

    const destinataire = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    await new Promise<void>((r) => destinataire.bind(19772, () => r()));
    const recu = new Promise<number[]>((r) => destinataire.once('message', (m) => r([...m])));

    // Aucun second bind : c'est le défaut du couple listener/broadcaster de
    // ServeurTemps, qui lie deux sockets sur le même port.
    await sendUdp(Buffer.from([0xcb, 9, 9, 9, 9, 0xcd]), {
      fromPort: PORT,
      toPort: 19772,
      address: '127.0.0.1',
    });

    await expect(recu).resolves.toEqual([0xcb, 9, 9, 9, 9, 0xcd]);
    destinataire.close();
  });

  it('refuse une émission sans port ni adresse', async () => {
    await expect(sendUdp(Buffer.from([0]), {} as never)).rejects.toThrow(/fromPort/);
  });

  it('un abonné qui lève une erreur n’empêche pas les autres de recevoir', async () => {
    const sains: number[][] = [];
    subscribeUdp(PORT, CB, () => {
      throw new Error('handler fautif');
    });
    subscribeUdp(PORT, CB, (f) => sains.push([...f]));
    await attendre();

    const e = emetteur();
    await e.envoyer([0xcb, 1, 2, 3, 4, 0xcd]);
    await attendre();
    e.fermer();

    expect(sains).toHaveLength(1);
  });

  it('ferme la socket au départ du dernier abonné', async () => {
    const stop1 = subscribeUdp(PORT, CB, () => {});
    const stop2 = subscribeUdp(PORT, CC, () => {});
    await attendre();
    stop1();
    stop2();
    await attendre();

    // Le port doit être libre : sans fermeture, ce bind lèverait EADDRINUSE.
    const sonde = dgram.createSocket('udp4');
    await expect(
      new Promise<void>((resolve, reject) => {
        sonde.once('error', reject);
        sonde.bind(PORT, () => resolve());
      })
    ).resolves.toBeUndefined();
    sonde.close();
  });
});
