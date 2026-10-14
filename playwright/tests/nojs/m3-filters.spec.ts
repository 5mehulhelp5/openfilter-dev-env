import { test, expect } from '../fixture';
import { productTotal } from '../helpers';

/**
 * M3 with JavaScript off (FE1, 08 §7): every filter works by navigation; groups open natively; chips and Clear All
 * are links.
 */
const CATEGORY = '/women/tops-women.html';

test('without JavaScript: open a closed group, pick two options, remove one chip, clear all', async ({ page }) => {
  await page.goto(CATEGORY);
  const all = productTotal(await page.content());
  const code = await page.locator('#of-filters details.of-group:not([open]):not(.of-group--category):not(.of-group--slider)').first()
    .getAttribute('data-of-group');
  const closed = page.locator(`#of-filters details.of-group[data-of-group="${code}"]`);
  await closed.locator(':scope > summary').click();
  await expect(closed).toHaveAttribute('open');

  await closed.locator('a[data-of-link]').first().click();
  const group = page.locator(`#of-filters details.of-group[data-of-group="${code}"]`);
  await expect(group.locator('a[aria-current="true"]')).toHaveCount(1);
  await expect(group, 'a group with a selected value is open').toHaveAttribute('open');

  const next = group.locator('a[data-of-link]:not([aria-current])').first();
  if (await next.count()) {
    await next.click();
    await expect(page.locator('#of-state a.of-chip')).toHaveCount(2);
    await page.locator('#of-state a.of-chip').first().click();
    await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);
  }

  // A full navigation without JavaScript: wait for the new page, not just for the chips to disappear.
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.locator('#of-state a.of-clear').click()]);
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(0);
  expect(productTotal(await page.content())).toBe(all);
});
