import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e-standalone',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:43777',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'standalone-linux-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: './release/certified-handmade-linux-amd64 --no-browser',
    url: 'http://127.0.0.1:43777/__chm_health',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
