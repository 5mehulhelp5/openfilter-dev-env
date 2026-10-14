import { test, expect, Page } from '@playwright/test';
import { magento, openAdmin, snapshotOpenFilter, sql, uncached, waitForAdmin } from './admin';

/**
 * M2 done-when (04 · Roadmap, 08 §7): a merchant turns colour into a multi-select swatch filter with a search box in
 * under two minutes, from the dashboard, and the storefront follows. Colour starts as a single-select list.
 */
const CATEGORY = '/women/tops-women.html';
let restore: () => void;
let colorId: string;

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  sql("DELETE FROM ui_bookmark WHERE namespace = 'openfilter_filter_listing'");
  colorId = sql("SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'color' AND entity_type_id = 4")[0][0];
  sql(`INSERT INTO openfilter_attribute (attribute_id, display_mode, multiselect, search_threshold) VALUES (${colorId}, 'list', 0, 12)
       ON DUPLICATE KEY UPDATE display_mode = 'list', multiselect = 0, search_threshold = 12`);
  magento('cache:clean', 'openfilter', 'full_page');
});

test.afterAll(() => {
  restore();
});

/** href of the "Blue" colour option on the page filtered by black. */
async function blueLinkUnderBlack(page: Page): Promise<string> {
  const html = (await (await page.request.get(uncached(`${CATEGORY}?color=black`))).text()).replace(/&amp;/g, '&');
  const match = html.match(/href="([^"]*[?&]color=[^"]*blue[^"]*)"/);
  return match?.[1] ?? '';
}

test('colour becomes a multi-select swatch filter with a search box in under two minutes', async ({ page }) => {
  expect(await blueLinkUnderBlack(page)).toMatch(/[?&]color=blue(&|$)/);

  const started = Date.now();
  await openAdmin(page, 'admin/dashboard/');
  await page.locator('#menu-magento-catalog-catalog > a').click();
  await page.getByRole('link', { name: 'Filters', exact: true }).click();
  await waitForAdmin(page);
  const row = page.locator('.data-grid tbody tr.data-row').filter({ has: page.locator('td', { hasText: /^\s*Color\s*$/ }) }).first();
  await row.locator('.action-select').click();
  await row.getByRole('link', { name: 'Edit' }).click();
  await waitForAdmin(page);

  await page.locator('select[name="display_mode"]').selectOption({ label: 'Swatches' });
  const several = page.locator('[data-index="multiselect"]');
  if (!(await several.locator('input[type="checkbox"]').isChecked())) {
    await several.locator('.admin__actions-switch-label').click();
  }
  await page.locator('input[name="search_threshold"]').fill('8');
  await page.locator('#save').click();
  await waitForAdmin(page);
  await expect(page.locator('.message-success')).toContainText('You saved the filter.');
  const seconds = (Date.now() - started) / 1000;
  console.log(`Merchant scenario: ${seconds.toFixed(1)} s`);
  expect(seconds).toBeLessThan(120);

  expect(sql(`SELECT display_mode, multiselect, search_threshold FROM openfilter_attribute WHERE attribute_id = ${colorId}`))
    .toEqual([['swatch', '1', '8']]);
  expect(await blueLinkUnderBlack(page)).toMatch(/[?&]color=(black,blue|blue,black)(&|$)/);
});
