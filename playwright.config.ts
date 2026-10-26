import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build (`vite preview`), on a low-end Android
 * phone profile. The API is faked per test with `page.route` (e2e/fake-api.ts), so CI needs
 * no backend.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  // One at a time in CI: the Slow 3G budget test must not share the CPU with other tests.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // 127.0.0.1, not localhost: on some machines localhost resolves to ::1 and hangs.
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Pixel 5'],
    locale: 'en-US',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'android-chrome', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'pnpm preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    // No API behind the preview proxy: every /v1 call is faked in the test.
    env: { MEZGEB_DEV_API: 'http://127.0.0.1:9' },
  },
});
