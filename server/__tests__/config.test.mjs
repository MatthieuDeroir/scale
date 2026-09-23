import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Les garde-fous de configuration ne sont pas du confort : un produit mal
 * configuré doit refuser de démarrer, pas fonctionner à moitié chez le client.
 */

// `@prisma/client` charge lui-même `.env` (dotenv vendored) dès l'import, et
// repeuple TOUT `process.env` — pas seulement DATABASE_URL. Sans ce mock, un
// `.env` réel sur le disque (cas normal dès qu'on a fait tourner `pnpm dev`
// une fois) réinjecte silencieusement un JWT_SECRET que ce fichier vient de
// supprimer en mémoire, et les tests « refuse de démarrer sans secret »
// deviennent des faux négatifs. Ce test ne vérifie que la validation de
// process.env : aucun besoin d'un vrai client Prisma pour ça.
vi.mock('@prisma/client', () => ({ PrismaClient: class {} }));

const ORIGINE = { ...process.env };

async function charger() {
  vi.resetModules();
  return import('../config.mjs');
}

function pieger() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  return vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });
}

describe('configuration du serveur', () => {
  beforeEach(() => {
    process.env = { ...ORIGINE, JWT_SECRET: 'un-secret-de-test-suffisamment-long-pour-passer' };
  });
  afterEach(() => {
    process.env = { ...ORIGINE };
    vi.restoreAllMocks();
  });

  describe('JWT_SECRET', () => {
    it('refuse de démarrer sans secret', async () => {
      delete process.env.JWT_SECRET;
      const exit = pieger();
      await expect(charger()).rejects.toThrow('exit');
      expect(exit).toHaveBeenCalledWith(1);
    });

    it('refuse un secret trop court', async () => {
      process.env.JWT_SECRET = 'trop-court';
      const exit = pieger();
      await expect(charger()).rejects.toThrow('exit');
      expect(exit).toHaveBeenCalledWith(1);
    });

    it('refuse la valeur d’exemple laissée en place', async () => {
      process.env.JWT_SECRET = 'change-me-please-and-make-it-long-enough-ok';
      const exit = pieger();
      await expect(charger()).rejects.toThrow('exit');
    });
  });

  describe('liaison série', () => {
    it('n’impose AUCUN débit par défaut', async () => {
      delete process.env.SERIAL_BAUD_RATE;
      const { serial } = await charger();
      // Un défaut à 38 400 imposerait RSCOM à tout projet Stramatel.
      expect(serial.baudRate).toBeNull();
    });

    it('lit le débit de l’environnement', async () => {
      process.env.SERIAL_BAUD_RATE = '19200';
      const { serial } = await charger();
      expect(serial.baudRate).toBe(19200);
    });

    it('respecte un chemin de port explicite', async () => {
      process.env.SERIAL_PATH = '/dev/ttyUSB3';
      const { serial } = await charger();
      expect(serial.path).toBe('/dev/ttyUSB3');
    });
  });

  describe('CORS', () => {
    it('n’autorise que la même origine en production sans liste', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ORIGINS;
      const { socketConfig } = await charger();
      expect(socketConfig.cors.origin).toBe(false);
    });

    it('découpe la liste d’origines', async () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGINS = 'https://a.fr, https://b.fr';
      const { socketConfig } = await charger();
      expect(socketConfig.cors.origin).toEqual(['https://a.fr', 'https://b.fr']);
    });
  });
});
