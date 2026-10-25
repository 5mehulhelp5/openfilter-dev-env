import { test, expect, Page, Request } from '@playwright/test';
import { collectCspViolations, openGroup } from '../helpers';
import { magento, openAdmin, sql, uncached } from './admin';

/**
 * M6 S9 merchant insights on the default store view: off, filter pages send nothing; on, one beacon after the page
 * loads and one after each swap, with the active filters and a product count bucket and nothing about the shopper;
 * the admin Insights page shows the counts
 * and hands its suggested order to Sort filters (nothing saved). Serial admin project; the setting and the counts are removed afterwards.
 */
const TOPS = '/women/tops-women.html';
const PATH = 'openfilter/insights/enabled';
const COLLECT = '/openfilter/insights/collect';

function setting(value: string | null): void {
  sql(`DELETE FROM core_config_data WHERE path = '${PATH}'`);
  if (value !== null) {
    sql(`INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', 0, '${PATH}', '${value}')`);
  }
  magento('cache:clean', 'config', 'full_page');
}

function beacons(page: Page): Request[] {
  const sent: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes(COLLECT)) {
      sent.push(request);
    }
  });
  return sent;
}

test.afterAll(() => {
  setting(null);
  sql('DELETE FROM openfilter_insight_daily');
});

test('off: filter pages send nothing', async ({ page }) => {
  setting(null);
  const sent = beacons(page);
  await page.goto(uncached(TOPS));
  await expect(page.locator('#of-filters')).toBeVisible();
  await page.waitForTimeout(500);
  expect(sent).toHaveLength(0);
  await expect(page.locator('#of-insights')).toHaveCount(0);
});

test('on: a beacon after the page loads and after each swap, nothing about the shopper', async ({ page }) => {
  setting('1');
  sql('DELETE FROM openfilter_insight_daily');
  const csp = collectCspViolations(page);
  const sent = beacons(page);
  const first = page.waitForResponse((response) => response.url().includes(COLLECT));
  await page.goto(uncached(TOPS));
  expect((await first).status()).toBe(204);
  const loaded = JSON.parse(sent[0].postData() ?? '{}');
  expect(loaded).toEqual({ s: 'default', c: expect.any(Number), f: {}, b: expect.any(Number) });

  const colour = await openGroup(page, 'color');
  const second = page.waitForResponse((response) => response.url().includes(COLLECT));
  await colour.locator('a[data-of-link]').first().click();
  expect((await second).status()).toBe(204);
  const swapped = JSON.parse(sent[1].postData() ?? '{}');
  expect(Object.keys(swapped.f)).toEqual(['color']);
  expect(swapped.f.color).toHaveLength(1);
  expect(Object.keys(swapped).sort()).toEqual(['b', 'c', 'f', 's']);
  expect(csp).toEqual([]);

  const views = sql("SELECT SUM(hits) FROM openfilter_insight_daily WHERE kind = 'view'");
  expect(Number(views[0][0])).toBe(2);
});

test('the Insights page shows the counts and suggests an order', async ({ page }) => {
  await openAdmin(page, 'openfilter/insights/index/');
  await expect(page.getByRole('heading', { name: 'Most used filters' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Suggested filter order' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('does not collect insights');

  await page.getByRole('link', { name: 'Apply to Sort filters' }).click();
  await expect(page.locator('[data-of-sort-suggested]')).toBeVisible();
  await expect(page).toHaveURL(/openfilter\/filter\/sort\/.*suggested\/1/);
});
