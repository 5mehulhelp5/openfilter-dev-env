import { test, expect } from '../fixture';
import { openGroup } from '../helpers';

/** M3 S2 without JavaScript: "Show more" is a native disclosure; the search box (needs JavaScript) is not shown. */
test('without JavaScript: show more works, no dead search box', async ({ page }) => {
  await page.goto('/women/tops-women.html');
  const material = await openGroup(page, 'material');
  const more = material.locator('details.of-more');
  await more.locator('summary').click();
  await expect(more.locator('a.of-option').first()).toBeVisible();
  await expect(material.locator('.of-search')).toBeHidden();
});
