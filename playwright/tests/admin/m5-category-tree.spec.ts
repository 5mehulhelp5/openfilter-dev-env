import { test, expect, APIRequestContext } from '@playwright/test';
import { filterOptionLinks, groupMarkup, productTotal } from '../helpers';
import { magento, snapshotOpenFilter, sql, uncached } from './admin';

/**
 * M5 S4 on the real store: the category filter as a tree. On Women › Tops the subcategories are listed with counts
 * that equal the pages they lead to; two picks narrow with "any of" (their pages add up, the category page stays);
 * the page keeps its own URL (?cat=…, no drill-down). Runs in the serial admin project because it changes a filter
 * for every store view; the tables are restored.
 */
const CATEGORY = '/women/tops-women.html';
let restore: () => void;

async function page(request: APIRequestContext, query = ''): Promise<{ html: string; url: string }> {
  const response = await request.get(uncached(`${CATEGORY}${query === '' ? '' : `?${query}`}`));
  return { html: await response.text(), url: response.url() };
}

const categories = (html: string) => filterOptionLinks(groupMarkup(html, 'category'));

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  sql(`INSERT INTO openfilter_builtin (code, is_active, display_mode, multiselect, tree_depth)
       VALUES ('category', 1, 'tree', 1, 3)
       ON DUPLICATE KEY UPDATE display_mode = 'tree', multiselect = 1, tree_depth = 3`);
  magento('cache:clean', 'openfilter', 'full_page');
});

test.afterAll(() => {
  restore();
});

test('subcategories with counts that equal their pages; two picks add up on the same page', async ({ request }) => {
  const { html } = await page(request);
  const options = categories(html);
  expect(options.map((o) => o.label)).toEqual(expect.arrayContaining(['Jackets', 'Tees']));
  expect(options.every((o) => /[?&]cat=\d+(&|$)/.test(o.href))).toBe(true);

  const jackets = options.find((o) => o.label === 'Jackets')!;
  const tees = options.find((o) => o.label === 'Tees')!;
  const one = await page(request, jackets.href.split('?')[1]);
  expect(new URL(one.url).pathname, 'the page stays Women › Tops').toBe(CATEGORY);
  expect(productTotal(one.html)).toBe(jackets.count);

  const teesThere = categories(one.html).find((o) => o.label === 'Tees');
  expect(teesThere?.count, 'other subcategories keep their counts while one is picked').toBe(tees.count);
  const both = await page(request, teesThere!.href.split('?')[1]);
  expect(teesThere!.href).toMatch(/cat=\d+,\d+/);
  expect(productTotal(both.html), 'any of: jackets and tees').toBe(jackets.count + tees.count);
});
