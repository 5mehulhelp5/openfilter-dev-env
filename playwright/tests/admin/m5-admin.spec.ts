import AxeBuilder from '@axe-core/playwright';
import { test, expect, Page } from '@playwright/test';
import { WCAG } from '../axe';
import { openAdmin, snapshotOpenFilter, sql, uncached, waitForAdmin } from './admin';

/**
 * M5 S5 admin: "Sort filters" (keyboard Move up, the storefront follows), "Where it shows" with the category picker
 * (the colour filter only on jackets), and the storefront link of the "Why is this filter not showing?" panel.
 * Every change is rolled back afterwards.
 */
const TOPS = '/women/tops-women.html';
const JACKETS = '/women/tops-women/jackets-women.html';
let restore: () => void;

test.beforeAll(() => {
  restore = snapshotOpenFilter();
});

test.afterAll(() => {
  restore();
});

async function groupOrder(page: Page, path: string): Promise<string[]> {
  const html = await (await page.request.get(uncached(path))).text();
  return [...html.matchAll(/data-of-group="([^"]+)"/g)].map((m) => m[1]);
}

test('Sort filters: Move up by keyboard, save, the storefront follows', async ({ page }) => {
  const before = await groupOrder(page, TOPS);
  const colour = before.indexOf('color');
  expect(colour).toBeGreaterThan(0);
  const above = before[colour - 1];

  await openAdmin(page, 'openfilter/filter/index/');
  await page.getByRole('button', { name: 'Sort filters' }).click();
  await waitForAdmin(page);
  await expect(page.locator('.page-title')).toHaveText('Sort filters');
  const axe = await new AxeBuilder({ page }).include('.of-sort').withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await expect(page.locator('.of-sort-item').first().locator('[data-of-move="up"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.of-sort-item').last().locator('[data-of-move="down"]')).toHaveAttribute('aria-disabled', 'true');
  const move = page.locator('.of-sort-item[data-of-key="color"] [data-of-move="up"]');
  await move.focus();
  await page.keyboard.press('Enter');
  await expect(move).toBeFocused();
  await expect(page.locator('.of-sort-status')).toContainText('is now at position');
  await page.locator('#save').click();
  await waitForAdmin(page);
  await expect(page.locator('.message-success')).toContainText('The new order of the filters is saved.');

  const after = await groupOrder(page, TOPS);
  expect(after.indexOf('color'), `colour now before ${above}`).toBeLessThan(after.indexOf(above));
});

test('Where it shows: the colour filter only in jackets', async ({ page }) => {
  expect(await groupOrder(page, TOPS)).toContain('color');

  await openAdmin(page, 'openfilter/filter/edit/code/color/');
  await page.locator('[data-index="where"] .fieldset-wrapper-title').click();
  await expect(page.locator('[data-index="category_ids"]')).toBeHidden();
  await page.locator('select[name="category_mode"]').selectOption('only');
  const picker = page.locator('[data-index="category_ids"]');
  await expect(picker).toBeVisible();
  await picker.locator('.admin__action-multiselect').click();
  await picker.locator('input.admin__action-multiselect-search').fill('Jackets');
  await picker.getByText('Default Category / Women / Tops').click();
  await picker.getByRole('button', { name: 'Done' }).click();
  await expect(picker.locator('.admin__action-multiselect-crumb')).toContainText('Jackets');
  await page.locator('#save').click();
  await waitForAdmin(page);
  await expect(page.locator('.message-success')).toContainText('You saved the filter.');

  expect(await groupOrder(page, TOPS), 'not on Women › Tops').not.toContain('color');
  expect(await groupOrder(page, JACKETS), 'on Women › Tops › Jackets').toContain('color');
});

test('the Why panel links the checked category on the storefront', async ({ page }) => {
  const tops = sql("SELECT entity_id FROM catalog_category_entity_varchar v JOIN eav_attribute a ON a.attribute_id = v.attribute_id AND a.attribute_code = 'url_key' WHERE v.value = 'tops-women' AND v.store_id = 0")[0][0];
  await openAdmin(page, 'openfilter/filter/edit/code/size/why/1/');
  const panel = page.locator('.of-why');
  await expect(panel).toBeVisible();
  await panel.locator('[data-of-why-category]').selectOption(tops);
  await panel.locator('[data-of-why-run]').click();
  const link = panel.locator('[data-of-why-preview] a');
  await expect(link).toHaveText('Open this category on the storefront');
  await expect(link).toHaveAttribute('href', /tops-women\.html$/);
  await expect(link).toHaveAttribute('target', '_blank');
});
