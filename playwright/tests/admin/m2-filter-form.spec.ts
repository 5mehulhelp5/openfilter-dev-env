import { test, expect, Page } from '@playwright/test';
import { openAdmin, snapshotOpenFilter, sql, uncached, waitForAdmin } from './admin';

/**
 * M2 S3: the filter form. Labels per store view and option URL names reach the German storefront; a URL name used
 * twice is refused and nothing is saved. Every change is rolled back afterwards.
 */
const CATEGORY = '/women/tops-women.html';
let restore: () => void;
let de: string;

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  sql("DELETE FROM ui_bookmark WHERE namespace = 'openfilter_filter_listing'");
  de = sql("SELECT store_id FROM store WHERE code = 'de'")[0][0];
});

test.afterAll(() => {
  restore();
});

async function openColour(page: Page): Promise<void> {
  await openAdmin(page, 'openfilter/filter/index/');
  const row = page.locator('.data-grid tbody tr.data-row').filter({ has: page.locator('td', { hasText: /^\s*Color\s*$/ }) }).first();
  await row.locator('.action-select').click();
  await row.getByRole('link', { name: 'Edit' }).click();
  await waitForAdmin(page);
  await expect(page.locator('.page-title')).toHaveText('Filter: Color');
}

async function germanPage(page: Page): Promise<string> {
  return (await (await page.request.get(uncached(`${CATEGORY}?___store=de`))).text()).replace(/&amp;/g, '&');
}

test.describe('Filter form', () => {
  test('offers only the display types that fit colour', async ({ page }) => {
    await openColour(page);
    const options = await page.locator('select[name="display_mode"] option').allTextContents();
    expect(options.map((o) => o.trim())).toEqual(['Checkbox list', 'Swatches', 'Dropdown']);
  });

  test('a German label and a German URL name reach the German storefront', async ({ page }) => {
    expect(await germanPage(page)).toMatch(/[?&]color=schwarz[&"]/);

    // Since M5 S0 a store view's own label and URL names are edited in that store view's scope.
    await openAdmin(page, `openfilter/filter/edit/code/color/store/${de}/`);
    await page.locator(`input[name="label_${de}"]`).fill('Farbton');
    await page.locator(`input[name="option_urls[0][url_name_${de}]"]`).fill('dunkel');
    await page.locator('#save').click();
    await waitForAdmin(page);
    await expect(page.locator('.message-success')).toContainText('You saved the filter.');
    await expect(page.locator(`input[name="option_urls[0][url_name_${de}]"]`)).toHaveValue('dunkel');

    const html = await germanPage(page);
    expect(html).toContain('Farbton');
    expect(html).toMatch(/[?&]color=dunkel[&"]/);
    expect(html).not.toMatch(/[?&]color=schwarz[&"]/);
  });

  test('a URL name used twice is refused and nothing is saved', async ({ page }) => {
    await openColour(page);
    const visible = page.locator('input[name="visible_options"]');
    const before = await visible.inputValue();
    await visible.fill('2');
    await page.locator('input[name="option_urls[1][url_name_0]"]').fill('black');
    await page.locator('#save').click();
    await waitForAdmin(page);

    await expect(page.locator('.message-error')).toContainText('Another option of this filter already uses the URL name "black".');
    await expect(page.locator('input[name="visible_options"]')).toHaveValue(before);
    await expect(page.locator('input[name="option_urls[1][url_name_0]"]')).toHaveValue('blue');
  });
});
