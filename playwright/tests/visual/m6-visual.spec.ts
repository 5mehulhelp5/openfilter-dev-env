import { test, expect, Page } from '@playwright/test';
import { openGroup } from '../helpers';
import { magento, snapshotOpenFilter, sql, uncached } from '../admin/admin';

/**
 * M6 S11 visual checks (toHaveScreenshot) of OpenFilter's storefront parts on the default store view: sidebar,
 * horizontal bar, desktop apply bar, quick filter bar and "Load more" on desktop; drawer, quick bar and "Load more"
 * on a phone. CI only (OF_VISUAL=1): the baselines come from the CI runner, one folder per Hyvä version and device,
 * and are refreshed with the E2E input update_snapshots. Settings are restored after each test.
 */
const TOPS = '/women/tops-women.html';
const SETTINGS = ['openfilter/display/layout', 'openfilter/display/apply_mode', 'openfilter/display/quick_bar_size',
  'openfilter/display/pagination'];
let restore: () => void;

function settings(values: Record<string, string>): void {
  sql(`DELETE FROM core_config_data WHERE path IN (${SETTINGS.map((p) => `'${p}'`).join(', ')}) AND scope = 'stores'
       AND scope_id = (SELECT store_id FROM store WHERE code = 'default')`);
  for (const [path, value] of Object.entries(values)) {
    sql(`INSERT INTO core_config_data (scope, scope_id, path, value)
         SELECT 'stores', store_id, '${path}', '${value}' FROM store WHERE code = 'default'`);
  }
  magento('cache:clean', 'config', 'openfilter', 'full_page');
}

async function open(page: Page, path = TOPS): Promise<void> {
  await page.goto(uncached(path));
  await page.locator('#of-filters').waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
}

const isMobile = (): boolean => test.info().project.name.startsWith('visual-mobile');

test.describe.configure({ mode: 'serial' });
// Baselines are Linux renderings; elsewhere only OF_VISUAL_ANY=1 runs them (to try selectors, never to compare).
test.skip(process.platform !== 'linux' && !process.env.OF_VISUAL_ANY, 'baselines are rendered on Linux (CI)');

test.beforeAll(() => {
  restore = snapshotOpenFilter();
  sql(`INSERT INTO openfilter_attribute (attribute_id, display_mode, quick_bar)
       SELECT attribute_id, 'swatch', 1 FROM eav_attribute WHERE entity_type_id = 4 AND attribute_code = 'color'
       ON DUPLICATE KEY UPDATE quick_bar = 1`);
  magento('cache:clean', 'openfilter', 'full_page');
});

test.afterEach(() => settings({}));

test.afterAll(() => {
  restore();
  magento('cache:clean', 'openfilter', 'full_page');
});

test('sidebar', async ({ page }) => {
  test.skip(isMobile(), 'desktop part');
  await open(page);
  await expect(page.locator('#of-filters')).toHaveScreenshot('sidebar.png');
});

test('horizontal bar', async ({ page }) => {
  test.skip(isMobile(), 'desktop part');
  settings({ 'openfilter/display/layout': 'horizontal' });
  await open(page);
  await expect(page.locator('#of-filters')).toHaveScreenshot('horizontal.png');
});

test('apply bar', async ({ page }) => {
  test.skip(isMobile(), 'desktop part');
  settings({ 'openfilter/display/apply_mode': 'button' });
  await open(page);
  const colour = await openGroup(page, 'color');
  await colour.locator('a[data-of-link]').first().click();
  const bar = page.locator('[data-of-apply-bar]');
  await expect(bar).toBeVisible();
  await expect(bar).toHaveScreenshot('apply-bar.png');
});

test('drawer', async ({ page }) => {
  test.skip(!isMobile(), 'phone part');
  await open(page);
  await page.locator('[data-of-drawer-open]').click();
  const drawer = page.locator('#of-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveScreenshot('drawer.png');
});

test('quick filter bar', async ({ page }) => {
  settings({ 'openfilter/display/quick_bar_size': '6' });
  await open(page);
  await expect(page.locator('nav.of-quick')).toHaveScreenshot('quick-bar.png');
});

test('load more', async ({ page }) => {
  settings({ 'openfilter/display/pagination': 'load_more' });
  await open(page);
  const button = page.locator('.of-more-products');
  await button.scrollIntoViewIfNeeded();
  await expect(button).toHaveScreenshot('load-more.png');
});
