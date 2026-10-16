import { test, expect } from '@playwright/test';
import { collectCspViolations, openGroup } from '../helpers';
import { magento, massAction, openAdmin, sql, uncached, waitForAdmin } from './admin';

/**
 * M6 S7 landing pages: the merchant creates one from a filtered category address, the storefront serves it at its
 * URL key with its own heading, meta tags and text, filter links that reach the same state point to it, a URL key
 * taken by a category is refused, and a deleted page is gone. Serial admin project; the spec removes its pages.
 */
const TOPS = '/women/tops-women.html';
const KEY = 'e2e-black-tops';

function cleanUp(): void {
  sql(`DELETE FROM openfilter_landing_page WHERE url_key IN ('${KEY}', 'women/tops-women.html')`);
  magento('cache:clean', 'openfilter', 'full_page');
}

test.beforeAll(cleanUp);
test.afterAll(cleanUp);

test('a landing page made from a filtered address serves its own page', async ({ page, baseURL }) => {
  await openAdmin(page, 'openfilter/landing/index/');
  await page.getByRole('button', { name: 'Add landing page' }).click();
  await waitForAdmin(page);
  await page.locator('input[name="title"]').fill('Black tops');
  await page.locator('input[name="url_key"]').fill(KEY);
  await page.locator('input[name="page_url"]').fill(`${baseURL}${TOPS}?color=black`);
  await page.locator('input[name="h1"]').fill('Black tops for every day');
  await page.locator('textarea[name="description"]').fill('<p class="e2e-landing-text">Our black tops.</p>');
  await page.locator('input[name="meta_title"]').fill('Black tops | Luma');
  await page.locator('textarea[name="meta_description"]').fill('Black tops for women.');
  await page.locator('#save').click();
  await expect(page.locator('.message-success')).toContainText('You saved the landing page.');
  const row = page.locator('.data-grid tbody tr.data-row', { hasText: KEY });
  await expect(row).toContainText('Black tops');
  await expect(row).toContainText('Tops');

  const csp = collectCspViolations(page);
  await page.goto(uncached(`/${KEY}`));
  await expect(page.locator('h1')).toHaveText('Black tops for every day');
  await expect(page).toHaveTitle(/Black tops \| Luma/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Black tops for women.');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/${KEY}$`));
  await expect(page.locator('.e2e-landing-text')).toHaveText('Our black tops.');
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);
  await expect(page.locator('.product-item, li.item.product').first()).toBeVisible();
  expect(csp).toEqual([]);

  await page.goto(uncached(TOPS));
  const colour = await openGroup(page, 'color');
  await expect(colour.locator(`a[data-of-link][href*="/${KEY}?"]`)).toHaveCount(1);
});

test('a URL key taken by a category is refused; a deleted page is gone', async ({ page, request, baseURL }) => {
  await openAdmin(page, 'openfilter/landing/new/');
  await page.locator('input[name="title"]').fill('Taken');
  await page.locator('input[name="url_key"]').fill('women/tops-women.html');
  await page.locator('input[name="page_url"]').fill(`${baseURL}${TOPS}?color=black`);
  await page.locator('#save').click();
  await expect(page.locator('.message-error')).toContainText('women/tops-women.html');

  await openAdmin(page, 'openfilter/landing/index/');
  await massAction(page, [KEY], 'Delete');
  await page.locator('.modal-popup._show .action-accept').click();
  await expect(page.locator('.message-success')).toContainText('You deleted 1 landing pages.');
  const gone = await request.get(uncached(`/${KEY}`));
  expect(gone.status()).toBe(404);
});
