import { Browser, BrowserContextOptions, devices, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { storeStateFile } from '../stores';

/**
 * Screenshots for the M3 milestone report, written to docs/m3-screenshots. Not a test gate: runs only with
 * OF_SCREENSHOTS=1 (project "screenshots-chromium", after store-setup for the Hyvä 1.5.2 and RTL store views).
 */
const OUT = resolve(__dirname, '../../../docs/m3-screenshots');
const CATEGORY = '/women/tops-women.html';
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

async function shot(browser: Browser, name: string, path: string, options: BrowserContextOptions, act?: (page: import('@playwright/test').Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, ...options });
  const page = await context.newPage();
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  if (act) {
    await act(page);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(OUT, name), fullPage: false });
  await context.close();
}

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1000 } };
const openAll = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => document.querySelectorAll('#of-filters details.of-group').forEach((d) => { (d as HTMLDetailsElement).open = true; }));
};

test('01 Hyvä 1.4.2 filtered category', async ({ browser }) => {
  await shot(browser, '01-hyva14-filtered.png', `${CATEGORY}?color=blue&price=30-60`, desktop);
});

test('02 Hyvä 1.5.2 filtered category', async ({ browser }) => {
  await shot(browser, '02-hyva15-filtered.png', `${CATEGORY}?color=blue&price=30-60`, { ...desktop, storageState: storeStateFile('hyva15') });
});

test('03 option templates (swatches, slider, rating, switches)', async ({ browser }) => {
  await shot(browser, '03-option-templates.png', `${CATEGORY}?color=blue`, { ...desktop, viewport: { width: 1280, height: 2400 } }, openAll);
});

test('04 mobile drawer with Show N products', async ({ browser }) => {
  await shot(browser, '04-mobile-drawer.png', `${CATEGORY}?color=blue`, devices['Pixel 7'], async (page) => {
    await page.locator('[data-of-drawer-open]').click();
  });
});

test('05 right to left store view', async ({ browser }) => {
  await shot(browser, '05-rtl.png', `${CATEGORY}?color=blue&price=30-60`, { ...desktop, storageState: storeStateFile('ar') });
});

test('06 search results with filters', async ({ browser }) => {
  await shot(browser, '06-search.png', '/catalogsearch/result/?q=jacket', desktop);
});
