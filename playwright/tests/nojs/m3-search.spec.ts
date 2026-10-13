import { test, expect } from '../fixture';
import { openGroup, productTotal } from '../helpers';

/** M3 S7 without JavaScript: search result filters are links that keep the query. */
test('without JavaScript: a search filter link keeps the query and filters', async ({ page }) => {
  await page.goto('/catalogsearch/result/?q=jacket');
  const group = page.locator('#of-filters details.of-group:not(.of-group--category):not(.of-group--slider)').first();
  const key = await group.getAttribute('data-of-group');
  const option = (await openGroup(page, key!)).locator('a[data-of-link]').first();
  const count = Number(await option.locator('[class$="__count"]').evaluate((el) => el.firstChild?.textContent ?? '0'));
  await option.click();
  await expect(page).toHaveURL(/q=jacket/);
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);
  expect(productTotal(await page.content())).toBe(count);
});
