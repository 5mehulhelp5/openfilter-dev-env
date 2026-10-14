import { test, expect, magento } from '../fixture';

/**
 * README install gate (07 §6): on a fresh store where OpenFilter was installed only with the README's commands, the
 * README's quick start holds: filters with counts, results update in place with a readable URL, and
 * `openfilter:doctor` finds no failure.
 */
const CATEGORY = '/women/tops-women.html';

test('quick start: filters update the results in place with a readable URL', async ({ page }) => {
  await page.goto(CATEGORY);
  await expect(page.locator('#of-filters details.of-group').first()).toBeVisible();
  await page.evaluate(() => { (window as unknown as { ofMarker: number }).ofMarker = 1; });
  const group = page.locator('#of-filters [data-of-group="color"]');
  if (await group.getAttribute('open') === null) {
    await group.locator(':scope > summary').click();
  }
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await group.locator('a[data-of-link]').first().click();
  await done;

  expect(page.url()).toMatch(/\?color=[a-z0-9-]+$/);
  expect(await page.evaluate(() => (window as unknown as { ofMarker?: number }).ofMarker)).toBe(1);
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);
});

test('quick start: openfilter:doctor finds no failure', () => {
  const report = JSON.parse(magento('openfilter:doctor', '--format=json'));
  expect(report.passed, JSON.stringify(report.sections.OpenFilter)).toBe(true);
});
