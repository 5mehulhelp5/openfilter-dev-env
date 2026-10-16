import { test, expect, Page } from '@playwright/test';
import { openGroup } from '../helpers';
import { magento, openAdmin, snapshotOpenFilter, sql, uncached, waitForAdmin } from './admin';

/**
 * M6 S1 dependent filters: Size waits for a pick in Colour. Admin form (the filters to wait for, their values, loops
 * refused) and storefront (hidden until the pick, its own picks leave with the parent's, old links redirect, links
 * without JavaScript). Runs in the serial admin project because it changes filter settings; restored afterwards.
 */
const TOPS = '/women/tops-women.html';
let restore: () => void;

function attributeId(code: string): string {
  return sql(`SELECT attribute_id FROM eav_attribute WHERE entity_type_id = 4 AND attribute_code = '${code}'`)[0][0];
}

function waitFor(code: string, parent: string | null, values: string | null = null): void {
  const id = attributeId(code);
  sql(`INSERT INTO openfilter_attribute (attribute_id) VALUES (${id}) ON DUPLICATE KEY UPDATE attribute_id = attribute_id`);
  sql(`UPDATE openfilter_attribute SET depends_on = ${parent === null ? 'NULL' : `'${parent}'`},
       depends_values = ${values === null ? 'NULL' : `'${values}'`} WHERE attribute_id = ${id}`);
  magento('cache:clean', 'openfilter', 'full_page');
}

function swapped(page: Page, action: () => Promise<void>): Promise<void> {
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  return action().then(() => done.then(() => undefined));
}

test.beforeAll(() => {
  restore = snapshotOpenFilter();
});

test.afterAll(() => {
  restore();
  magento('cache:clean', 'openfilter', 'full_page');
});

test.describe('storefront', () => {
  test.beforeAll(() => waitFor('size', 'color'));

  test('size appears after a colour is picked and leaves with it', async ({ page }) => {
    await page.goto(uncached(TOPS));
    await expect(page.locator('[data-of-group="color"]')).toHaveCount(1);
    await expect(page.locator('[data-of-group="size"]')).toHaveCount(0);

    const colour = await openGroup(page, 'color');
    await swapped(page, () => colour.locator('a[data-of-link]').first().click());
    await expect(page).toHaveURL(/[?&]color=/);
    const size = await openGroup(page, 'size');
    await swapped(page, () => size.locator('a[data-of-link]').first().click());
    await expect(page).toHaveURL(/[?&]color=[^&]+&size=/);

    const colourChip = page.locator('#of-state a.of-chip:not([href*="color="])');
    await swapped(page, () => colourChip.click());
    await expect(page).not.toHaveURL(/size=/);
    await expect(page.locator('[data-of-group="size"]')).toHaveCount(0);
    await expect(page.locator('#of-state a.of-chip')).toHaveCount(0);
  });

  test('an old link with a size and no colour redirects to the page without it', async ({ request }) => {
    const response = await request.get(uncached(`${TOPS}?size=m`), { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toMatch(/tops-women\.html(\?of_t=\d+)?$/);
  });

  test('without JavaScript the size links are real links once a colour is picked', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, ignoreHTTPSErrors: true, baseURL: String(test.info().project.use.baseURL) });
    const page = await context.newPage();
    await page.goto(uncached(`${TOPS}?color=black`));
    const link = page.locator('[data-of-group="size"] a[data-of-link]').first();
    await expect(link).toHaveAttribute('href', /color=black&size=/);
    await context.close();
  });

  test('only the chosen colour shows size', async ({ request }) => {
    const black = sql(`SELECT o.option_id FROM eav_attribute_option o JOIN eav_attribute_option_value v
       ON v.option_id = o.option_id AND v.store_id = 0 WHERE o.attribute_id = ${attributeId('color')} AND v.value = 'Black'`)[0][0];
    waitFor('size', 'color', black);
    const withBlack = await (await request.get(uncached(`${TOPS}?color=black`))).text();
    const withBlue = await (await request.get(uncached(`${TOPS}?color=blue`))).text();
    waitFor('size', 'color');

    expect(withBlack).toContain('data-of-group="size"');
    expect(withBlue).not.toContain('data-of-group="size"');
  });
});

test.describe('admin', () => {
  test.beforeAll(() => waitFor('size', null));

  test('the form offers every other filter and its values, and refuses filters waiting for each other', async ({ page }) => {
    await openAdmin(page, 'openfilter/filter/edit/code/size/');
    const where = page.locator('[data-index="where"]');
    if (!(await where.locator('[data-index="depends_on"]').isVisible())) {
      await where.locator('.fieldset-wrapper-title').click();
    }
    const parent = where.locator('select[name="depends_on"]');
    await expect(parent.locator('option[value="size"]')).toHaveCount(0);
    await expect(parent.locator('option[value="color"]')).toHaveCount(1);
    await expect(where.locator('[data-index="depends_values"]')).toBeHidden();

    await parent.selectOption('color');
    const values = where.locator('[data-index="depends_values"]');
    await expect(values).toBeVisible();
    await values.locator('.admin__action-multiselect').click();
    await values.locator('input.admin__action-multiselect-search').fill('Black');
    await values.getByText('Black', { exact: true }).click();
    await values.getByRole('button', { name: 'Done' }).click();
    await expect(values.locator('.admin__action-multiselect-crumb')).toContainText('Black');
    await page.locator('#save').click();
    await waitForAdmin(page);
    await expect(page.locator('.message-success')).toContainText('You saved the filter.');
    expect(sql(`SELECT depends_on, depends_values IS NOT NULL FROM openfilter_attribute WHERE attribute_id = ${attributeId('size')}`)[0])
      .toEqual(['color', '1']);
    await openAdmin(page, 'openfilter/filter/');
    const row = page.locator('.data-grid tr.data-row').filter({ has: page.locator('td', { hasText: /^\s*size\s*$/ }) });
    await expect(row).toContainText('after a pick in color');

    await openAdmin(page, 'openfilter/filter/edit/code/color/');
    const colourWhere = page.locator('[data-index="where"]');
    if (!(await colourWhere.locator('[data-index="depends_on"]').isVisible())) {
      await colourWhere.locator('.fieldset-wrapper-title').click();
    }
    await colourWhere.locator('select[name="depends_on"]').selectOption('size');
    await page.locator('#save').click();
    await waitForAdmin(page);
    await expect(page.locator('.message-error')).toContainText('would wait for each other');
  });
});
