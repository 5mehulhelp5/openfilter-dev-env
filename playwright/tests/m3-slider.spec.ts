import { Page } from '@playwright/test';
import { test, expect } from './fixture';
import { openGroup, productTotal } from './helpers';

/**
 * M3 S5: the price slider (10 FE7, 08 §4): keyboard (arrows one step, Page Up/Down ten steps), typed values with
 * Enter, applied on release through the AJAX layer, focus kept on the control, store locale formatting.
 */
const CATEGORY = '/women/tops-women.html';

async function swapped(page: Page, action: () => Promise<void>): Promise<void> {
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await action();
  await done;
}

test('keyboard: arrows and Page Up move the lower thumb, the range applies, focus stays on the thumb', async ({ page, request }) => {
  await page.goto(CATEGORY);
  const price = await openGroup(page, 'price');
  const from = price.locator('[data-of-range="from"]');
  const min = Number(await from.getAttribute('min'));
  const step = Number(await from.getAttribute('step'));
  const max = Number(await from.getAttribute('max'));

  await from.focus();
  await swapped(page, async () => {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('PageUp');
  });

  const expected = `price=${min + 12 * step}-${max}`;
  expect(page.url()).toContain(expected);
  await expect(page.locator('#of-filters [data-of-group="price"] [data-of-range="from"]')).toBeFocused();
  await expect(page.locator('#of-state a.of-chip', { hasText: 'Price' })).toBeVisible();
  expect(productTotal(await page.content())).toBe(productTotal(await (await request.get(page.url())).text()));
});

test('typed values apply with Enter; the full range removes the filter', async ({ page }) => {
  await page.goto(CATEGORY);
  const price = await openGroup(page, 'price');
  const max = await price.locator('[data-of-number="to"]').getAttribute('max');
  await price.locator('[data-of-number="from"]').fill('30');
  await swapped(page, () => price.locator('[data-of-number="from"]').press('Enter'));
  expect(page.url()).toContain(`price=30-${max}`);

  const again = page.locator('#of-filters [data-of-group="price"]');
  const min = await again.locator('[data-of-number="from"]').getAttribute('min');
  await again.locator('[data-of-number="from"]').fill(min!);
  await swapped(page, () => again.locator('[data-of-number="from"]').press('Enter'));
  expect(page.url()).not.toContain('price=');
});

test('the slider shows the range in the store locale (German store view)', async ({ page }) => {
  await page.goto(`${CATEGORY}?___store=de`);
  const price = await openGroup(page, 'price');
  await expect(price.locator('[data-of-output]')).toHaveText(/^\d+,\d{2}\s€ – \d+,\d{2}\s€$/);
});
