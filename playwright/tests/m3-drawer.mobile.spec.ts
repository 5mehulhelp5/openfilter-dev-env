import { Page, devices } from '@playwright/test';
import { test, expect } from './fixture';
import { productTotal } from './helpers';

/**
 * M3 S6: the mobile drawer (08 §3, 08 §7, 10 FE8): staged changes with a prefetched "Show N products", Apply
 * without another request, closing discards, Back closes the drawer first, Escape returns the focus.
 */
const CATEGORY = '/women/tops-women.html';

async function openDrawer(page: Page): Promise<void> {
  await page.goto(CATEGORY);
  await page.evaluate(() => { (window as unknown as { ofMarker: number }).ofMarker = 1; });
  await expect(page.locator('#of-drawer'), 'filters hidden behind the button').toBeHidden();
  await page.locator('[data-of-drawer-open]').click();
  await expect(page.locator('#of-drawer[data-of-modal]')).toBeVisible();
}

async function stageOption(page: Page, group: string, label: string): Promise<number> {
  const details = page.locator(`#of-drawer [data-of-group="${group}"]`);
  if (await details.getAttribute('open') === null) {
    await details.locator(':scope > summary').click();
  }
  const link = details.locator('a[data-of-link]').filter({ has: page.locator('[class$="__label"]', { hasText: new RegExp(`^${label}$`) }) });
  const count = Number(await link.locator('[class$="__count"]').evaluate((el) => el.firstChild?.textContent ?? '0'));
  await link.click();
  await expect(page.locator(`#of-drawer [data-of-group="${group}"] a[aria-current="true"]`, { hasText: label })).toBeVisible();
  await expect(page.locator('[data-of-drawer-apply]')).not.toHaveAttribute('aria-busy', 'true');
  return count;
}

const footerCount = async (page: Page) => Number((/(\d+)/.exec(await page.locator('[data-of-drawer-apply]').innerText()) ?? ['', '0'])[1]);

test('Filter button opens the drawer; staged changes update "Show N products"; Apply shows N products without a request', async ({ page }) => {
  await openDrawer(page);
  const before = page.url();
  expect(await footerCount(page)).toBe(productTotal(await page.content()));

  const black = await stageOption(page, 'color', 'Black');
  expect(await footerCount(page)).toBe(black);
  await stageOption(page, 'color', 'Blue');
  const staged = await footerCount(page);
  expect(page.url(), 'staged, not applied').toBe(before);

  const requests: string[] = [];
  page.on('request', (r) => { if (r.resourceType() === 'fetch' || r.resourceType() === 'document') requests.push(r.url()); });
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await page.locator('[data-of-drawer-apply]').click();
  await done;

  expect(requests, 'Apply swaps the prefetched page').toEqual([]);
  await expect(page.locator('#of-drawer')).toBeHidden();
  expect(page.url()).toContain('color=black,blue');
  expect(productTotal(await page.content())).toBe(staged);
  await expect(page.locator('[data-of-drawer-open]')).toHaveText(/Filter \(2\)/);
  expect(await page.evaluate(() => (window as unknown as { ofMarker?: number }).ofMarker)).toBe(1);
});

test('closing without Apply discards the staged changes', async ({ page }) => {
  await openDrawer(page);
  const before = page.url();
  await stageOption(page, 'color', 'Black');
  await page.locator('[data-of-drawer-close]').click();

  await expect(page.locator('#of-drawer')).toBeHidden();
  expect(page.url()).toBe(before);
  await page.locator('[data-of-drawer-open]').click();
  await expect(page.locator('#of-drawer a[aria-current="true"]')).toHaveCount(0);
});

test('Back closes the drawer first and stays on the page', async ({ page }) => {
  await openDrawer(page);
  const before = page.url();
  await page.goBack();
  await expect(page.locator('#of-drawer')).toBeHidden();
  expect(page.url()).toBe(before);
  expect(await page.evaluate(() => (window as unknown as { ofMarker?: number }).ofMarker)).toBe(1);
});

test('Escape closes the drawer and the focus returns to the Filter button; Tab stays inside while open', async ({ page }) => {
  await openDrawer(page);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
  }
  expect(await page.evaluate(() => document.activeElement?.closest('#of-drawer') !== null), 'focus trapped').toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#of-drawer')).toBeHidden();
  await expect(page.locator('[data-of-drawer-open]')).toBeFocused();
});

test('without JavaScript a phone shows the full filter list and no Filter button', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    javaScriptEnabled: false,
    ignoreHTTPSErrors: true,
    baseURL: testInfo.project.use.baseURL,
    storageState: testInfo.project.use.storageState as string | undefined,
  });
  const page = await context.newPage();
  await page.goto(CATEGORY);
  await expect(page.locator('#of-filters .of-group').first()).toBeVisible();
  await expect(page.locator('[data-of-drawer-open]')).toBeHidden();
  await context.close();
});
