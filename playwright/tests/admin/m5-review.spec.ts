import { test, expect } from '@playwright/test';
import { magento, massAction, openAdmin, sql, uncached } from './admin';

/**
 * Review #1 (2026-10-15), admin side of 1.1: the sticky sidebar setting is visible on a fresh store, the settings
 * sections read "SEO" and "Filter counts", the title/description templates count their characters, the grid warns
 * about filters sharing a name and shows the storefront order, "Show on search pages" brings an attribute to search
 * result pages, Sort filters has a search box and a save bar in view, the "Why" link scrolls to its panel.
 */
test('settings: sticky sidebar visible with the layout inherited, section names, template character count', async ({ page }) => {
  await openAdmin(page, 'admin/system_config/edit/section/openfilter/');
  await expect(page.locator('#row_openfilter_display_sticky')).toBeVisible();
  await expect(page.locator('#openfilter_display_layout')).toBeDisabled();
  await expect(page.locator('#openfilter_seo-head')).toHaveText('SEO');
  await expect(page.locator('#openfilter_search-head')).toHaveText('Filter counts');

  const inherit = page.locator('#openfilter_seo_meta_title_inherit');
  if (await inherit.isChecked()) {
    await inherit.uncheck();
  }
  const count = page.locator('#openfilter_seo_meta_title + .of-template-length');
  await expect(count).toHaveText('0 of about 60 characters shown in search results');
  await page.locator('#openfilter_seo_meta_title').fill('{filters} {category} | {store}');
  // 1.2: a preview with a real category, two option labels and the store name, and its length.
  await expect(count).toHaveText(/^Preview: .+, .+ .+ \| .+ · \d+ of about 60 characters shown in search results$/);
});

test('grid: same-name warning, storefront order, Show on search pages', async ({ page }) => {
  test.setTimeout(120_000);
  try {
    sql(`UPDATE catalog_eav_attribute SET is_filterable_in_search = 0 WHERE attribute_id =
         (SELECT attribute_id FROM eav_attribute WHERE entity_type_id = 4 AND attribute_code = 'size')`);
    await openAdmin(page, 'openfilter/filter/index/');
    await expect(page.locator('.message-warning', { hasText: 'filters called "New"' })).toBeVisible();
    await expect(page.locator('.data-grid th:visible', { hasText: /^\s*Order\s*$/ }).first()).toBeVisible();
    await expect(page.locator('.data-grid th:visible', { hasText: 'Where it shows' }).first()).toBeVisible();

    await massAction(page, ['Size'], 'Show on search pages');
    await expect(page.locator('.message-success', { hasText: '1 filter(s) show on search result pages too.' })).toBeVisible();
    magento('cache:clean', 'config', 'full_page');
    await page.goto(uncached('/catalogsearch/result/?q=jacket'));
    await expect(page.locator('#of-filters [data-of-group="size"]')).toBeVisible();
  } finally {
    sql(`UPDATE catalog_eav_attribute SET is_filterable_in_search = 0 WHERE attribute_id =
         (SELECT attribute_id FROM eav_attribute WHERE entity_type_id = 4 AND attribute_code = 'size')`);
    magento('cache:clean', 'config', 'eav', 'full_page');
  }
});

test('Sort filters: search box narrows the list, Save order stays in view', async ({ page }) => {
  await openAdmin(page, 'openfilter/filter/sort/');
  await expect(page.locator('#save')).toBeInViewport();
  await page.locator('[data-of-sort-search]').fill('color');
  const visible = page.locator('.of-sort-item:not([hidden]) .of-sort-label');
  await expect(visible).toHaveText(['Color']);
  await page.locator('[data-of-sort-search]').fill('');
  expect(await page.locator('.of-sort-item:not([hidden])').count()).toBeGreaterThan(10);
});

test('the grid\'s "Why" link opens the panel at the end of the form and brings it into view', async ({ page }) => {
  await openAdmin(page, 'openfilter/filter/edit/code/size/why/1/');
  await expect(page.locator('.of-why')).toBeInViewport();
  await expect(page.locator('.openfilter-row-text').first()).toBeVisible();
});
