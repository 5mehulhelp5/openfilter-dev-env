import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openAdmin, snapshotOpenFilter, sql, waitForAdmin } from '../admin/admin';

/**
 * Screenshots for the M2 milestone report, written to docs/m2-screenshots. Not a test gate: runs only with
 * OF_SCREENSHOTS=1 (project "screenshots-chromium"). The first-run notice is shown again for its shot and the
 * OpenFilter tables are restored afterwards.
 */
const OUT = resolve(__dirname, '../../../docs/m2-screenshots');
test.describe.configure({ mode: 'serial' });
let restore: () => void;

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
  restore = snapshotOpenFilter();
  sql("DELETE FROM ui_bookmark WHERE namespace = 'openfilter_filter_listing'");
});

test.afterAll(() => {
  restore();
  sql("DELETE FROM flag WHERE flag_code = 'openfilter_defaults_reviewed'");
  sql("INSERT INTO flag (flag_code, state, flag_data) VALUES ('openfilter_defaults_reviewed', 0, '\"1\"')");
});

test('01 first-run notice', async ({ page }) => {
  sql("DELETE FROM flag WHERE flag_code = 'openfilter_defaults_reviewed'");
  await openAdmin(page, 'admin/dashboard/');
  await expect(page.locator('#system_messages')).toContainText('OpenFilter found');
  await page.locator('#system_messages').screenshot({ path: `${OUT}/01-first-run-notice.png` });
});

test('02 filters grid', async ({ page }) => {
  await openAdmin(page, 'openfilter/filter/index/reviewed/1/');
  await page.screenshot({ path: `${OUT}/02-filters-grid.png`, fullPage: true });
});

test('03 filter form for colour', async ({ page }) => {
  await openAdmin(page, 'openfilter/filter/edit/code/color/');
  await page.screenshot({ path: `${OUT}/03-filter-form-color.png`, fullPage: true });
});

test('04 why is this filter not showing', async ({ page }) => {
  await openAdmin(page, 'openfilter/filter/edit/code/color/why/1/');
  const panel = page.locator('.of-why');
  await panel.locator('[data-of-why-category]').selectOption({ label: 'Women / Tops / Jackets' });
  await panel.locator('[data-of-why-run]').click();
  await expect(panel.locator('[data-of-check="products"]')).toBeVisible();
  await panel.screenshot({ path: `${OUT}/04-why-not-showing-color-jackets.png` });
});

test('05 attribute fieldset', async ({ page }) => {
  const colorId = sql("SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'color' AND entity_type_id = 4")[0][0];
  await openAdmin(page, `catalog/product_attribute/edit/attribute_id/${colorId}/`);
  await page.locator('a#product_attribute_tabs_front').click();
  await waitForAdmin(page);
  await page.locator('#openfilter_fieldset').screenshot({ path: `${OUT}/05-attribute-fieldset.png` });
});

test('06 settings', async ({ page }) => {
  await openAdmin(page, 'admin/system_config/edit/section/openfilter/');
  for (const group of ['general', 'display', 'seo', 'search']) {
    if (!(await page.locator(`#openfilter_${group}`).isVisible())) {
      await page.locator(`#openfilter_${group}-head`).click();
    }
  }
  await page.screenshot({ path: `${OUT}/06-settings.png`, fullPage: true });
});
