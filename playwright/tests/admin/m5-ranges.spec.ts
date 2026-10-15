import { test, expect, APIRequestContext } from '@playwright/test';
import { filterOptionLinks, groupMarkup, productTotal } from '../helpers';
import { magento, snapshotOpenFilter, sql, uncached } from './admin';

/**
 * M5 S3 on the real store: the price filter as a list of ranges. The merchant's ranges show with counts that equal
 * the pages they lead to; two picked ranges combine with "any of" (their pages add up); automatic ranges have round
 * bounds and add up to the category. Plain links: the same pages work without JavaScript. Runs in the serial admin
 * project because it changes a filter for every store view; the tables are restored.
 */
const CATEGORY = '/women/tops-women.html';
let restore: () => void;

function price(ranges: string | null): void {
  sql(`INSERT INTO openfilter_builtin (code, is_active, display_mode, multiselect, ranges)
       VALUES ('price', 1, 'ranges', 1, ${ranges === null ? 'NULL' : `'${ranges}'`})
       ON DUPLICATE KEY UPDATE display_mode = 'ranges', multiselect = 1, ranges = VALUES(ranges)`);
  magento('cache:clean', 'openfilter', 'full_page');
}

async function page(request: APIRequestContext, query = ''): Promise<string> {
  return (await (await request.get(uncached(`${CATEGORY}${query === '' ? '' : `?${query}`}`))).text());
}

const ranges = (html: string) => filterOptionLinks(groupMarkup(html, 'price'));

test.beforeAll(() => {
  restore = snapshotOpenFilter();
});

test.afterAll(() => {
  restore();
});

test('the merchant\'s ranges: counts equal their pages, two picks add up', async ({ request }) => {
  price('0-40,40-60,60-');
  const html = await page(request);
  const options = ranges(html);
  expect(options.map((o) => o.label)).toEqual(expect.arrayContaining([expect.stringMatching(/^\D?0\.00 – \D?39\.99$/)]));
  expect(groupMarkup(html, 'price')).not.toContain('of-slider');
  expect(options.reduce((sum, o) => sum + o.count, 0), 'every product in exactly one range').toBe(productTotal(html));

  const sizes: number[] = [];
  for (const option of options.slice(0, 2)) {
    const size = productTotal(await page(request, option.href.split('?')[1]));
    expect(size, option.label).toBe(option.count);
    sizes.push(size);
  }
  const first = await page(request, options[0].href.split('?')[1]);
  const second = ranges(first).find((o) => o.label === options[1].label);
  expect(second, 'other ranges stay listed while one is picked').toBeDefined();
  expect(second!.count, 'counted without the price pick').toBe(options[1].count);
  expect(productTotal(await page(request, second!.href.split('?')[1])), 'any of: the pages add up').toBe(sizes[0] + sizes[1]);
});

test('automatic ranges have round bounds and add up to the category', async ({ request }) => {
  price(null);
  const html = await page(request);
  const options = ranges(html);
  expect(options.length).toBeGreaterThan(2);
  for (const option of options) {
    expect(option.href).toMatch(/price=\d+0-(\d+0)?(&|$)/);
  }
  expect(options.reduce((sum, o) => sum + o.count, 0)).toBe(productTotal(html));
});
