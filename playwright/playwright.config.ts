import { defineConfig, devices } from '@playwright/test';

/**
 * Fixture store: https://app.openfilter.test (override with BASE_URL). The store runs behind Varnish with
 * a self-signed certificate, so HTTPS errors are ignored. CSP violations are collected per test.
 * Projects: storefront on desktop and mobile, the same storefront specs with JavaScript disabled (filters must
 * work by navigation), and admin specs (one login, serial).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://app.openfilter.test',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', testIgnore: /admin\/|nojs\/|screenshots\//, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', testMatch: /\.mobile\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    { name: 'nojs-chromium', testMatch: /nojs\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'], javaScriptEnabled: false } },
    // Screenshots for milestone reports (OF_SCREENSHOTS=1, local only).
    ...(process.env.OF_SCREENSHOTS ? [{ name: 'screenshots-chromium', testMatch: /screenshots\/.*\.spec\.ts/, dependencies: ['admin-setup'], use: { ...devices['Desktop Chrome'], storageState: '.auth/admin.json' } }] : []),
    { name: 'admin-setup', testMatch: /admin\/auth\.setup\.ts/ },
    {
      name: 'admin-chromium',
      testMatch: /admin\/.*\.spec\.ts/,
      dependencies: ['admin-setup'],
      fullyParallel: false,
      workers: 1,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: '.auth/admin.json' },
    },
  ],
});
