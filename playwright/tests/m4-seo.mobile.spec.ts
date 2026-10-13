import { Page } from '@playwright/test';
import { test, expect } from './fixture';
import { htmlHead, liveHead } from './seo-head';

/** M4 S1 on phones: Apply in the drawer swaps the prefetched page, head included. */
const CATEGORY = '/women/tops-women.html';

async function stage(page: Page, label: string): Promise<void> {
  const details = page.locator('#of-drawer [data-of-group="color"]');
  if (await details.getAttribute('open') === null) {
    await details.locator(':scope > summary').click();
  }
  await details.locator('a[data-of-link]').filter({ has: page.locator('[class$="__label"]', { hasText: new RegExp(`^${label}$`) }) }).click();
  await expect(details.locator('a[aria-current="true"]', { hasText: label })).toBeVisible();
  await expect(page.locator('[data-of-drawer-apply]')).not.toHaveAttribute('aria-busy', 'true');
}

test('Apply in the drawer brings the head of the applied URL', async ({ page, request }) => {
  await page.goto(CATEGORY);
  await page.locator('[data-of-drawer-open]').click();
  await stage(page, 'Black');
  await stage(page, 'Blue');
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await page.locator('[data-of-drawer-apply]').click();
  await done;

  expect(page.url()).toContain('color=black,blue');
  expect(await liveHead(page)).toEqual(htmlHead(await (await request.get(page.url())).text()));
  expect((await liveHead(page)).robots).toBe('NOINDEX,FOLLOW');
});
