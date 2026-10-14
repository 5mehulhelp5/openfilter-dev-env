import { test, expect } from '../fixture';
import { openGroup } from '../helpers';
import { axeOpenFilter } from '../axe';

/**
 * M3 acceptance (10, 03 F: "RTL via logical properties"): on the right-to-left store view OpenFilter mirrors: counts
 * at the inline end (left), chips from the right, the slider's lower end on the right, the drawer from the right.
 */
test('right to left: the filter column, chips and slider mirror', async ({ page }) => {
  await page.goto('/women/tops-women.html?color=blue&price=30-60');
  await expect(page.locator('#of-filters')).toHaveCSS('direction', 'rtl');

  const option = (await openGroup(page, 'material')).locator('a.of-option').first();
  const label = await option.locator('.of-option__label').boundingBox();
  const count = await option.locator('.of-option__count').boundingBox();
  expect(count!.x + count!.width, 'the count sits left of the label').toBeLessThan(label!.x);

  const list = await page.locator('#of-state .of-state__list').boundingBox();
  const chip = await page.locator('#of-state a.of-chip').first().boundingBox();
  expect(list!.x + list!.width - (chip!.x + chip!.width), 'the first chip starts at the right').toBeLessThan(2);

  const price = await openGroup(page, 'price');
  const track = await price.locator('.of-slider__track').boundingBox();
  const fill = await price.locator('.of-slider__fill').boundingBox();
  expect(fill!.x + fill!.width, 'the selected range starts from the right end').toBeLessThan(track!.x + track!.width - 1);
  await expect(price.locator('[data-of-range="from"]')).toHaveCSS('direction', 'rtl');
  await axeOpenFilter(page, 'rtl');
});

test('right to left: the drawer opens from the right on a phone-sized window', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto('/women/tops-women.html');
  await page.locator('[data-of-drawer-open]').click();
  const drawer = await page.locator('#of-drawer[data-of-modal]').boundingBox();
  // Flush with the right edge of the viewport (its width without a scroll bar: Linux CI browsers draw one).
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(Math.round(drawer!.x + drawer!.width)).toBe(viewportWidth);
  expect(drawer!.x).toBeGreaterThan(100);
});
