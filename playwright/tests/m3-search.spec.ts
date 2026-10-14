import { test, expect } from './fixture';
import { collectCspViolations, openGroup, productTotal } from './helpers';

/** M3 S7: filters on the search results page swap like on category pages and keep the query. */
const SEARCH = '/catalogsearch/result/?q=jacket';

test('search results: a filter swaps without a page load and keeps the query; counts match the URL', async ({ page, request }) => {
  const violations = collectCspViolations(page);
  await page.goto(SEARCH);
  await page.evaluate(() => { (window as unknown as { ofMarker: number }).ofMarker = 1; });
  await expect(page.locator('#of-filters .of-group').first()).toBeVisible();
  const group = page.locator('#of-filters details.of-group:not(.of-group--category):not(.of-group--slider)').first();
  const key = await group.getAttribute('data-of-group');
  const option = (await openGroup(page, key!)).locator('a[data-of-link]').first();
  const count = Number(await option.locator('[class$="__count"]').evaluate((el) => el.firstChild?.textContent ?? '0'));

  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await option.click();
  await done;

  expect(page.url()).toContain('q=jacket');
  expect(await page.evaluate(() => (window as unknown as { ofMarker?: number }).ofMarker)).toBe(1);
  expect(productTotal(await page.content())).toBe(count);
  expect(productTotal(await page.content())).toBe(productTotal(await (await request.get(page.url())).text()));
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);
  expect(violations).toEqual([]);
});
