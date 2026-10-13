import { test, expect } from '../fixture';
import { productTotal } from '../helpers';

/**
* M3 S3 without JavaScript: chips above the results name the filter and the value (ranges in the display currency); removing one keeps
 * the others; "Clear all" drops every filter but keeps the sort order.
 */
const CATEGORY = '/women/tops-women.html';

test('chips: names and values, one removal keeps the rest, Clear all keeps the sort order', async ({ page }) => {
  await page.goto(`${CATEGORY}?color=blue&price=20-50&rating=4&product_list_order=name`);
  const chips = page.locator('#of-state a.of-chip');
  await expect(chips).toHaveCount(3);
  await expect(chips.filter({ hasText: 'Color' })).toHaveText(/Color: Blue/);
  await expect(chips.filter({ hasText: 'Price' })).toHaveText(/Price: €20\.00 - €50\.00/);
  await expect(chips.filter({ hasText: 'Rating' })).toHaveText(/Rating: 4 stars & up/);
  await expect(chips.filter({ hasText: 'Color' })).toHaveAttribute('aria-label', 'Remove filter Color: Blue');

  await chips.filter({ hasText: 'Color' }).click();
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(2);
  expect(page.url()).not.toContain('color=');
  expect(page.url()).toContain('price=20-50');

  await page.locator('#of-state a.of-clear').click();
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(0);
  expect(new URL(page.url()).search).toBe('?product_list_order=name');
  const all = productTotal(await (await page.request.get(CATEGORY)).text());
  expect(productTotal(await page.content())).toBe(all);
});
