import AxeBuilder from '@axe-core/playwright';
import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { WCAG } from './axe';

/**
 * M5 S10: the headless example (openfilter/examples/headless, served at /openfilter-headless/) on top of
 * products { openfilter_aggregations }: filters and counts equal a GraphQL query of the same picks, picking keeps
 * the other values' counts (disjunctive), the URL uses the storefront's format and deep links restore the picks.
 * Theme-independent: runs once, in the Hyvä 1.4 desktop project.
 */
const PAGE = '/openfilter-headless/index.html';

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-h14', 'theme-independent page: one project is enough');
});

async function graphql(request: APIRequestContext, query: string, variables: object = {}) {
  const response = await request.post('/graphql', { data: { query, variables }, headers: { Store: 'default' } });
  const json = await response.json();
  expect(json.errors).toBeUndefined();
  return json.data;
}

async function topsId(request: APIRequestContext): Promise<string> {
  const data = await graphql(request, '{ categoryList(filters: { url_key: { eq: "tops-women" } }) { id } }');
  return String(data.categoryList[0].id);
}

async function expected(request: APIRequestContext, filter: object) {
  const data = await graphql(request, `query ($filter: ProductAttributeFilterInput) { products(filter: $filter, pageSize: 1) {
    total_count openfilter_aggregations { code label options { label count } } } }`, { filter });
  return data.products;
}

async function colourCounts(page: Page): Promise<Record<string, string>> {
  const rows = page.locator('details[data-code="color"] li');
  const counts: Record<string, string> = {};
  for (const row of await rows.all()) {
    counts[(await row.locator('label > span:not(.count):not(.swatch)').innerText()).trim()] = (await row.locator('.count').innerText()).trim();
  }
  return counts;
}

test('filters, counts and URLs from openfilter_aggregations', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const tops = await topsId(request);
  await page.goto(`${PAGE}?category=${tops}`);
  await expect(page.locator('h1')).toHaveText('Tops');

  const all = await expected(request, { category_id: { eq: tops } });
  await expect(page.locator('#count')).toHaveText(`${all.total_count} products`);
  await expect(page.locator('#filters details > summary')).toHaveText(all.openfilter_aggregations.map((a: { label: string }) => a.label));
  expect(await new AxeBuilder({ page }).withTags(WCAG).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);

  await page.locator('details[data-code="color"] label', { hasText: /^Black/ }).click();
  await expect(page).toHaveURL(/[?&]color=black(&|$)/);
  const black = await expected(request, { category_id: { eq: tops }, color: { in: ['49'] } });
  await expect(page.locator('#count')).toHaveText(`${black.total_count} products`);
  const colours = black.openfilter_aggregations.find((a: { code: string }) => a.code === 'color');
  expect(await colourCounts(page)).toEqual(Object.fromEntries(colours.options.map((o: { label: string; count: number }) => [o.label, String(o.count)])));
  expect(Number(colours.options.find((o: { label: string }) => o.label === 'Blue').count)).toBeGreaterThan(0);

  await page.locator('details[data-code="color"] label', { hasText: /^Blue/ }).click();
  await expect(page).toHaveURL(/[?&]color=black,blue(&|$)/);
  // Open the price group unless it starts open (new installs since 1.2 put price second).
  if (await page.locator('details[data-code="price"]').getAttribute('open') === null) {
    await page.locator('details[data-code="price"] > summary').click();
  }
  await page.locator('details[data-code="price"] input[name="from"]').fill('30');
  await page.locator('details[data-code="price"] input[name="to"]').fill('50');
  await page.locator('details[data-code="price"] button', { hasText: 'Apply' }).click();
  await expect(page).toHaveURL(/[?&]price=30-50(&|$)/);
  await expect(page.locator('#chips button')).toHaveText(['Black ×', 'Blue ×', '30-50 ×', 'Clear all']);

  await page.locator('#chips button', { hasText: 'Clear all' }).click();
  await expect(page.locator('#count')).toHaveText(`${all.total_count} products`);
  await expect(page).not.toHaveURL(/color=/);
  expect(errors).toEqual([]);
});

test('a deep link in the storefront\'s URL format restores the picks', async ({ page, request }) => {
  const tops = await topsId(request);
  await page.goto(`${PAGE}?category=${tops}&color=black,blue`);

  const picked = await expected(request, { category_id: { eq: tops }, color: { in: ['49', '50'] } });
  await expect(page.locator('#count')).toHaveText(`${picked.total_count} products`);
  await expect(page.locator('details[data-code="color"] input:checked')).toHaveCount(2);
  await expect(page.locator('#chips button')).toHaveText(['Black ×', 'Blue ×', 'Clear all']);
});
