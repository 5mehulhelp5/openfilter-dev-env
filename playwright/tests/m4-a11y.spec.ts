import { test, expect } from './fixture';
import { axeOpenFilter } from './axe';

/** M4 S4: a page without filters (empty search) keeps a named filter dialog; axe stays clean there. */
test('axe: a search without results (no filters) has no violations in OpenFilter regions', async ({ page }) => {
  await page.goto('/catalogsearch/result/?q=zzqxnothingmatches');
  await expect(page.locator('#of-filters details.of-group')).toHaveCount(0);
  await expect(page.locator('#of-filters-title')).toHaveCount(1);
  await axeOpenFilter(page, 'no filters');
});
