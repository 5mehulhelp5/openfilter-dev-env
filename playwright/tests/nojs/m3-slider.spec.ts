import { test, expect } from '../fixture';
import { openGroup } from '../helpers';

/** M3 S5 without JavaScript: the range form submits from/to; the store answers 301 with the canonical URL. */
test('without JavaScript: the price form applies through a 301 to price=from-to and keeps other filters', async ({ page }) => {
  await page.goto('/women/tops-women.html?color=blue');
  const price = await openGroup(page, 'price');
  await expect(price.locator('[data-of-range]')).toHaveCount(2);
  await expect(price.locator('.of-slider__ranges')).toBeHidden();
  const max = await price.locator('[data-of-number="to"]').getAttribute('max');
  await price.locator('[data-of-number="from"]').fill('30');
  await price.locator('.of-slider__apply').click();

  await expect(page).toHaveURL(new RegExp(`\\?color=blue&price=30-${max}$`));
  await expect(page.locator('#of-state a.of-chip', { hasText: 'Price' })).toBeVisible();
});
