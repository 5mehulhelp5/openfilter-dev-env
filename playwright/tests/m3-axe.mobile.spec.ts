import { test } from './fixture';
import { axeOpenFilter } from './axe';

/** axe on a phone with the drawer open (focus trap, buttons, headings). */
test('axe: no violations in the open drawer', async ({ page }) => {
  await page.goto('/women/tops-women.html?color=blue');
  await page.locator('[data-of-drawer-open]').click();
  await page.locator('#of-drawer[data-of-modal]').waitFor();
  await axeOpenFilter(page, 'drawer open');
});
