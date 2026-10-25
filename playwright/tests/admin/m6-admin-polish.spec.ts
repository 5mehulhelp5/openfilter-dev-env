import { test, expect } from '@playwright/test';
import { magento, openAdmin, snapshotOpenFilter, sql, waitForAdmin } from './admin';

/**
 * M6 S10 admin polish: "Set up OpenFilter" above the Filters grid (states from what the merchant did, hidden on
 * request), the Why panel as one status line with the checks folded below, and a live preview of the SEO templates.
 * Serial admin project; flags and filter settings are restored afterwards.
 */
const FLAGS = "('openfilter_checklist_hidden', 'openfilter_filters_sorted')";
let restore: () => void;

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  sql(`DELETE FROM flag WHERE flag_code IN ${FLAGS}`);
});

test.afterAll(() => {
  restore();
  sql(`DELETE FROM flag WHERE flag_code IN ${FLAGS}`);
});

test('the setup checklist shows five steps with their state and hides on request', async ({ page }) => {
  await openAdmin(page, 'openfilter/filter/index/');
  const list = page.locator('[data-of-checklist]');
  await expect(list.getByRole('heading', { name: /Set up OpenFilter/ })).toBeVisible();
  await expect(list.locator('[data-of-step]')).toHaveCount(5);
  await expect(list.locator('[data-of-step="cache"]')).toHaveClass(/_done/);
  await expect(list.locator('[data-of-step="order"] a')).toHaveAttribute('href', /openfilter\/filter\/sort/);

  await list.getByRole('button', { name: 'Hide this list' }).click();
  await waitForAdmin(page);
  await expect(page.locator('[data-of-checklist]')).toHaveCount(0);
});

test('the Why panel says in one line why a filter does not show', async ({ page }) => {
  const colorId = sql("SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'color' AND entity_type_id = 4")[0][0];
  sql(`INSERT INTO openfilter_attribute (attribute_id, display_mode, is_active) VALUES (${colorId}, 'swatch', 0) ON DUPLICATE KEY UPDATE is_active = 0`);
  magento('cache:clean', 'openfilter');

  await openAdmin(page, 'openfilter/filter/edit/code/color/');
  const status = page.locator('.of-why [data-of-why-status]');
  await expect(status).toBeVisible();
  await expect(status).toHaveClass(/_fail/);
  await expect(status).toContainText('Not showing:');
  await expect(status).toContainText('Switch "Show on the storefront" on.');
  const checks = page.locator('.of-why [data-of-why-checks]');
  await expect(checks).toBeHidden();
  await page.locator('.of-why [data-of-why-all]').click();
  await expect(checks).toBeVisible();

  // Size is off on search result pages in the fixture, and shows on category pages.
  await openAdmin(page, 'openfilter/filter/edit/code/size/');
  await expect(page.locator('.of-why [data-of-why-status]')).toContainText('Not showing on search result pages:');
});

test('the SEO templates show a live preview', async ({ page }) => {
  await openAdmin(page, 'admin/system_config/edit/section/openfilter/');
  const head = page.locator('#openfilter_seo-head');
  if ((await head.getAttribute('class'))?.includes('open') !== true) {
    await head.click();
  }
  const inherit = page.locator('#openfilter_seo_h1_inherit');
  if (await inherit.isChecked()) {
    await inherit.uncheck();
  }
  await page.locator('#openfilter_seo_h1').fill('{category} in {filters}');
  await expect(page.locator('#openfilter_seo_h1 + .of-template-length')).toHaveText(/^Preview: .+ in .+, .+$/);
});
