import { test, expect } from './fixture';

/**
 * Review #1 (2026-10-15) fixes on phones: the drawer's "Clear all" shows only when something is picked or staged,
 * and the sticky Filter bar shows the product count next to the button.
 */
const CATEGORY = '/women/tops-women.html';

test('Clear all appears once something is staged; the Filter bar shows the count', async ({ page }) => {
  await page.goto(CATEGORY);
  await expect(page.locator('.of-state__bar [data-of-count-text]')).toHaveText(/^\d+ products$/);
  await page.locator('[data-of-drawer-open]').click();
  const clear = page.locator('#of-drawer [data-of-drawer-clear]');
  await expect(clear).toBeHidden();

  const colour = page.locator('#of-drawer [data-of-group="color"]');
  if (await colour.getAttribute('open') === null) {
    await colour.locator(':scope > summary').click();
  }
  await colour.locator('a.of-swatch').first().click();

  await expect(page.locator('[data-of-drawer-apply]')).not.toHaveAttribute('aria-busy', 'true');
  await expect(clear).toBeVisible();
});
