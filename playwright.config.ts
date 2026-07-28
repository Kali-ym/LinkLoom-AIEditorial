import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm run prod',
        url: 'http://127.0.0.1:3000/api/health',
        reuseExistingServer: true,
        timeout: 120_000
      }
});
