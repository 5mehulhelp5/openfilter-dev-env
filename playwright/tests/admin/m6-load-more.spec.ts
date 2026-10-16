import AxeBuilder from '@axe-core/playwright';
import { test, expect, Page } from '@playwright/test';
import { WCAG } from '../axe';
import { collectCspViolations, productTotal } from '../helpers';
import { magento, sql, uncached } from './admin';

/**
 * M6 S4 "More products": a "Load more" button appends the next page's products and takes over its pager; "As shoppers
 * scroll" loads two pages on its own, then leaves the button; Back to the page loads the same pages again; without
 * JavaScript the pager stays. Serial admin project (store view settings), restored afterwards.
 */
const TOPS = '/women/tops-women.html';
const PATH = 'openfilter/display/pagination';
const ITEMS = '#of-results .products.wrapper > ul > li';

function setting(value: string | null): void {
  sql(`DELETE FROM core_config_data WHERE path = '${PATH}' AND scope = 'stores'
       AND scope_id = (SELECT store_id FROM store WHERE code = 'default')`);
  if (value !== null) {
    sql(`INSERT INTO core_config_data (scope, scope_id, path, value)
         SELECT 'stores', store_id, '${PATH}', '${value}' FROM store WHERE code = 'default'`);
  }
  magento('cache:clean', 'config', 'full_page');
}

async function count(page: Page): Promise<number> {
  return page.locator(ITEMS).count();
}

test.afterAll(() => setting(null));

test.describe('load more', () => {
  test.beforeAll(() => setting('load_more'));

  test('the button appends the next page and moves the pager on', async ({ page }) => {
    const csp = collectCspViolations(page);
    await page.goto(uncached(TOPS));
    const first = await count(page);
    expect(first).toBeGreaterThan(0);
    const button = page.locator('button.of-more-products');
    await expect(button).toHaveText('Load more products');
    const url = page.url();

    await button.click();
    await expect.poll(() => count(page)).toBeGreaterThan(first);
    expect(page.url(), 'the address stays').toBe(url);
    await expect(page.locator('[data-of-live]')).toContainText('more products');
    await expect(page.locator(ITEMS).nth(first).locator('a[href]').first()).toBeFocused();
    await expect(page.locator('#of-results a.pages-item-next').first()).toHaveAttribute('href', /[?&]p=3/);

    const result = await new AxeBuilder({ page }).include('button.of-more-products').withTags(WCAG).analyze();
    expect(result.violations.map((v) => v.id)).toEqual([]);
    expect(csp).toEqual([]);
  });

  test('Back from a product shows the same products again', async ({ page }) => {
    await page.goto(uncached(TOPS));
    const first = await count(page);
    await page.locator('button.of-more-products').click();
    await expect.poll(() => count(page)).toBeGreaterThan(first);
    const loaded = await count(page);

    await page.locator(`${ITEMS} a[href]`).first().click();
    await page.waitForURL((u) => !u.pathname.endsWith('tops-women.html'));
    await page.goBack();
    await expect.poll(() => count(page)).toBe(loaded);
  });

  test('without JavaScript the pager is all there is', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, ignoreHTTPSErrors: true, baseURL: String(test.info().project.use.baseURL) });
    const page = await context.newPage();
    await page.goto(uncached(TOPS));
    await expect(page.locator('button.of-more-products')).toHaveCount(0);
    await page.locator('#of-results a.pages-item-next').first().click();
    await expect(page).toHaveURL(/[?&]p=2/);
    await context.close();
  });
});

test.describe('as shoppers scroll', () => {
  test.beforeAll(() => setting('infinite'));

  test('two pages load on their own, then the button waits', async ({ page }) => {
    await page.goto(uncached(TOPS));
    const first = await count(page);
    const expected = Math.min(productTotal(await page.content()), first * 3);
    const scroll = async (): Promise<void> => {
      for (let i = 0; i < 4; i += 1) {
        await page.mouse.wheel(0, 4000);
        await page.waitForTimeout(300);
      }
    };
    await expect.poll(async () => {
      await scroll();
      return count(page);
    }, { timeout: 15000 }).toBe(expected);
    await scroll();
    expect(await count(page), 'no third page without a click').toBe(expected);
  });
});
