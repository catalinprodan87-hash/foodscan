// Browser tests (Playwright) against the production build served by `vite preview`.
// Run: npm run test:e2e   (builds first). CI runs `npx playwright test` after its build step.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    locale: 'ro-RO',
    serviceWorkers: 'block', // API mocks must not be bypassed by the service worker
    trace: 'off',
    ...devices['Pixel 7'],
  },
  projects: [{ name: 'mobile-chromium' }],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
