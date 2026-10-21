import { defineConfig, devices } from '@playwright/test';

/**
 * The renderer exposes `globalThis.__cubeView` in development mode, so the
 * tests run against `ng serve` rather than the production bundle.  That lets a
 * test inspect every cubie's outward-facing material instead of relying on
 * fragile pixel comparisons.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 5 * 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4300',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: 'npm start -- --port 4300 --host 127.0.0.1',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
