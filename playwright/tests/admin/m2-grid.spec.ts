import { test, expect, Page } from '@playwright/test';
import { massAction, openAdmin, snapshotOpenFilter, sql, uncached, waitForAdmin } from './admin';

/**
 * M2 S2: Catalog > OpenFilter > Filters lists attributes and built-ins; inline edit and mass actions change what the
 * storefront shows. Every change is rolled back afterwards.
 */
const CATEGORY = '/women/tops-women.html';
let restore: () => void;

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  sql("DELETE FROM ui_bookmark WHERE namespace = 'openfilter_filter_listing'");
});

test.afterAll(() => {
  restore();
});

function row(page: Page, label: string) {
  return page.locator('.data-grid tbody tr.data-row').filter({ has: page.locator('td', { hasText: new RegExp(`^\\s*${label}\\s*$`) }) }).first();
}

async function colorLinks(page: Page): Promise<number> {
  const html = await (await page.request.get(uncached(CATEGORY))).text();
  return (html.match(/href="[^"]*[?&]color=[^"]*"/g) ?? []).length;
}

test.describe('Filters grid', () => {
  test('the first-run notice leads to the grid and goes away', async ({ page }) => {
    sql("DELETE FROM flag WHERE flag_code = 'openfilter_defaults_reviewed'");
    await openAdmin(page, 'admin/dashboard/');
    const messages = page.locator('#system_messages');
    await expect(messages).toContainText(/OpenFilter found \d+ filterable attributes/);

    // With several system messages Magento shows the top one and lists the others collapsed: read the link.
    await page.goto(await messages.locator('a', { hasText: 'Review defaults' }).first().getAttribute('href') ?? '');
    await waitForAdmin(page);
    await expect(page.locator('.page-title')).toHaveText('Filters');
    await openAdmin(page, 'admin/dashboard/');
    await expect(page.locator('body')).not.toContainText('OpenFilter found');
    expect(sql("SELECT COUNT(*) FROM flag WHERE flag_code = 'openfilter_defaults_reviewed'")).toEqual([['1']]);
  });

  test('the menu opens one list of attribute and built-in filters', async ({ page }) => {
    await openAdmin(page, 'admin/dashboard/');
    await page.locator('#menu-magento-catalog-catalog > a').click();
    await page.getByRole('link', { name: 'Filters', exact: true }).click();
    await waitForAdmin(page);
    await expect(page).toHaveURL(/openfilter\/filter\/index/);
    await expect(page.locator('.page-title')).toHaveText('Filters');

    await expect(row(page, 'Color')).toContainText('Swatches');
    await expect(row(page, 'Color')).toContainText('Attribute');
    await expect(row(page, 'Rating')).toContainText('Built-in');
    await expect(row(page, 'Rating')).toContainText('Stars');
    await expect(row(page, 'In stock')).toContainText('Hidden');
  });

  test('inline edit saves a row', async ({ page }) => {
    await openAdmin(page, 'openfilter/filter/index/');
    const size = row(page, 'Size');
    await size.locator('td').nth(3).click();
    const editor = page.locator('tr.data-grid-editable-row:not(.data-grid-bulk-edit-panel):not(.data-grid-editable-row-actions)');
    await expect(editor).toBeVisible();
    await editor.locator('input[name="visible_options"]').fill('4');
    await editor.locator('input[name="search_threshold"]').fill('9');
    await page.locator('.data-grid-editable-row-actions button', { hasText: 'Save' }).click();
    await waitForAdmin(page);

    await expect.poll(() => sql("SELECT visible_options, search_threshold FROM openfilter_attribute WHERE attribute_id = (SELECT attribute_id FROM eav_attribute WHERE attribute_code = 'size' AND entity_type_id = 4)"))
      .toEqual([['4', '9']]);
    await expect(row(page, 'Size')).toContainText('4');
  });

  test('hiding colour removes it from the storefront, showing it brings it back', async ({ page }) => {
    expect(await colorLinks(page)).toBeGreaterThan(3);

    await openAdmin(page, 'openfilter/filter/index/');
    await massAction(page, ['Color'], 'Hide from the storefront');
    await expect(page.locator('.message-success')).toContainText('1 filter(s) are hidden from the storefront.');
    await expect(row(page, 'Color')).toContainText('Hidden');
    expect(await colorLinks(page)).toBe(0);

    await massAction(page, ['Color'], 'Show on the storefront');
    await expect(page.locator('.message-success')).toContainText('1 filter(s) are shown on the storefront.');
    expect(await colorLinks(page)).toBeGreaterThan(3);
  });
});
