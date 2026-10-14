import { Page } from '@playwright/test';
import { test, expect } from './fixture';

/**
 * 08 §7 "Keyboard only: open a group, select an option, move a slider, remove a chip", as one journey without a
 * pointer: Enter opens a closed group, Tab reaches its first option, Enter selects it, arrow keys move the price
 * slider, Enter on a chip removes it. Every step updates the results in place.
 */
const CATEGORY = '/women/tops-women.html';

async function swapped(page: Page, action: () => Promise<void>): Promise<void> {
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await action();
  await done;
}

test('keyboard only: open a group, select an option, move the slider, remove a chip', async ({ page }) => {
  await page.goto(CATEGORY);
  const material = page.locator('#of-filters [data-of-group="material"]');
  await expect(material).not.toHaveAttribute('open');

  await material.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(material).toHaveAttribute('open');

  // Long lists put their search box first; Tab on to the first option.
  for (let i = 0; i < 3 && !(await page.evaluate(() => document.activeElement?.hasAttribute('data-of-link'))); i++) {
    await page.keyboard.press('Tab');
  }
  const option = page.locator(':focus');
  await expect(option).toHaveAttribute('data-of-link');
  const value = await option.getAttribute('data-of-value');
  await swapped(page, () => page.keyboard.press('Enter'));
  await expect(page.locator(`#of-filters [data-of-group="material"] a[data-of-value="${value}"]`)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);

  const price = page.locator('#of-filters [data-of-group="price"]');
  if (await price.getAttribute('open') === null) {
    await price.locator(':scope > summary').focus();
    await page.keyboard.press('Enter');
  }
  await price.locator('[data-of-range="from"]').focus();
  await swapped(page, () => page.keyboard.press('PageUp'));
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(2);

  await page.locator('#of-state a.of-chip').first().focus();
  await swapped(page, () => page.keyboard.press('Enter'));
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);
});
