import { test, expect } from './fixture';
import { collectCspViolations, productTotal } from './helpers';

/**
 * M3 S1: OpenFilter's own templates on Hyvä (1.4.2 and 1.5.2): three regions, native disclosures, real links.
 */
const CATEGORY = '/women/tops-women.html';

test('three regions: filters in the sidebar, chips above the results, results around the product list', async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.goto(CATEGORY);

  await expect(page.locator('.sidebar #of-filters')).toHaveCount(1);
  await expect(page.locator('#of-state')).toHaveCount(1);
  await expect(page.locator('#of-results #product-list')).toHaveCount(1);
  const order = await page.evaluate(() => {
    const state = document.getElementById('of-state')!;
    const results = document.getElementById('of-results')!;
    return Boolean(state.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order, '#of-state comes before #of-results').toBe(true);
  expect(violations).toEqual([]);
});

test('filter groups are native disclosures: the first three open, the others closed with their links in the DOM', async ({ page }) => {
  await page.goto(CATEGORY);
  const groups = page.locator('#of-filters details.of-group');
  expect(await groups.count()).toBeGreaterThan(3);
  const open = await groups.evaluateAll((all) => all.map((group) => (group as HTMLDetailsElement).open));
  expect(open.slice(0, 3)).toEqual([true, true, true]);
  expect(open.slice(3)).not.toContain(true);
  const closed = groups.nth(3);
  expect(await closed.locator('a[data-of-link][href]').count(), 'links of a closed group are in the DOM').toBeGreaterThan(0);

  await closed.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(closed).toHaveAttribute('open');
  await expect(closed.locator('a[data-of-link]').first()).toBeVisible();
});

test('an option link filters the page: the option is marked, a chip appears, the count matches', async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.goto(CATEGORY);
  const group = page.locator('#of-filters details.of-group[open]:not(.of-group--category)').first();
  const option = group.locator('a[data-of-link]').first();
  const label = (await option.locator('[class$="__label"]').innerText()).trim();
  const count = Number(await option.locator('[class$="__count"]').evaluate((el) => el.firstChild?.textContent ?? '0'));

  await option.click();
  await page.waitForLoadState('domcontentloaded');

  const selected = page.locator('#of-filters a[data-of-link][aria-current="true"]');
  await expect(selected).toHaveCount(1);
  await expect(selected.locator('[class$="__label"]')).toHaveText(label);
  await expect(page.locator('#of-state a.of-chip')).toContainText(label);
  expect(productTotal(await page.content())).toBe(count);
  expect(violations).toEqual([]);
});
