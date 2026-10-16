import AxeBuilder from '@axe-core/playwright';
import { test, expect, Page } from '@playwright/test';
import { WCAG } from '../axe';
import { collectCspViolations, openGroup, productTotal } from '../helpers';
import { magento, sql, uncached } from './admin';

/**
 * M6 S5 All Products page: on the default store view at /all-products, every product with the filters; a filter click
 * swaps and stays on the URL key; own title, H1 and canonical; off again, a 404. Serial admin project.
 */
const PATHS = ['openfilter/all_products/enabled', 'openfilter/all_products/title'];

function setting(path: string, value: string | null): void {
  sql(`DELETE FROM core_config_data WHERE path = '${path}' AND scope = 'stores'
       AND scope_id = (SELECT store_id FROM store WHERE code = 'default')`);
  if (value !== null) {
    sql(`INSERT INTO core_config_data (scope, scope_id, path, value)
         SELECT 'stores', store_id, '${path}', '${value}' FROM store WHERE code = 'default'`);
  }
}

function clean(): void {
  magento('cache:clean', 'config', 'full_page');
}

function swapped(page: Page, action: () => Promise<void>): Promise<void> {
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  return action().then(() => done.then(() => undefined));
}

test.beforeAll(() => {
  setting(PATHS[0], '1');
  setting(PATHS[1], 'Shop everything');
  clean();
});

test.afterAll(() => {
  PATHS.forEach((path) => setting(path, null));
  clean();
});

test('every product with the filters; a filter click stays on the URL key', async ({ page }) => {
  const csp = collectCspViolations(page);
  await page.goto(uncached('/all-products'));
  await expect(page.locator('h1')).toHaveText('Shop everything');
  await expect(page).toHaveTitle(/Shop everything/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/all-products$/);
  const all = productTotal(await page.content());
  const tops = productTotal(await (await page.request.get(uncached('/women/tops-women.html'))).text());
  expect(all).toBeGreaterThan(tops);

  const colour = await openGroup(page, 'color');
  await swapped(page, () => colour.locator('a[data-of-link]').first().click());
  await expect(page).toHaveURL(/\/all-products\?color=/);
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);

  const result = await new AxeBuilder({ page }).include('#of-filters').include('#of-state').withTags(WCAG).analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
  expect(csp).toEqual([]);
});

test('switched off, the URL key is a 404', async ({ request }) => {
  setting(PATHS[0], null);
  clean();
  expect((await request.get(uncached('/all-products'))).status()).toBe(404);
  setting(PATHS[0], '1');
  clean();
});
