import { test, expect } from '@playwright/test';
import { openAdmin, snapshotOpenFilter, sql, waitForAdmin } from './admin';

/**
 * M2 S4: the "OpenFilter" fieldset on Stores > Attributes > Product > color, saved with the attribute.
 */
let restore: () => void;
let colorId: string;

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  colorId = sql("SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'color' AND entity_type_id = 4")[0][0];
});

test.afterAll(() => {
  restore();
});

test('the colour attribute page edits its filter settings', async ({ page }) => {
  await openAdmin(page, `catalog/product_attribute/edit/attribute_id/${colorId}/`);
  await page.locator('a#product_attribute_tabs_front').click();
  const fieldset = page.locator('#openfilter_fieldset');
  await expect(fieldset).toBeVisible();
  await expect(fieldset.locator('select[name="openfilter[display_mode]"]')).toHaveValue('swatch');
  await expect(fieldset.getByRole('link', { name: /More settings/ })).toHaveAttribute('href', /openfilter\/filter\/edit\/code\/color/);

  await fieldset.locator('input[name="openfilter[visible_options]"]').fill('5');
  await page.locator('#save').click();
  await waitForAdmin(page);
  await expect(page.locator('.message-success')).toContainText('You saved the product attribute.');

  expect(sql(`SELECT visible_options FROM openfilter_attribute WHERE attribute_id = ${colorId}`)).toEqual([['5']]);
});
