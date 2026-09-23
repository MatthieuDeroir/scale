/**
 * Transport temps réel — Socket.io, authentifié.
 *
 * ⚠️ Le point de vigilance de ce fichier : **une socket n'hérite pas du
 * middleware HTTP**. Elle s'établit par sa propre poignée de main, et une
 * application dont les routes sont protégées peut avoir un WebSocket
 * complètement ouvert. C'est le constat B3 de l'audit SL MEDIA
 * (« contournement d'authentification Socket.io »), toujours non corrigé.
 *
 * Ici, si la fonctionnalité `auth` est active, la poignée de main vérifie le
 * cookie de session et refuse la connexion sinon.
 */
import { Server } from 'socket.io';
import { socketConfig } from '../../config.mjs';

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([name]) => name)
      .map(([name, ...rest]) => [name, decodeURIComponent(rest.join('='))])
  );
}

/**
 * @param {import('node:http').Server} httpServer
 * @param {Array} services            services de module actifs
 * @param {{authEnabled: boolean, readSession?: Function, cookieName?: string}} auth
 */
export function setupRealtime(httpServer, services, auth = { authEnabled: false }) {
  const io = new Server(httpServer, socketConfig);

  io.use(async (socket, next) => {
    if (!auth.authEnabled) {
      // Produit sans authentification : c'est une décision à documenter dans
      // l'analyse de risques (profil P3), pas un oubli d'implémentation.
      return next();
    }

    const cookies = parseCookies(socket.handshake.headers.cookie);
    const session = await auth.readSession(cookies[auth.cookieName]);

    if (!session) return next(new Error('unauthorized'));

    // Attaché à la socket : un émetteur peut restreindre par rôle sans
    // refaire une requête.
    socket.data.session = session;
    next();
  });

  io.on('connection', (socket) => {
    // L'état courant part à la connexion. Sans cela, un afficheur qui redémarre
    // reste noir jusqu'au prochain événement.
    for (const service of services) {
      const payload = service.getConnectionData?.();
      if (payload) socket.emit(payload.event, payload.data);
    }
  });

  return io;
}

/** Émet vers tous les clients dont la session porte au moins le rôle demandé. */
export function emitToRole(io, role, event, payload, covers) {
  for (const socket of io.sockets.sockets.values()) {
    const session = socket.data?.session;
    if (!session || covers(session.role, role)) socket.emit(event, payload);
  }
}
