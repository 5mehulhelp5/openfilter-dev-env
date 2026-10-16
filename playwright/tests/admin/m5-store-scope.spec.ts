import AxeBuilder from '@axe-core/playwright';
import { test, expect, Page } from '@playwright/test';
import { WCAG } from '../axe';
import { openAdmin, snapshotOpenFilter, sql, uncached, waitForAdmin } from './admin';

/**
 * M5 S0: the filter form edits one store view at a time (Magento's store switcher) instead of one column per store
 * view, so it keeps its width with any number of store views. Settings are global and read only in a store view;
 * a store view's own names reach only its storefront; empty = the name for all store views. Every change is rolled
 * back afterwards.
 */
const CATEGORY = '/women/tops-women.html';
let restore: () => void;
let de: string;

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  de = sql("SELECT store_id FROM store WHERE code = 'de'")[0][0];
});

test.afterAll(() => {
  restore();
});

async function storefront(page: Page, store: 'de' | 'default'): Promise<string> {
  return (await (await page.request.get(uncached(`${CATEGORY}?___store=${store}`))).text()).replace(/&amp;/g, '&');
}

async function columns(page: Page): Promise<string[]> {
  const headers = page.locator('[data-index="option_urls"] thead th');
  return (await headers.allTextContents()).map((h) => h.replace(/\s+/g, ' ').trim()).filter((h) => h !== '');
}

async function save(page: Page): Promise<void> {
  await page.locator('#save').click();
  await waitForAdmin(page);
  await expect(page.locator('.message-success')).toContainText('You saved the filter.');
}

test.describe('Filter form per store view', () => {
  test('all store views: shared columns only, global settings marked', async ({ page }) => {
    await openAdmin(page, 'openfilter/filter/edit/code/color/');

    await expect(page.locator('#store-change-button')).toContainText('All Store Views');
    expect(await columns(page)).toEqual(['Option', 'URL name (all store views)', 'Generate again from the label']);
    await expect(page.locator('[data-index="visible_options"] [data-config-scope="[GLOBAL]"]')).toHaveCount(1);
    await expect(page.locator('select[name="display_mode"]')).toBeEnabled();
    await expect(page.locator('#reset')).toBeVisible();
    await expect(page.locator(`input[name="label_${de}"]`)).toHaveCount(0);
  });

  test('the switcher opens Deutsch: its own columns, settings read only, no reset', async ({ page }) => {
    await openAdmin(page, 'openfilter/filter/edit/code/color/');

    await page.locator('#store-change-button').click();
    await page.locator('[data-role="stores-list"] a', { hasText: /^\s*Deutsch\s*$/ }).click();
    const confirm = page.locator('.modal-popup._show');
    await expect(confirm).toContainText('Please confirm scope switching');
    await confirm.locator('.action-accept').click();
    await page.waitForURL(new RegExp(`/store/${de}/`));
    await waitForAdmin(page);

    await expect(page.locator('#store-change-button')).toContainText('Deutsch');
    expect(await columns(page)).toEqual([
      'Option',
      'Label in "Deutsch"',
      'URL name (all store views)',
      'URL name in "Deutsch"',
      'Generate again from the label in "Deutsch"',
    ]);
    await expect(page.locator('select[name="display_mode"]')).toBeDisabled();
    await expect(page.locator('input[name="visible_options"]')).toBeDisabled();
    await expect(page.locator('input[name="url_name"]')).toBeDisabled();
    // Values that cannot be changed here are text, not greyed inputs (Review #1).
    await expect(page.locator('input[name="option_urls[0][url_name_0]"]')).toHaveCount(0);
    await expect(page.locator('tr.data-row').first().locator('.openfilter-row-text', { hasText: /^black$/ })).toBeVisible();
    await expect(page.locator(`input[name="option_urls[0][url_name_${de}]"]`)).toHaveValue('schwarz');
    await expect(page.locator('input[name="url_name_store"]')).toHaveAttribute('placeholder', 'Same as for all store views');
    await expect(page.locator('#reset')).toHaveCount(0);
  });

  test('unsaved changes are kept when switching is cancelled', async ({ page }) => {
    await openAdmin(page, 'openfilter/filter/edit/code/color/');
    await page.locator('input[name="visible_options"]').fill('4');

    await page.locator('#store-change-button').click();
    await page.locator('[data-role="stores-list"] a', { hasText: /^\s*Deutsch\s*$/ }).click();
    const confirm = page.locator('.modal-popup._show');
    await expect(confirm).toContainText('Please confirm scope switching');
    await confirm.locator('.action-dismiss').click();

    await expect(page).not.toHaveURL(/\/store\//);
    await expect(page.locator('input[name="visible_options"]')).toHaveValue('4');
  });

  test('German filter and option URL names reach only the German storefront', async ({ page }) => {
    expect(await storefront(page, 'de')).toMatch(/[?&]color=schwarz[&"]/);

    await openAdmin(page, `openfilter/filter/edit/code/color/store/${de}/`);
    await page.locator('input[name="url_name_store"]').fill('farbe');
    await page.locator(`input[name="option_urls[0][url_name_${de}]"]`).fill('dunkel');
    await save(page);
    await expect(page).toHaveURL(new RegExp(`/store/${de}/`));
    await expect(page.locator('input[name="url_name_store"]')).toHaveValue('farbe');

    const german = await storefront(page, 'de');
    expect(german).toMatch(/[?&]farbe=dunkel[&"]/);
    expect(german).not.toMatch(/[?&]color=/);
    const english = await storefront(page, 'default');
    expect(english).toMatch(/[?&]color=black[&"]/);
    expect(english).not.toMatch(/farbe|dunkel/);
  });

  test('emptied store view fields follow the names for all store views again', async ({ page }) => {
    await openAdmin(page, `openfilter/filter/edit/code/color/store/${de}/`);
    await page.locator('input[name="url_name_store"]').fill('');
    await page.locator(`input[name="option_urls[0][url_name_${de}]"]`).fill('');
    await save(page);

    await expect(page.locator(`input[name="option_urls[0][url_name_${de}]"]`)).toHaveValue('');
    expect(await storefront(page, 'de')).toMatch(/[?&]color=black[&"]/);
  });

  test('the option table in a store view has no accessibility violations of its own', async ({ page }) => {
    await openAdmin(page, `openfilter/filter/edit/code/color/store/${de}/`);
    const result = await new AxeBuilder({ page }).include('[data-index="seo"]').include('[data-index="labels"]').withTags(WCAG).analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
});
