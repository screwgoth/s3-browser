import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for S3 Browser e2e tests.
 *
 * - Uses the already-installed Chromium (no Google Chrome channel required).
 * - Reuses a dev server on :5000 if one is already running, otherwise starts one.
 * - Serial (1 worker) because the specs share database state.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: undefined },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
