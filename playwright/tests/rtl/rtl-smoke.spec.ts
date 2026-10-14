import { test, expect } from '../fixture';
import { collectCspViolations } from '../helpers';

/** The right-to-left store view (fixture child theme OpenFilterFixture/hyva-rtl) renders category pages. */
test('the RTL store view renders a category page right to left, without CSP errors', async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.goto('/women/tops-women.html');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('.product-item').first()).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).direction)).toBe('rtl');
  expect(violations).toEqual([]);
});
