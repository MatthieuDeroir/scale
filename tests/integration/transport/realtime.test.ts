import { createServer, type Server as HttpServer } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupRealtime } from '../../../server/transport/transport-websocket/realtime.mjs';
import { createSession, readSession, sessionCookie } from '@/features/auth';

const PORT = 19781;
let http: HttpServer;
let io: { close: () => void };

function demarrer(services: unknown[] = [], authEnabled = true) {
  http = createServer();
  io = setupRealtime(http, services, {
    authEnabled,
    readSession,
    cookieName: sessionCookie.name,
  });
  return new Promise<void>((r) => http.listen(PORT, () => r()));
}

/** @returns 'connecté' ou le motif du refus */
function tenter(cookie?: string): Promise<string> {
  return new Promise((resolve) => {
    const socket: Socket = connect(`http://127.0.0.1:${PORT}`, {
      transports: ['websocket'],
      extraHeaders: cookie ? { Cookie: cookie } : {},
      reconnection: false,
      timeout: 4000,
    });
    const fin = (r: string) => {
      socket.close();
      resolve(r);
    };
    socket.on('connect', () => fin('connecté'));
    socket.on('connect_error', (e) => fin(e.message));
    setTimeout(() => fin('timeout'), 5000);
  });
}

async function cookieValide() {
  const token = await createSession({ userId: 1, username: 'op', role: 'OPERATOR' });
  return `${sessionCookie.name}=${token}`;
}

describe('transport WebSocket', () => {
  afterEach(async () => {
    io?.close();
    await new Promise<void>((r) => http.close(() => r()));
  });

  describe('authentification active', () => {
    beforeEach(() => demarrer());

    it('refuse une connexion sans cookie', async () => {
      // Une socket n'hérite pas du middleware HTTP : c'est le constat B3.
      expect(await tenter()).toBe('unauthorized');
    });

    it('refuse un cookie de session illisible', async () => {
      expect(await tenter(`${sessionCookie.name}=nimportequoi`)).toBe('unauthorized');
    });

    it('refuse un cookie portant un autre nom', async () => {
      expect(await tenter('autre_cookie=peu-importe')).toBe('unauthorized');
    });

    it('accepte une session valide', async () => {
      expect(await tenter(await cookieValide())).toBe('connecté');
    });
  });

  describe('authentification inactive', () => {
    beforeEach(() => demarrer([], false));

    it('accepte tout — décision à documenter dans l’analyse de risques', async () => {
      expect(await tenter()).toBe('connecté');
    });
  });

  describe('état à la connexion', () => {
    const service = {
      name: 'exemple',
      getConnectionData: () => ({ event: 'exemple:state', data: { valeur: 42 } }),
    };

    beforeEach(() => demarrer([service], false));

    it('pousse l’état courant au client qui arrive', async () => {
      // Sans cela, un afficheur qui redémarre reste noir jusqu'au prochain
      // événement — ce qui, en plein match, se voit.
      const recu = await new Promise<unknown>((resolve) => {
        const socket = connect(`http://127.0.0.1:${PORT}`, {
          transports: ['websocket'],
          reconnection: false,
        });
        socket.on('exemple:state', (data: unknown) => {
          socket.close();
          resolve(data);
        });
      });

      expect(recu).toEqual({ valeur: 42 });
    });
  });
});
