import { test, expect } from '../fixture';
import { openGroup } from '../helpers';

/** M3 S2 without JavaScript: "Show more" is a native disclosure; the search box (needs JavaScript) is not shown. */
test('without JavaScript: show more works, no dead search box', async ({ page }) => {
  await page.goto('/women/tops-women.html');
  const more = (await openGroup(page, 'color')).locator('details.of-more');
  await more.locator('summary').click();
  await expect(more.locator('a.of-swatch').first()).toBeVisible();
  await expect((await openGroup(page, 'material')).locator('.of-search')).toBeHidden();
});
