import AxeBuilder from '@axe-core/playwright';
import { test, expect, Page } from '@playwright/test';
import { WCAG } from '../axe';
import { magento, snapshotOpenFilter, sql, uncached } from './admin';

/**
 * M6 S3 quick filter bar: colour marked for it, six values on the default store view. Links above the products,
 * picked value first and marked, AJAX swap keeps the bar, axe clean; off again, no bar. Serial admin project.
 */
const TOPS = '/women/tops-women.html';
const SIZE = 'openfilter/display/quick_bar_size';
let restore: () => void;

function setting(value: string | null): void {
  sql(`DELETE FROM core_config_data WHERE path = '${SIZE}' AND scope = 'stores'
       AND scope_id = (SELECT store_id FROM store WHERE code = 'default')`);
  if (value !== null) {
    sql(`INSERT INTO core_config_data (scope, scope_id, path, value)
         SELECT 'stores', store_id, '${SIZE}', '${value}' FROM store WHERE code = 'default'`);
  }
  magento('cache:clean', 'config', 'openfilter', 'full_page');
}

function swapped(page: Page, action: () => Promise<void>): Promise<void> {
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  return action().then(() => done.then(() => undefined));
}

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  sql(`INSERT INTO openfilter_attribute (attribute_id, display_mode, quick_bar)
       SELECT attribute_id, 'swatch', 1 FROM eav_attribute WHERE entity_type_id = 4 AND attribute_code = 'color'
       ON DUPLICATE KEY UPDATE quick_bar = 1`);
  setting('6');
});

test.afterAll(() => {
  setting(null);
  restore();
  magento('cache:clean', 'openfilter', 'full_page');
});

test('the bar links colours above the products and keeps the pick first after a swap', async ({ page }) => {
  await page.goto(uncached(TOPS));
  const links = page.locator('#of-state nav.of-quick a.of-quick__link');
  await expect(links).toHaveCount(6);
  await expect(links.first()).not.toHaveAttribute('aria-current', 'true');
  const third = (await links.nth(2).innerText()).split('\n')[0].replace(/\d+\s*products?$/, '').trim();

  await swapped(page, () => links.nth(2).click());
  await expect(page).toHaveURL(/[?&]color=/);
  await expect(links.first()).toHaveAttribute('aria-current', 'true');
  await expect(links.first()).toContainText(third);
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);

  const result = await new AxeBuilder({ page }).include('nav.of-quick').withTags(WCAG).analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
});

test('without JavaScript the bar is plain links', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, ignoreHTTPSErrors: true, baseURL: String(test.info().project.use.baseURL) });
  const page = await context.newPage();
  await page.goto(uncached(TOPS));
  await page.locator('nav.of-quick a.of-quick__link').first().click();
  await expect(page).toHaveURL(/[?&]color=/);
  await expect(page.locator('nav.of-quick a.of-quick__link--selected')).toHaveCount(1);
  await context.close();
});

test('0 values: no bar', async ({ page }) => {
  setting('0');
  await page.goto(uncached(TOPS));
  await expect(page.locator('nav.of-quick')).toHaveCount(0);
  setting('6');
});
