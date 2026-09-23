import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Base de test réelle, jetable, créée une fois pour toute la suite.
 *
 * Pas de simulacre de Prisma : une intégration qui ne touche pas la vraie base
 * ne prouve ni le schéma, ni les contraintes, ni les index uniques — c'est-à-dire
 * précisément ce que l'intégration doit couvrir.
 */
let directory: string;

export async function setup() {
  directory = mkdtempSync(join(tmpdir(), 'stramatel-test-'));
  const file = resolve(directory, 'test.db');

  process.env.DATABASE_URL = `file:${file}`;
  process.env.JWT_SECRET ??= 'jeton-de-test-suffisamment-long-pour-passer-la-validation';
  (process.env as Record<string, string>).NODE_ENV = 'test';

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: `file:${file}` },
  });
}

export async function teardown() {
  rmSync(directory, { recursive: true, force: true });
}
