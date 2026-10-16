import { test, expect } from './fixture';
import { axeOpenFilter } from './axe';
import { openGroup } from './helpers';

/** M3 acceptance (07 §6, 10): axe-core on load, with groups open and after a swap; CSP is enforced. */
test('axe: no violations in OpenFilter regions on load, with groups open, and after a swap', async ({ page }) => {
  await page.goto('/women/tops-women.html?color=blue&price=20-60');
  await axeOpenFilter(page, 'load');
  for (const key of ['color', 'material', 'rating']) {
    await openGroup(page, key);
  }
  await (await openGroup(page, 'material')).locator('details.of-more > summary').click();
  await axeOpenFilter(page, 'groups open');
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await (await openGroup(page, 'material')).locator('a[data-of-link]').first().click();
  await done;
  await axeOpenFilter(page, 'after swap');
});

test('the storefront answers with an enforced Content-Security-Policy (not report-only)', async ({ request }) => {
  const response = await request.get('/women/tops-women.html');
  const headers = response.headers();
  expect(headers['content-security-policy']).toBeTruthy();
  expect(headers['content-security-policy-report-only']).toBeUndefined();
});
