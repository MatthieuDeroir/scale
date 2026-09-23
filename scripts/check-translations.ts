/**
 * Compare les jeux de clés entre langues. Une clé présente en français et
 * absente en anglais produit une chaîne brute à l'écran chez le client —
 * un défaut qu'on ne voit jamais en développement.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'messages', '.generated');
const REFERENCE = 'fr.json';

function flatten(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key)
  );
}

const load = (file: string) => new Set(flatten(JSON.parse(readFileSync(join(DIR, file), 'utf8'))));

const reference = load(REFERENCE);
let failed = false;

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== REFERENCE)) {
  const keys = load(file);
  const missing = [...reference].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference.has(k));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n[i18n] ${file}`);
    missing.forEach((k) => console.error(`  manquante : ${k}`));
    extra.forEach((k) => console.error(`  en trop    : ${k}`));
  }
}

if (failed) process.exit(1);
console.log(`[i18n] toutes les langues alignées sur ${REFERENCE} (${reference.size} clés)`);
