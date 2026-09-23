import { readFileSync } from 'node:fs';
import next from 'eslint-config-next';
import {
  createFolderStructure,
  createIndependentModules,
  projectStructurePlugin,
} from 'eslint-plugin-project-structure';

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

/**
 * La convention n'est pas suggérée, elle est vérifiée.
 * Les deux fichiers JSON restent la source unique : ils sont lus ici,
 * et cités tels quels dans docs/adr/0001-quatre-axes.md.
 */
const config = [
  ...next,
  {
    plugins: { 'project-structure': projectStructurePlugin },
    rules: {
      'project-structure/folder-structure': [
        'error',
        createFolderStructure(json('./project-structure/folder-structure.json')),
      ],
      'project-structure/independent-modules': [
        'error',
        createIndependentModules(json('./project-structure/independent-modules.json')),
      ],
    },
  },
  {
    ignores: [
      '.next/**',
      'dist/**',
      'data/**',
      'prisma/generated/**',
      'server/.generated/**',
      'node_modules/**',
      '**/*.d.mts',
      '**/*.d.ts',
    ],
  },
];

export default config;
