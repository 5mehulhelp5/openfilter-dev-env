import { defineConfig, devices, Project } from '@playwright/test';
import { rtlStore, storefrontThemes, storeStateFile } from './tests/stores';

/**
 * Fixture store: https://app.openfilter.test (override with BASE_URL). The store runs behind Varnish with
 * a self-signed certificate, so HTTPS errors are ignored. CSP violations are collected per test.
 * Storefront projects run once per Hyvä version (tests/stores.ts): desktop, mobile, and the same specs with
 * JavaScript disabled (filters must work by navigation); `desktop-rtl` runs the right-to-left specs; admin specs
 * share one login and run serially.
 */
const storeSetup = { name: 'store-setup', testMatch: /stores\.setup\.ts/ };

function storefront(name: string, store: string, hyva: string, project: Project): Project {
  const storageState = storeStateFile(store);
  return {
    ...project,
    name,
    dependencies: storageState ? [storeSetup.name] : [],
    metadata: { hyva, store },
    use: { ...project.use, ...(storageState ? { storageState } : {}) },
  };
}

// Timing budgets (@perf) need an idle machine: they run in their own projects, one worker (OF_PERF=1 --workers=1).
const perf = !!process.env.OF_PERF;
const themeProjects = storefrontThemes().flatMap(({ key, store, hyva }) => [
  storefront(`desktop-${key}`, store, hyva, {
    testIgnore: /admin\/|nojs\/|screenshots\/|rtl\/|readme\/|\.mobile\.spec\.ts|\.setup\.ts/,
    grepInvert: /@perf/,
    use: { ...devices['Desktop Chrome'] },
  }),
  ...(perf ? [storefront(`perf-${key}`, store, hyva, { grep: /@perf/, testMatch: /m3-ajax\.spec\.ts/, use: { ...devices['Desktop Chrome'] } })] : []),
  storefront(`mobile-${key}`, store, hyva, { testMatch: /\.mobile\.spec\.ts/, use: { ...devices['Pixel 7'] } }),
  storefront(`nojs-${key}`, store, hyva, {
    testMatch: /nojs\/.*\.spec\.ts/,
    use: { ...devices['Desktop Chrome'], javaScriptEnabled: false },
  }),
]);

const rtl = rtlStore();

/** Storefront project names of this run (desktop, perf, mobile, no-JS per Hyvä version, and RTL). */
function storefrontProjectNames(): string[] {
  return [...themeProjects.map((project) => project.name as string), ...(rtl ? ['desktop-rtl'] : [])];
}

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
    storeSetup,
    ...themeProjects,
    ...(rtl ? [storefront('desktop-rtl', rtl, storefrontThemes()[0]?.hyva ?? '1.4', {
      testMatch: /rtl\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    })] : []),
    // README install gate (CI leg "README install", OF_README=1): the quick start on a store set up only with the
    // README's commands.
    ...(process.env.OF_README ? [{ name: 'readme-chromium', testMatch: /readme\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } }] : []),
    // Screenshots for milestone reports (OF_SCREENSHOTS=1, local only).
    ...(process.env.OF_SCREENSHOTS ? [{ name: 'screenshots-chromium', testMatch: /screenshots\/.*\.spec\.ts/, dependencies: ['admin-setup', storeSetup.name], use: { ...devices['Desktop Chrome'], storageState: '.auth/admin.json' } }] : []),
    { name: 'admin-setup', testMatch: /admin\/auth\.setup\.ts/ },
    {
      name: 'admin-chromium',
      testMatch: /admin\/.*\.spec\.ts/,
      // Admin specs change settings the storefront reads (URL names, ranges, the category tree, where filters
      // show). In CI every project runs in one command, so they wait for the storefront projects instead of
      // overlapping them; locally `--project=admin-chromium` stays quick.
      dependencies: ['admin-setup', ...(process.env.CI ? storefrontProjectNames() : [])],
      fullyParallel: false,
      workers: 1,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: '.auth/admin.json' },
    },
  ],
});
