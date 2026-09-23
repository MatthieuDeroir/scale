/**
 * Configuration du serveur.
 * Tout ce qui est vérifié ici l'est AU DÉMARRAGE : un produit mal configuré
 * doit refuser de démarrer, pas fonctionner à moitié chez le client.
 */
import { PrismaClient } from '@prisma/client';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('FATAL: JWT_SECRET absent. Générer : pnpm secret:generate');
  process.exit(1);
}
if (jwtSecret.length < 32) {
  console.error(`FATAL: JWT_SECRET trop court (${jwtSecret.length} caractères, minimum 32).`);
  process.exit(1);
}
if (/^(change-?me|your-secret|placeholder)/i.test(jwtSecret)) {
  console.error('FATAL: JWT_SECRET est encore la valeur d\'exemple.');
  process.exit(1);
}

export const dev = process.env.NODE_ENV !== 'production';
export const port = Number.parseInt(process.env.PORT || '3000', 10);
export const hostname = process.env.BIND_ADDRESS || '0.0.0.0';

export const prisma = new PrismaClient();

/**
 * Liaison série — axe optionnel, actif seulement si un module l'utilise.
 *
 * Le port dépend de la plateforme et ne se devine pas :
 *   Raspberry Pi  → UART intégré, /dev/ttyAMA0
 *   NUC / x86     → adaptateur USB, /dev/ttyUSB0
 * Une valeur unique en dur interdit au même binaire de servir les deux.
 *
 * Le débit n'a **pas de valeur par défaut** : il appartient au protocole du
 * produit, pas au socle. Un socle qui impose 38 400 impose RSCOM à tout le
 * monde, y compris aux produits qui ne parlent pas au pupitre.
 */
export const serial = {
  path:
    process.env.SERIAL_PATH ||
    (process.platform === 'linux' && process.arch === 'arm64'
      ? '/dev/ttyAMA0'
      : '/dev/ttyUSB0'),
  baudRate: process.env.SERIAL_BAUD_RATE ? Number.parseInt(process.env.SERIAL_BAUD_RATE, 10) : null,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
};

function corsOrigins() {
  if (dev) return '*';
  const configured = process.env.CORS_ORIGINS;
  if (configured) return configured.split(',').map((o) => o.trim());
  return false; // même origine uniquement
}

export const socketConfig = {
  cors: { origin: corsOrigins(), methods: ['GET', 'POST'] },
  perMessageDeflate: { threshold: 1024 },
};
