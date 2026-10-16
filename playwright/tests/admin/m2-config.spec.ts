import { test, expect, Page } from '@playwright/test';
import { magento, openAdmin, sql } from './admin';

/**
 * M2 S1: OpenFilter's settings under Stores > Configuration > Iranimij > OpenFilter, reached from
 * Catalog > OpenFilter > Settings. Numbers are validated in the browser and on the server.
 */
const PATHS = ['openfilter/seo/max_active_values', 'openfilter/display/expanded_groups'];

async function openGroup(page: Page, group: string): Promise<void> {
  const fieldset = page.locator(`#openfilter_${group}`);
  if (!(await fieldset.isVisible())) {
    await page.locator(`#openfilter_${group}-head`).click();
  }
  await expect(fieldset).toBeVisible();
}

test.describe('OpenFilter settings', () => {
  test.afterAll(() => {
    sql(`DELETE FROM core_config_data WHERE path IN (${PATHS.map((p) => `'${p}'`).join(',')})`);
    magento('cache:clean', 'config', 'full_page');
  });

  test('the menu leads to the section, numbers are validated and saved', async ({ page }) => {
    await openAdmin(page, 'admin/dashboard/');
    await page.locator('#menu-magento-catalog-catalog > a').click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/system_config\/edit\/section\/openfilter/);
    await expect(page.locator('#openfilter_general-head')).toContainText('General');
    await expect(page.locator('#openfilter_display-head')).toContainText('Display');
    await expect(page.locator('#openfilter_seo-head')).toContainText('SEO');

    await openGroup(page, 'seo');
    const max = page.locator('#openfilter_seo_max_active_values');
    if (await max.isDisabled()) {
      await page.locator('#openfilter_seo_max_active_values_inherit').uncheck();
    }
    await max.fill('-1');
    await page.locator('#save').click();
    await expect(page.locator('#openfilter_seo_max_active_values-error')).toBeVisible();

    await max.fill('7');
    await openGroup(page, 'display');
    const expanded = page.locator('#openfilter_display_expanded_groups');
    if (await expanded.isDisabled()) {
      await page.locator('#openfilter_display_expanded_groups_inherit').uncheck();
    }
    await expanded.fill('4');
    await page.locator('#save').click();
    await expect(page.locator('.message-success')).toContainText('You saved the configuration.');
    await expect(page.locator('#openfilter_seo_max_active_values')).toHaveValue('7');

    const stored = Object.fromEntries(sql(`SELECT path, value FROM core_config_data WHERE path IN (${PATHS.map((p) => `'${p}'`).join(',')}) AND scope = 'default'`));
    expect(stored).toEqual({ 'openfilter/seo/max_active_values': '7', 'openfilter/display/expanded_groups': '4' });
  });
});
