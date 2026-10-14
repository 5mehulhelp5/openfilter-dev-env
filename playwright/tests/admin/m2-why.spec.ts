import { test, expect } from '@playwright/test';
import { magento, openAdmin, snapshotOpenFilter, sql, waitForAdmin } from './admin';

/**
 * M2 S5: "Why is this filter not showing?" from the grid. A hidden filter shows the problem and its fix; a category
 * check counts the products of that category.
 */
let restore: () => void;

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  sql("DELETE FROM ui_bookmark WHERE namespace = 'openfilter_filter_listing'");
});

test.afterAll(() => {
  restore();
});

test('the panel names a hidden filter and checks a category page', async ({ page }) => {
  const colorId = sql("SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'color' AND entity_type_id = 4")[0][0];
  sql(`INSERT INTO openfilter_attribute (attribute_id, display_mode, is_active) VALUES (${colorId}, 'swatch', 0) ON DUPLICATE KEY UPDATE is_active = 0`);
  magento('cache:clean', 'openfilter');

  await openAdmin(page, 'openfilter/filter/index/');
  const row = page.locator('.data-grid tbody tr.data-row').filter({ has: page.locator('td', { hasText: /^\s*Color\s*$/ }) }).first();
  await row.locator('.action-select').click();
  await row.getByRole('link', { name: 'Why is it not showing?' }).click();
  await waitForAdmin(page);

  const panel = page.locator('.of-why');
  await expect(panel).toBeVisible();
  const shown = panel.locator('[data-of-check="shown"]');
  await expect(shown).toHaveClass(/_fail/);
  await expect(shown).toContainText('Switch "Show on the storefront" on.');
  await expect(panel.locator('[data-of-check="enabled"]')).toHaveClass(/_ok/);

  await panel.locator('[data-of-why-category]').selectOption({ label: 'Women / Tops / Jackets' });
  await panel.locator('[data-of-why-run]').click();
  await expect(panel.locator('[data-of-check="products"]')).toContainText(/\d+ visible product\(s\)/);
  await expect(panel.locator('[data-of-check="category_anchor"]')).toHaveClass(/_ok/);
});
