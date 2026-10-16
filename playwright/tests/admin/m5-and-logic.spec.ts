import { test, expect, APIRequestContext } from '@playwright/test';
import { filterOptionLinks, groupMarkup, productTotal } from '../helpers';
import { magento, snapshotOpenFilter, sql, uncached } from './admin';

/**
 * M5 S2 on the real store: "Products must match all of the picked values" on a multi-select attribute (style on
 * women's tops: a jacket can be hooded and full zip). With one style picked, every other style's count is the size
 * of the page with both picked, and adding a style never grows the result; with "any of" it never shrinks it.
 * Runs in the serial admin project because it changes a filter for every store view; the tables are restored.
 */
const CATEGORY = '/women/tops-women.html';
const CODE = 'style_general';
let restore: () => void;

function logic(value: 'and' | 'or'): void {
  sql(`INSERT INTO openfilter_attribute (attribute_id, logic)
       SELECT attribute_id, '${value}' FROM eav_attribute WHERE attribute_code = '${CODE}' AND entity_type_id = 4
       ON DUPLICATE KEY UPDATE logic = VALUES(logic)`);
  magento('cache:clean', 'openfilter', 'full_page');
}

async function page(request: APIRequestContext, query: string): Promise<string> {
  return (await (await request.get(uncached(`${CATEGORY}?${query}`))).text());
}

function styleOptions(html: string): Array<{ href: string; label: string; count: number }> {
  return filterOptionLinks(groupMarkup(html, CODE));
}

test.beforeAll(() => {
  restore = snapshotOpenFilter();
});

test.afterAll(() => {
  restore();
});

test('all of: counts equal the pages they lead to, and the result only narrows', async ({ request }) => {
  logic('and');
  const jacket = await page(request, `${CODE}=jacket`);
  const base = productTotal(jacket);
  expect(base).toBeGreaterThan(1);

  const others = styleOptions(jacket).filter((o) => o.label !== 'Jacket' && o.href.includes('jacket'));
  expect(others.length, 'other styles stay listed with products that are jackets too').toBeGreaterThan(0);
  for (const option of others.slice(0, 4)) {
    expect(option.count, `${option.label} ≤ jackets`).toBeLessThanOrEqual(base);
    const both = productTotal(await page(request, option.href.split('?')[1]));
    expect(both, `${option.label}: the count is the size of the page with both styles`).toBe(option.count);
  }
});

test('any of (1.0 behaviour) widens instead', async ({ request }) => {
  logic('or');
  const jacket = productTotal(await page(request, `${CODE}=jacket`));
  const hooded = styleOptions(await page(request, `${CODE}=jacket`)).find((o) => o.label === 'Hooded');
  expect(hooded).toBeDefined();
  const both = productTotal(await page(request, hooded!.href.split('?')[1]));
  expect(both).toBeGreaterThanOrEqual(jacket);
});
