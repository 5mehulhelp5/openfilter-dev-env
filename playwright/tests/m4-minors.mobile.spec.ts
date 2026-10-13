import { test, expect } from './fixture';

/**
 * M4 S4 (M3 deferred minors) on phones: a browser without a modal <dialog> (Safari < 15.4) keeps the filters in place
 * (no drawer, no Filter button) and filtering still works.
 */
const CATEGORY = '/women/tops-women.html';

test('without HTMLDialogElement.showModal the filters stay inline on a phone and still filter', async ({ page }) => {
  await page.addInitScript(() => {
    delete (HTMLDialogElement.prototype as unknown as { showModal?: unknown }).showModal;
  });
  await page.goto(CATEGORY);

  await expect(page.locator('html')).toHaveClass(/\bof-inline\b/);
  await expect(page.locator('#of-filters')).toBeVisible();
  await expect(page.locator('[data-of-drawer-open]')).toBeHidden();

  const group = page.locator('#of-filters [data-of-group="color"]');
  if (await group.getAttribute('open') === null) {
    await group.locator(':scope > summary').click();
  }
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await group.locator('a[data-of-link]').first().click();
  await done;
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);
  await expect(page.locator('#of-filters')).toBeVisible();
});

test('with a modal <dialog> the phone layout keeps the drawer (no regression)', async ({ page }) => {
  await page.goto(CATEGORY);
  await expect(page.locator('html')).not.toHaveClass(/\bof-inline\b/);
  await expect(page.locator('#of-drawer')).toBeHidden();
  await expect(page.locator('[data-of-drawer-open]')).toBeVisible();
});
