/**
 * Point d'entrée du serveur : Next.js + Socket.io + services de modules.
 *
 * Next.js seul ne suffit pas pour un produit Stramatel : il faut un processus
 * long qui tient un port série ouvert et pousse l'état en temps réel. D'où ce
 * serveur Node maison, qui délègue le HTTP à Next et garde le reste.
 */
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import next from 'next';

import { dev, hostname, port, prisma } from './config.mjs';
import { getActiveServices } from './module-services.mjs';
import { activeTransportIds, hasTransport } from './.generated/active-modules.mjs';
import { setSocketInstance } from './socket-instance.mjs';
import { stopReboot } from './services/scheduled-reboot.service.mjs';

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

let moduleServices = [];

/**
 * Une socket n'hérite pas du middleware HTTP : sa poignée de main doit vérifier
 * la session elle-même. Le chargement est dynamique pour que le socle
 * fonctionne sans la fonctionnalité `auth`.
 */
async function realtimeAuth() {
  const { activeCapabilityIds } = await import('../src/.generated/capabilities.ts').catch(() => ({
    activeCapabilityIds: [],
  }));

  if (!activeCapabilityIds.includes('auth')) {
    console.warn('[Startup] auth inactif : le WebSocket accepte toute connexion.');
    return { authEnabled: false };
  }

  const { readSession, sessionCookie } = await import('../src/features/auth/lib/session.mjs');
  return { authEnabled: true, readSession, cookieName: sessionCookie.name };
}

function logReady() {
  const urls = [`http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`];
  if (hostname === '0.0.0.0') {
    for (const addrs of Object.values(networkInterfaces())) {
      for (const a of addrs || []) {
        if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${port}`);
      }
    }
  }
  console.log(`[Startup] Serveur ${dev ? 'DEV' : 'PROD'} sur le port ${port}`);
  [...new Set(urls)].forEach((u, i) => console.log(`[Startup] ${i === 0 ? 'Local' : 'Réseau'}: ${u}`));
}

async function start() {
  await app.prepare();

  const httpServer = createServer(handler);

  moduleServices = await getActiveServices();

  // Chaque transport est une fonctionnalité : on n'importe que les actifs, pour
  // qu'un produit qui n'en utilise aucun n'en charge pas le code ni les
  // dépendances. Voir capabilities.config.ts.
  let io = null;
  if (hasTransport('transport-websocket')) {
    const { setupRealtime } = await import('./transport/transport-websocket/realtime.mjs');
    io = setupRealtime(httpServer, moduleServices, await realtimeAuth());
    setSocketInstance(io);
  } else {
    console.warn('[Startup] transport-websocket inactif : aucun temps réel.');
  }

  for (const service of moduleServices) {
    try {
      await service.initialize?.(io, prisma);
      console.log(`[Startup] Service de module démarré : ${service.name}`);
    } catch (error) {
      // Un module qui échoue ne doit pas empêcher le produit de démarrer.
      console.error(`[Startup] Service ${service.name} en échec :`, error.message);
    }
  }

  setupGracefulShutdown();

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, logReady);
}

function setupGracefulShutdown() {
  let shuttingDown = false;
  const handle = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Shutdown] ${signal} reçu`);

    for (const service of moduleServices) {
      try {
        service.stop?.();
      } catch (error) {
        console.error(`[Shutdown] ${service.name} :`, error.message);
      }
    }
    for (const id of activeTransportIds) {
      const stop = {
        'transport-serial': () => import('./transport/transport-serial/serial.mjs').then((m) => m.stopAllSerial()),
        'transport-udp': () => import('./transport/transport-udp/udp.mjs').then((m) => m.stopAllUdp()),
      }[id];
      await stop?.();
    }
    stopReboot();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => handle('SIGTERM'));
  process.on('SIGINT', () => handle('SIGINT'));
}

start();
