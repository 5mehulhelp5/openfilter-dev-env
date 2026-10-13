import { test, expect } from './fixture';
import { productTotal } from './helpers';

/** M3 S7 on a phone: the drawer works on search results and keeps the query. */
test('search results on a phone: drawer, staged filter, Apply keeps the query', async ({ page }) => {
  await page.goto('/catalogsearch/result/?q=jacket');
  await page.locator('[data-of-drawer-open]').click();
  const group = page.locator('#of-drawer details.of-group:not(.of-group--category):not(.of-group--slider)').first();
  if (await group.getAttribute('open') === null) {
    await group.locator(':scope > summary').click();
  }
  await group.locator('a[data-of-link]').first().click();
  await expect(page.locator('#of-drawer a[aria-current="true"]')).toHaveCount(1);
  await expect(page.locator('[data-of-drawer-apply]')).not.toHaveAttribute('aria-busy', 'true');
  const staged = Number((/(\d+)/.exec(await page.locator('[data-of-drawer-apply]').innerText()) ?? ['', '0'])[1]);

  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await page.locator('[data-of-drawer-apply]').click();
  await done;
  expect(page.url()).toContain('q=jacket');
  expect(productTotal(await page.content())).toBe(staged);
});
