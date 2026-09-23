/**
 * Copie le serveur maison à côté du build Next.js standalone.
 * `next build` ne connaît pas server/ : sans cette étape, l'image de
 * production démarre un Next nu, sans Socket.io ni lecteur série.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');

if (!existsSync(join(root, '.next'))) {
  console.error('[build:server] .next introuvable — lancer `pnpm build` d\'abord.');
  process.exit(1);
}

mkdirSync(dist, { recursive: true });
cpSync(join(root, 'server'), join(dist, 'server'), { recursive: true });
cpSync(join(root, 'server', 'index.mjs'), join(dist, 'server.mjs'));

console.log('[build:server] serveur copié dans dist/');
