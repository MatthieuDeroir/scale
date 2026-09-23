/**
 * Transport UDP — un port, une socket, écoute ET émission.
 *
 * Corrige deux défauts opposés relevés dans la gamme :
 *
 * - SL MEDIA possède bien un listener partagé (plusieurs modules sur le port
 *   9761, dispatch par octet de tête) mais ne sait qu'écouter.
 * - ServeurTemps sait émettre, mais ouvre **deux sockets sur le même port** —
 *   un `UdpListener` et un `UdpBroadcaster`. En unicast, un datagramme n'est
 *   remis qu'à une seule socket : l'autre devient sourde.
 *
 * Ici le port appartient à une socket unique qui redistribue aux abonnés et
 * sert aussi à l'émission.
 */
import dgram from 'node:dgram';
import { createOnceLogger, validateFrame } from '../frame-codec.mjs';

/** port -> { socket, bound, subscribers:Set, logOnce, broadcastEnabled } */
const ports = new Map();

function ensurePort(port, { broadcast = false } = {}) {
  const existing = ports.get(port);
  if (existing) {
    if (broadcast && !existing.broadcastEnabled && existing.bound) {
      existing.socket.setBroadcast(true);
      existing.broadcastEnabled = true;
    }
    return existing;
  }

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  const entry = {
    socket,
    bound: false,
    subscribers: new Set(),
    logOnce: createOnceLogger(`[UDP:${port}]`),
    broadcastEnabled: false,
    wantBroadcast: broadcast,
  };
  ports.set(port, entry);

  socket.on('message', (message, remote) => {
    for (const sub of entry.subscribers) {
      if (message.length === 0 || message[0] !== sub.protocol.startByte) continue;

      // Un datagramme est déjà délimité : pas de réassemblage, mais la trame
      // est validée comme sur la liaison série — taille et terminateur.
      const reason = validateFrame(message, sub.protocol);
      if (reason) {
        entry.logOnce(`trame 0x${message[0].toString(16)} rejetée (${reason})`, 'warn');
        continue;
      }

      try {
        sub.handler(message, remote);
      } catch (error) {
        entry.logOnce(`handler 0x${sub.protocol.startByte.toString(16)} : ${error.message}`);
      }
    }
  });

  socket.on('error', (error) => {
    entry.logOnce(error.message);
    for (const sub of entry.subscribers) sub.onError?.(error);
    socket.close();
    ports.delete(port);
  });

  socket.bind(port, () => {
    entry.bound = true;
    if (entry.wantBroadcast) {
      socket.setBroadcast(true);
      entry.broadcastEnabled = true;
    }
    const address = socket.address();
    for (const sub of entry.subscribers) sub.onBound?.(address);
    console.log(`[UDP:${port}] à l'écoute sur ${address.address}:${address.port}`);
  });

  return entry;
}

/**
 * Abonne un handler aux datagrammes commençant par `protocol.startByte`.
 *
 * @param {number} port
 * @param {import('./frame-codec.mjs').FrameProtocol} protocol  déclaré par le module
 * @param {(frame: Buffer, remote: {address:string, port:number}) => void} handler
 * @param {{broadcast?: boolean, onBound?: Function, onError?: Function}} [options]
 * @returns {() => void} désabonnement ; la socket se ferme avec le dernier abonné
 */
export function subscribeUdp(port, protocol, handler, options = {}) {
  if (!protocol?.frameSize || protocol.startByte === undefined) {
    throw new Error(
      'subscribeUdp : protocol { startByte, frameSize, endByte? } est obligatoire. ' +
        'Il se déclare dans le manifeste du data-module, pas dans le socle.'
    );
  }

  const entry = ensurePort(port, options);
  const subscriber = { protocol, handler, onBound: options.onBound, onError: options.onError };
  entry.subscribers.add(subscriber);
  if (entry.bound) subscriber.onBound?.(entry.socket.address());

  return function unsubscribe() {
    entry.subscribers.delete(subscriber);
    if (entry.subscribers.size === 0 && ports.get(port) === entry) {
      entry.socket.close(() => {});
      ports.delete(port);
    }
  };
}

/**
 * Émet un datagramme **depuis la socket qui possède déjà `fromPort`**.
 *
 * Le port de destination est distinct du port d'écoute : les horloges
 * ServeurTemps écoutent sur le même port que la diffusion, mais rien ne
 * l'impose, et confondre les deux rend l'émission intestable.
 *
 * @param {Uint8Array|Buffer} payload
 * @param {{fromPort:number, toPort?:number, address:string, broadcast?:boolean}} options
 */
export async function sendUdp(payload, { fromPort, toPort, address, broadcast = false }) {
  if (!fromPort || !address) {
    throw new Error('sendUdp : { fromPort, address } sont obligatoires.');
  }

  const entry = ensurePort(fromPort, { broadcast });

  if (!entry.bound) {
    await new Promise((resolve) => {
      const check = () => (entry.bound ? resolve() : setTimeout(check, 20));
      check();
    });
  }

  return new Promise((resolve, reject) => {
    entry.socket.send(payload, toPort ?? fromPort, address, (error) =>
      error ? reject(error) : resolve()
    );
  });
}

export function stopAllUdp() {
  for (const entry of ports.values()) entry.socket.close(() => {});
  ports.clear();
}
