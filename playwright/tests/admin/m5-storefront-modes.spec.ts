import AxeBuilder from '@axe-core/playwright';
import { test, expect, Browser, Page } from '@playwright/test';
import { WCAG } from '../axe';
import { collectCspViolations, openGroup, productTotal } from '../helpers';
import { magento, snapshotOpenFilter, sql, uncached } from './admin';

/**
 * M5 S6: the 1.1 storefront modes on the default store view (Hyvä of this run): horizontal bar with popovers, desktop
 * "Show N products", sticky sidebar, dropdown display, tooltips and the "all must match" hint, category tree depth.
 * Desktop, phone and JavaScript off; no CSP violation; axe on the new parts. Runs in the serial admin project
 * because it changes settings for the store view; everything is restored afterwards.
 */
const TOPS = '/women/tops-women.html';
const CONFIG = ['openfilter/display/layout', 'openfilter/display/apply_mode', 'openfilter/display/sticky'];
let restore: () => void;

function setting(path: string, value: string | null): void {
  sql(`DELETE FROM core_config_data WHERE path = '${path}' AND scope = 'stores'
       AND scope_id = (SELECT store_id FROM store WHERE code = 'default')`);
  if (value !== null) {
    sql(`INSERT INTO core_config_data (scope, scope_id, path, value)
         SELECT 'stores', store_id, '${path}', '${value}' FROM store WHERE code = 'default'`);
  }
}

function attribute(code: string, set: string, tooltip: string | null = null): void {
  sql(`INSERT INTO openfilter_attribute (attribute_id)
       SELECT attribute_id FROM eav_attribute WHERE entity_type_id = 4 AND attribute_code = '${code}'
       ON DUPLICATE KEY UPDATE openfilter_attribute.attribute_id = openfilter_attribute.attribute_id`);
  sql(`UPDATE openfilter_attribute SET ${set} WHERE attribute_id =
       (SELECT attribute_id FROM eav_attribute WHERE entity_type_id = 4 AND attribute_code = '${code}')`);
  if (tooltip !== null) {
    sql(`INSERT INTO openfilter_attribute_store (attribute_id, store_id, tooltip)
         SELECT attribute_id, 0, '${tooltip}' FROM eav_attribute WHERE entity_type_id = 4 AND attribute_code = '${code}'
         ON DUPLICATE KEY UPDATE tooltip = VALUES(tooltip)`);
  }
}

/** Contexts made in a test do not inherit the project's baseURL. */
function base(): string {
  return String(test.info().project.use.baseURL);
}

function clean(): void {
  magento('cache:clean', 'config', 'openfilter', 'full_page');
}

async function open(page: Page, query = ''): Promise<string[]> {
  const csp = collectCspViolations(page);
  await page.goto(uncached(`${TOPS}${query}`), { waitUntil: 'networkidle' });
  return csp;
}

async function noJs(browser: Browser, url: string): Promise<Page> {
  const context = await browser.newContext({ javaScriptEnabled: false, ignoreHTTPSErrors: true, baseURL: base() });
  const page = await context.newPage();
  await page.goto(url);
  return page;
}

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  attribute('style_general', "logic = 'and'", 'A product has each style you pick.');
  attribute('climate', "display_mode = 'dropdown'");
  sql(`UPDATE openfilter_builtin SET display_mode = 'tree', multiselect = 1 WHERE code = 'category'`);
  clean();
});

test.afterAll(() => {
  CONFIG.forEach((path) => setting(path, null));
  restore();
  clean();
});

test.describe('sidebar modes', () => {
  test.beforeAll(() => {
    setting('openfilter/display/layout', 'sidebar');
    setting('openfilter/display/apply_mode', 'button');
    setting('openfilter/display/sticky', '1');
    clean();
  });

  test('hint, tree and dropdown render; axe and CSP clean', async ({ page }) => {
    const csp = await open(page);
    const style = page.locator('[data-of-group="style_general"]');
    await expect(style.locator('.of-group__match')).toHaveText('Products have all picked values.');
    const about = style.locator('details.of-about');
    await expect(about.locator('summary')).toHaveText(/^About /);
    await expect(about.locator('.of-group__hint')).toBeHidden();
    await about.locator('summary').click();
    await expect(about.locator('.of-group__hint')).toHaveText('A product has each style you pick.');
    await expect(page.locator('[data-of-group="category"] .of-options__item').first()).toBeVisible();
    await expect(page.locator('[data-of-group="climate"] select[data-of-dropdown-select]')).toBeAttached();
    await expect(page.locator('[data-of-group="climate"] .of-dropdown__go')).toBeHidden();
    const axe = await new AxeBuilder({ page }).include('#of-drawer').withTags(WCAG).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    expect(csp).toEqual([]);
  });

  test('desktop apply mode: clicks are staged, Show N products applies them, Reset undoes', async ({ page }) => {
    await open(page);
    const start = page.url();
    const bar = page.locator('[data-of-apply-bar]');
    await expect(bar).toBeHidden();
    await page.locator('[data-of-group="style_general"] a.of-option').first().click();
    const show = page.locator('[data-of-apply-show]');
    await expect(show).toHaveText(/Show \d+ products?/);
    expect(page.url(), 'nothing loaded yet').toBe(start);
    await page.locator('[data-of-apply-reset]').click();
    await expect(bar).toBeHidden();
    await expect(page.locator('[data-of-group="style_general"] a.of-option--selected')).toHaveCount(0);

    await page.locator('[data-of-group="style_general"] a.of-option').first().click();
    await expect(bar).toBeVisible();
    await expect(bar, 'Review #1: the bar is in the window, not below the sidebar').toBeInViewport({ ratio: 1 });
    await expect(show).toHaveText(/Show \d+ products?/);
    await expect(show).not.toHaveAttribute('aria-busy', 'true');
    const n = Number((await show.textContent())!.replace(/\D/g, ''));
    await show.click();
    await expect(page).toHaveURL(/style_general=/);
    await expect(bar).toBeHidden();
    expect(productTotal(await page.content())).toBe(n);
  });

  test('in apply mode a dropdown change is staged too, and focus stays on the select', async ({ page }) => {
    await open(page);
    const select = page.locator('[data-of-group="climate"] select[data-of-dropdown-select]');
    await page.locator('[data-of-group="climate"] > summary').click();
    const value = await select.locator('option').nth(1).getAttribute('value');
    await select.selectOption(value!);
    const show = page.locator('[data-of-apply-show]');
    await expect(show).toHaveText(/Show \d+ products?/);
    await expect(show).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('[data-of-group="climate"] select[data-of-dropdown-select]')).toBeFocused();
    await show.click();
    await expect(page).toHaveURL(/climate=[a-z-]+/);
  });

  test('the sidebar stays in view while scrolling', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.scrollTo(0, 1600));
    await expect.poll(async () => Math.round((await page.locator('#of-drawer').boundingBox())!.y)).toBeLessThan(40);
  });

  test('phones keep the drawer: staged inside it, no desktop bar', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true, baseURL: base() });
    const page = await context.newPage();
    await open(page);
    await page.locator('[data-of-drawer-open]').click();
    await openGroup(page, 'style_general');
    await page.locator('[data-of-group="style_general"] a.of-option').first().click();
    await expect(page.locator('[data-of-drawer-apply]')).toHaveText(/Show \d+ products?/);
    await expect(page.locator('[data-of-apply-bar]')).toBeHidden();
    await context.close();
  });

  test('without JavaScript: the dropdown is a form, links still filter', async ({ browser }) => {
    const page = await noJs(browser, uncached(TOPS));
    await openGroup(page, 'climate');
    const form = page.locator('[data-of-group="climate"] form.of-dropdown');
    await form.locator('select').selectOption({ index: 1 });
    await form.locator('.of-dropdown__go').click();
    await expect(page).toHaveURL(/climate=[a-z-]+/, { timeout: 15_000 });
    await openGroup(page, 'style_general');
    await page.locator('[data-of-group="style_general"] a.of-option').first().click();
    await expect(page).toHaveURL(/style_general=/);
    await page.context().close();
  });
});

test.describe('horizontal bar', () => {
  test.beforeAll(() => {
    setting('openfilter/display/layout', 'horizontal');
    setting('openfilter/display/apply_mode', null);
    setting('openfilter/display/sticky', null);
    clean();
  });

  test('filters above the products; one popover at a time; Escape and outside clicks close', async ({ page }) => {
    const csp = await open(page);
    const bar = page.locator('.of-drawer--horizontal');
    await expect(bar).toBeVisible();
    const products = await page.locator('#of-results').boundingBox();
    expect((await bar.boundingBox())!.y).toBeLessThan(products!.y);
    await expect(page.locator('.of-drawer--horizontal details.of-group[open]')).toHaveCount(0);

    // Review #1: one row of filters, the rest behind "More filters (N)".
    const more = page.locator('[data-of-more-filters]');
    const shown = page.locator('.of-drawer--horizontal .of-filters__nav > details.of-group:not(.of-group--overflow)');
    const tops = await shown.evaluateAll((groups) => [...new Set(groups.map((g) => Math.round(g.getBoundingClientRect().top)))]);
    expect(tops, 'one row').toHaveLength(1);
    const hidden = await page.locator('.of-drawer--horizontal .of-group--overflow').count();
    expect(hidden).toBeGreaterThan(0);
    await expect(more).toHaveText(`More filters (${hidden})`);
    await more.click();
    await expect(page.locator('.of-drawer--horizontal .of-group--overflow')).toHaveCount(0);
    await expect(more).toHaveText('Fewer filters');
    await more.click();
    await expect(page.locator('.of-drawer--horizontal .of-group--overflow')).toHaveCount(hidden);

    await page.locator('[data-of-group="style_general"] > summary').click();
    await page.locator('[data-of-group="size"] > summary').click();
    await expect(page.locator('.of-drawer--horizontal details.of-group[open]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.of-drawer--horizontal details.of-group[open]')).toHaveCount(0);
    await expect(page.locator('[data-of-group="size"] > summary')).toBeFocused();

    await page.locator('[data-of-group="size"] > summary').click();
    await page.locator('h1').click();
    await expect(page.locator('.of-drawer--horizontal details.of-group[open]')).toHaveCount(0);

    await page.locator('[data-of-group="style_general"] > summary').click();
    await page.locator('[data-of-group="style_general"] a.of-option').first().click();
    await expect(page).toHaveURL(/style_general=/);
    const axe = await new AxeBuilder({ page }).include('#of-drawer').withTags(WCAG).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    expect(csp).toEqual([]);
  });

  test('phones open the same filters as the drawer', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true, baseURL: base() });
    const page = await context.newPage();
    await open(page);
    await expect(page.locator('.of-drawer--horizontal')).toBeHidden();
    await page.locator('[data-of-drawer-open]').click();
    await expect(page.locator('#of-drawer[data-of-modal]')).toBeVisible();
    await context.close();
  });

  test('without JavaScript the groups open and their links filter', async ({ browser }) => {
    const page = await noJs(browser, uncached(TOPS));
    await openGroup(page, 'style_general');
    await page.locator('[data-of-group="style_general"] a.of-option').first().click();
    await expect(page).toHaveURL(/style_general=/);
    await page.context().close();
  });
});
