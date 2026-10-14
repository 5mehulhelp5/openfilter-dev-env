import { test, expect } from './fixture';
import { openGroup } from './helpers';

/** M3 on a phone (08 §3): in the drawer, option rows are at least 44 px tall, swatches at least 36 px. */
test('touch targets: option rows ≥ 44 px, swatches ≥ 36 px', async ({ page }) => {
  await page.goto('/women/tops-women.html');
  await page.locator('[data-of-drawer-open]').click(); // on phones the filters live in the drawer
  await expect(page.locator('#of-drawer[data-of-modal]')).toBeVisible();
  const row = (await openGroup(page, 'material')).locator('a.of-option').first();
  await openGroup(page, 'color');
  const rowBox = await row.boundingBox();
  expect(rowBox!.height).toBeGreaterThanOrEqual(44);
  const swatch = page.locator('#of-filters [data-of-group="color"] a.of-swatch .of-swatch__visual').first();
  const swatchBox = await swatch.boundingBox();
  expect(Math.min(swatchBox!.width, swatchBox!.height)).toBeGreaterThanOrEqual(36);
});
