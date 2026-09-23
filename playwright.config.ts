import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
