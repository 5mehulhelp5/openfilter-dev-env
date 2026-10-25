import { test, expect, Page } from '@playwright/test';
import { collectCspViolations, openGroup } from '../helpers';
import { magento, sql, uncached } from './admin';

/**
 * M6 S6 path filter URLs on the default store view: clicks swap to path URLs (segments in canonical order), chips and
 * Back work, the no-JavaScript price form lands on a path, old query links redirect (301). Serial admin project.
 */
const TOPS = '/women/tops-women.html';
const PATH = 'openfilter/seo/url_format';

function setting(value: string | null): void {
  sql(`DELETE FROM core_config_data WHERE path = '${PATH}' AND scope = 'stores'
       AND scope_id = (SELECT store_id FROM store WHERE code = 'default')`);
  if (value !== null) {
    sql(`INSERT INTO core_config_data (scope, scope_id, path, value)
         SELECT 'stores', store_id, '${PATH}', '${value}' FROM store WHERE code = 'default'`);
  }
  magento('cache:clean', 'config', 'full_page');
}

function swapped(page: Page, action: () => Promise<void>): Promise<void> {
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  return action().then(() => done.then(() => undefined));
}

test.beforeAll(() => setting('path'));
test.afterAll(() => setting(null));

test('clicks swap to path URLs; chips and Back follow', async ({ page }) => {
  const csp = collectCspViolations(page);
  await page.goto(uncached(TOPS));
  const size = await openGroup(page, 'size');
  await swapped(page, () => size.locator('a[data-of-link]').first().click());
  await expect(page).toHaveURL(/\/women\/tops-women\/size-[^/?]+\.html/);
  const colour = await openGroup(page, 'color');
  await swapped(page, () => colour.locator('a[data-of-link]').first().click());
  await expect(page).toHaveURL(/\/women\/tops-women\/color-[^/?]+\/size-[^/?]+\.html/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/women\/tops-women(?:\/[^/]+)*\.html$/);

  await swapped(page, () => page.locator('#of-state a.of-chip:not([href*="color-"])').click());
  await expect(page).toHaveURL(/\/women\/tops-women\/size-[^/?]+\.html/);
  await swapped(page, () => page.goBack());
  await expect(page).toHaveURL(/\/color-[^/?]+\/size-/);
  expect(csp).toEqual([]);
});

test('an old query link and the no-JavaScript price form land on paths', async ({ browser, request }) => {
  const old = await request.get(uncached(`${TOPS}?color=black`), { maxRedirects: 0 });
  expect(old.status()).toBe(301);
  expect(old.headers().location).toMatch(/\/women\/tops-women\/color-black\.html/);

  const context = await browser.newContext({ javaScriptEnabled: false, ignoreHTTPSErrors: true, baseURL: String(test.info().project.use.baseURL) });
  const page = await context.newPage();
  await page.goto(uncached('/women/tops-women/color-black.html'));
  const price = await openGroup(page, 'price');
  const max = await price.locator('[data-of-number="to"]').getAttribute('max');
  const from = Math.ceil(Number(await price.locator('[data-of-number="from"]').getAttribute('min'))) + 1;
  await price.locator('[data-of-number="from"]').fill(String(from));
  await price.locator('.of-slider__apply').click();
  // Segments follow the filters' order (price first on new installs since 1.2).
  await expect(page).toHaveURL(new RegExp(`/women/tops-women/(color-black/price-${from}-${max}|price-${from}-${max}/color-black)\\.html`));
  await context.close();
});
