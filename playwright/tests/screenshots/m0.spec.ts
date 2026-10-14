import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { openAdmin } from '../admin/admin';

/**
 * Screenshots for the M0 milestone report, written to docs/m0-screenshots. Not a test gate: runs only with
 * OF_SCREENSHOTS=1 (project "screenshots-chromium").
 */
const OUT = resolve(__dirname, '../../../docs/m0-screenshots');

test('admin: OpenFilter section under the Iranimij tab of the shared base module', async ({ page }) => {
  await openAdmin(page, 'admin/system_config/edit/section/openfilter/');
  for (const group of ['general', 'search']) {
    const head = page.locator(`a[href="#openfilter_${group}-link"]`);
    await expect(head).toBeVisible();
    if (!(await head.getAttribute('class') ?? '').includes('open')) {
      await head.click();
    }
  }
  await expect(page.locator('#openfilter_search_count_strategy')).toBeVisible();
  await page.screenshot({ path: `${OUT}/admin-config-openfilter-section.png`, fullPage: true });
});

test('admin: Installed Modules page of the shared base module lists OpenFilter', async ({ page }) => {
  await openAdmin(page, 'iranimij_base/modules/index/');
  await expect(page.locator('body')).toContainText('iranimij/openfilter');
  await page.screenshot({ path: `${OUT}/admin-installed-modules.png`, fullPage: true });
});

test('storefront: stock Hyvä 1.4.2 category page OpenFilter will replace', async ({ browser }) => {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 412, height: 915 }]] as const) {
    const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true, storageState: undefined });
    const page = await context.newPage();
    await page.goto('/women/tops-women.html');
    await page.screenshot({ path: `${OUT}/storefront-category-hyva-${name}.png` });
    await context.close();
  }
});
