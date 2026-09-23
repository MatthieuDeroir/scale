import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      // On mesure ce qu'on écrit, pas ce qu'on génère ni ce qui n'a pas de logique.
      include: ['src/**/*.{ts,tsx,mjs}', 'server/**/*.mjs'],
      exclude: [
        'src/.generated/**',
        'server/.generated/**',
        '**/*.d.mts',
        '**/index.ts',
        '**/__tests__/**',
        // Amorçage : ces fichiers n'ont pas de logique propre et ne
        // s'exercent qu'en démarrant réellement le serveur. Ils sont couverts
        // par la suite Playwright, pas par les tests unitaires. Toute logique
        // qu'on serait tenté d'y ajouter doit sortir dans un module testable.
        'server/index.mjs',
        'src/i18n/request.ts',
        'src/app/**/layout.tsx',
        'src/app/**/page.tsx',
        'src/app/**/globals.css',
      ],
      // Plancher : le TDD n'a de sens qu'avec un seuil qui échoue.
      // À relever quand une fonctionnalité est portée, jamais à baisser.
      thresholds: {
        lines: 88,
        statements: 85,
        functions: 82,
        branches: 80,
      },
    },
    projects: [
      {
        // Décodeurs purs : aucune radio, aucun port série, aucun DOM.
        // C'est la suite qui doit rester exécutable en CI sans matériel.
        extends: true,
        test: { name: 'frames', environment: 'node', include: ['src/data-modules/**/__tests__/**/*.frame.test.ts'] },
      },
      {
        // Transports et codec : Node pur, aucun matériel, aucun DOM.
        extends: true,
        test: {
          name: 'transport',
          environment: 'node',
          setupFiles: ['tests/setup-server.mjs'],
          include: ['server/__tests__/**/*.test.mjs'],
        },
      },
      {
        // Intégration : vraie base SQLite jetable, vrais gestionnaires de route,
        // vraies contraintes de schéma. Aucun simulacre de Prisma — une
        // intégration qui simule la base ne prouve pas le schéma.
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          setupFiles: ['tests/setup-server.mjs'],
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/global-setup.ts'],
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['tests/setup-dom.ts'],
          include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
          exclude: ['src/data-modules/**/__tests__/**/*.frame.test.ts'],
        },
      },
    ],
  },
});
