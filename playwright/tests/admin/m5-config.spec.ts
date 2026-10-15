import { test, expect, Page } from '@playwright/test';
import { magento, openAdmin, snapshotOpenFilter, sql, waitForAdmin } from './admin';

/**
 * M5 S1: the 1.1 settings. Each filter setting appears only where it fits ("Products must match" on option
 * filters, ranges on price, tree levels on category); the store settings for layout, apply mode, sticky sidebar,
 * SEO templates and the sitemap default to 1.0's behaviour. Every change is rolled back afterwards.
 */
let restore: () => void;
const PATHS = ['openfilter/display/layout', 'openfilter/seo/meta_title'];

test.beforeAll(() => {
  restore = snapshotOpenFilter();
});

test.afterAll(() => {
  restore();
  sql(`DELETE FROM core_config_data WHERE path IN (${PATHS.map((p) => `'${p}'`).join(',')})`);
  magento('cache:clean', 'config', 'full_page');
});

async function save(page: Page): Promise<void> {
  await page.locator('#save').click();
  await waitForAdmin(page);
}

test.describe('1.1 filter settings', () => {
  test('colour: "Products must match" any or all, and a tooltip', async ({ page }) => {
    await openAdmin(page, 'openfilter/filter/edit/code/color/');
    await expect(page.locator('[data-index="ranges"]')).toBeHidden();
    await expect(page.locator('[data-index="tree_depth"]')).toBeHidden();
    const logic = page.locator('select[name="logic"]');
    expect((await logic.locator('option').allTextContents()).map((o) => o.trim())).toEqual([
      'Any of the picked values (more products)',
      'All of the picked values (fewer products)',
    ]);
    await expect(logic).toHaveValue('or');

    await logic.selectOption('and');
    await page.locator('textarea[name="tooltip_0"]').fill('Pick every colour the product must have');
    await save(page);

    await expect(page.locator('.message-success')).toContainText('You saved the filter.');
    await expect(page.locator('select[name="logic"]')).toHaveValue('and');
    await expect(page.locator('textarea[name="tooltip_0"]')).toHaveValue('Pick every colour the product must have');
  });

  test('price: the Ranges type with a list, a wrong list is refused', async ({ page }) => {
    await openAdmin(page, 'openfilter/filter/edit/code/price/');
    await expect(page.locator('[data-index="logic"]')).toBeHidden();
    await expect(page.locator('select[name="display_mode"] option[value="ranges"]')).toHaveCount(1);

    await page.locator('select[name="display_mode"]').selectOption('ranges');
    await page.locator('input[name="ranges"]').fill('0-60,50-100');
    await save(page);
    await expect(page.locator('.message-error')).toContainText('are not a list like 0-50,50-100,100-');

    await page.locator('select[name="display_mode"]').selectOption('ranges');
    await page.locator('input[name="ranges"]').fill('0-50, 50-100, 100-');
    await save(page);
    await expect(page.locator('.message-success')).toContainText('You saved the filter.');
    await expect(page.locator('input[name="ranges"]')).toHaveValue('0-50,50-100,100-');
  });

  test('category: tree levels', async ({ page }) => {
    await openAdmin(page, 'openfilter/filter/edit/code/category/');
    await expect(page.locator('[data-index="ranges"]')).toBeHidden();
    await expect(page.locator('select[name="display_mode"] option[value="tree"]')).toHaveCount(1);
    await expect(page.locator('input[name="tree_depth"]')).toHaveValue('3');
  });
});

test.describe('1.1 store settings', () => {
  test('layout, apply mode, sticky, SEO templates and sitemap default to 1.0 behaviour', async ({ page }) => {
    await openAdmin(page, 'admin/system_config/edit/section/openfilter/');
    for (const group of ['display', 'seo', 'sitemap']) {
      if (!(await page.locator(`#openfilter_${group}`).isVisible())) {
        await page.locator(`#openfilter_${group}-head`).click();
      }
    }
    await expect(page.locator('#openfilter_display_layout')).toHaveValue('sidebar');
    await expect(page.locator('#openfilter_display_apply_mode')).toHaveValue('instant');
    await expect(page.locator('#openfilter_display_sticky')).toHaveValue('0');
    await expect(page.locator('#openfilter_seo_meta_title')).toHaveValue('');
    await expect(page.locator('#openfilter_sitemap_enabled')).toHaveValue('0');
    await expect(page.locator('#openfilter_sitemap_min_products')).toBeHidden();

    const layout = page.locator('#openfilter_display_layout');
    if (await layout.isDisabled()) {
      await page.locator('#openfilter_display_layout_inherit').uncheck();
    }
    await layout.selectOption('horizontal');
    // Sticky applies to the top bar as well, so it stays available with the horizontal layout.
    await expect(page.locator('#openfilter_display_sticky')).toBeVisible();
    const title = page.locator('#openfilter_seo_meta_title');
    if (await title.isDisabled()) {
      await page.locator('#openfilter_seo_meta_title_inherit').uncheck();
    }
    await title.fill('{filters} {category} | {store}');
    await page.locator('#save').click();
    await waitForAdmin(page);
    await expect(page.locator('.message-success')).toContainText('You saved the configuration.');
    expect(sql("SELECT value FROM core_config_data WHERE path = 'openfilter/display/layout' AND scope = 'default'")[0][0]).toBe('horizontal');
  });
});
