/**
 * Détecte les data-modules présents et génère la liste des modules actifs
 * consommée par server/module-services.mjs.
 *
 * Un module est actif s'il porte un manifest.ts. Aucune liste à tenir à jour
 * à la main : la seule source de vérité est le système de fichiers.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MODULES_DIR = join(process.cwd(), 'src', 'data-modules');
const OUT_DIR = join(process.cwd(), 'server', '.generated');
const OUT_FILE = join(OUT_DIR, 'active-modules.mjs');

const ids = existsSync(MODULES_DIR)
  ? readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => existsSync(join(MODULES_DIR, entry.name, 'manifest.ts')))
      .map((entry) => entry.name)
      .sort()
  : [];

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_FILE,
  `// Généré par \`pnpm build:modules\` — ne pas éditer.\nexport const activeModuleIds = ${JSON.stringify(ids)};\n`
);

console.log(`[build:modules] ${ids.length} module(s) actif(s) : ${ids.join(', ') || 'aucun'}`);
