/**
 * Assemble le projet à partir des fonctionnalités et des data-modules actifs.
 *
 * Généralise le mécanisme que SL MEDIA applique déjà à ses data-modules
 * (`scripts/build-modules.ts` : registre + champs de réglages + schéma Prisma
 * composé) et l'étend aux fonctionnalités.
 *
 * Produit, à partir de `capabilities.config.ts` :
 *   src/.generated/capabilities.ts      registre, navigation, chargement paresseux
 *   prisma/schema/base.prisma           socle + fragments des fonctionnalités actives
 *   messages/.generated/<locale>.json   messages du socle + ceux des fonctionnalités
 *   server/.generated/active-modules.mjs  data-modules ayant un service serveur
 *
 * Rien de tout cela n'est commité : ce sont des artefacts de build.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const FEATURES_DIR = join(ROOT, 'src', 'features');
const TRANSPORTS_DIR = join(ROOT, 'server', 'transport');
const MODULES_DIR = join(ROOT, 'src', 'data-modules');
const MESSAGES_DIR = join(ROOT, 'messages');

function readActiveCapabilities(): string[] {
  const source = readFileSync(join(ROOT, 'capabilities.config.ts'), 'utf8');
  const body = source.slice(source.indexOf('activeCapabilities'));
  const list = body.slice(body.indexOf('['), body.indexOf(']') + 1);
  // Les entrées commentées sont ignorées : c'est le mode d'emploi du fichier.
  return [...list.matchAll(/^\s*'([a-z0-9-]+)'/gm)].map((m) => m[1]);
}

function fail(message: string): never {
  console.error(`[build:registry] ${message}`);
  process.exit(1);
}

// --- 1. Fonctionnalités -----------------------------------------------------

const capabilities = readActiveCapabilities();

/**
 * Une fonctionnalité vit soit dans src/features/ (applicative), soit dans
 * server/transport/ (transport). Les deux emplacements suivent l'ADR 0001 :
 * la couche matérielle reste hors de src/.
 */
function locate(id: string): string | null {
  for (const dir of [join(FEATURES_DIR, id), join(TRANSPORTS_DIR, id)]) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

const locations = new Map<string, string>();
for (const id of capabilities) {
  const dir = locate(id);
  if (!dir) {
    fail(
      `fonctionnalité « ${id} » activée mais absente de src/features/ et de server/transport/. ` +
        'Voir docs/CATALOGUE.md'
    );
  }
  locations.set(id, dir);
}

const transports = capabilities.filter((id) => locations.get(id)!.startsWith(TRANSPORTS_DIR));

// Dépendances déclarées : une fonctionnalité activée sans son prérequis
// produirait une erreur à l'exécution, chez le client. On échoue au build.
for (const id of capabilities) {
  const dir = locations.get(id)!;
  const configPath = [join(dir, 'feature.config.ts'), join(dir, 'capability.config.mjs')].find(
    existsSync
  );
  if (!configPath) continue;
  const requires = [
    ...readFileSync(configPath, 'utf8').matchAll(/requires:\s*\[([^\]]*)\]/g),
  ].flatMap((m) => [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map((r) => r[1]));

  for (const dependency of requires) {
    if (!capabilities.includes(dependency)) {
      fail(`« ${id} » requiert « ${dependency} », non activé dans capabilities.config.ts`);
    }
  }
}

const generatedDir = join(ROOT, 'src', '.generated');
mkdirSync(generatedDir, { recursive: true });
writeFileSync(join(generatedDir, '.gitignore'), '*\n!.gitignore\n');
writeFileSync(
  join(generatedDir, 'capabilities.ts'),
  `// Généré par \`pnpm build:registry\` — ne pas éditer.\n` +
    `export const activeCapabilityIds = ${JSON.stringify(capabilities)} as const;\n` +
    `export type ActiveCapabilityId = (typeof activeCapabilityIds)[number];\n` +
    `export function hasCapability(id: string): boolean {\n` +
    `  return (activeCapabilityIds as readonly string[]).includes(id);\n}\n`
);

// --- 2. Schéma Prisma composé ----------------------------------------------

// Un seul fichier généré plutôt qu'un dossier multi-schémas : pas de
// fonctionnalité Prisma en avant-première à activer, et le fichier reste
// lisible quand on cherche pourquoi une table existe.
const fragments = [readFileSync(join(ROOT, 'prisma', 'base-template.prisma'), 'utf8').trimEnd()];
for (const id of capabilities) {
  const fragment = join(locations.get(id)!, 'prisma', 'schema.prisma');
  if (existsSync(fragment)) {
    fragments.push(`// ─── ${id} ───`, readFileSync(fragment, 'utf8').trimEnd());
  }
}
writeFileSync(
  join(ROOT, 'prisma', 'schema.prisma'),
  `// Généré par \`pnpm build:registry\` — ne pas éditer, éditer base-template.prisma\n` +
    `// ou src/features/<id>/prisma/schema.prisma.\n\n${fragments.join('\n\n')}\n`
);

// --- 3. Messages fusionnés --------------------------------------------------

const generatedMessages = join(MESSAGES_DIR, '.generated');
mkdirSync(generatedMessages, { recursive: true });
writeFileSync(join(generatedMessages, '.gitignore'), '*\n!.gitignore\n');

const locales = readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''));

/**
 * Fusion récursive plutôt qu'`Object.assign` : deux fonctionnalités qui
 * définissent chacune une entrée sous une même clé de premier niveau (ex.
 * `nav`, chacune y ajoutant son propre lien) doivent s'additionner, pas
 * s'écraser l'une l'autre selon l'ordre de `capabilities.config.ts`.
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}

for (const locale of locales) {
  const merged = JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8'));
  for (const id of capabilities) {
    const file = join(locations.get(id)!, 'messages', `${locale}.json`);
    if (existsSync(file)) deepMerge(merged, JSON.parse(readFileSync(file, 'utf8')));
  }
  writeFileSync(join(generatedMessages, `${locale}.json`), JSON.stringify(merged, null, 2) + '\n');
}

// --- 4. Data-modules --------------------------------------------------------

const moduleIds = existsSync(MODULES_DIR)
  ? readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(MODULES_DIR, e.name, 'manifest.ts')))
      .map((e) => e.name)
      .sort()
  : [];

// Un data-module qui déclare un transport exige qu'il soit activé. Sans ce
// contrôle, l'erreur n'apparaîtrait qu'au démarrage, sur l'équipement.
for (const id of moduleIds) {
  const protocolFile = join(MODULES_DIR, id, 'lib', 'protocol.mjs');
  if (!existsSync(protocolFile)) continue;
  const declared = /export const transport\s*=\s*'([a-z-]+)'/.exec(
    readFileSync(protocolFile, 'utf8')
  );
  if (declared && !capabilities.includes(declared[1])) {
    fail(
      `le data-module « ${id} » requiert « ${declared[1]} », non activé dans capabilities.config.ts`
    );
  }
}

const serverGenerated = resolve(ROOT, 'server', '.generated');
mkdirSync(serverGenerated, { recursive: true });
writeFileSync(
  join(serverGenerated, 'active-modules.mjs'),
  `// Généré par \`pnpm build:registry\` — ne pas éditer.\n` +
    `export const activeModuleIds = ${JSON.stringify(moduleIds)};\n` +
    `export const activeTransportIds = ${JSON.stringify(transports)};\n` +
    `export function hasTransport(id) { return activeTransportIds.includes(id); }\n`
);

const applicative = capabilities.filter((id) => !transports.includes(id));
console.log(
  `[build:registry] ${applicative.length} fonctionnalité(s) : ${applicative.join(', ') || 'aucune'}`
);
console.log(
  `[build:registry] ${transports.length} transport(s) : ${transports.join(', ') || 'aucun'}`
);
console.log(
  `[build:registry] ${moduleIds.length} data-module(s) : ${moduleIds.join(', ') || 'aucun'}`
);
console.log(`[build:registry] ${locales.length} langue(s) fusionnée(s) : ${locales.join(', ')}`);
