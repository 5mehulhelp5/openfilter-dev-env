import { Page } from '@playwright/test';
import { test, expect } from './fixture';
import { openGroup } from './helpers';

/**
 * Review #1 (2026-10-15) fixes on desktop: Hyvä's product cards preselect the picked colour by option id and keep
 * their sizes available on filtered pages (OpenFilter's URLs carry URL names), a pick in the sidebar keeps the page
 * where it is, the product count shows next to the chips, price ranges read with an en dash.
 */
const CATEGORY = '/women/tops-women.html';

async function swapped(page: Page, action: () => Promise<void>): Promise<void> {
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await action();
  await done;
}

/** Colour id each product card selected, and whether a size is still available on it (first cards in view). */
async function cards(page: Page): Promise<Array<{ colour: string | null; picked: string | null; sizes: number }>> {
  await page.locator('[x-data^="initConfigurableSwatchOptions"]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  return page.evaluate(() => [...document.querySelectorAll('[x-data^="initConfigurableSwatchOptions"]')].slice(0, 3).map((el) => {
    const alpine = (window as unknown as { Alpine: { $data: (el: Element) => Record<string, any> } }).Alpine;
    const card = alpine.$data(el);
    const attributes = Object.values(card.optionConfig.attributes) as Array<{ id: string; code: string; options: Array<{ id: string; label: string }> }>;
    const colour = attributes.find((a) => a.code === 'color')!;
    const size = attributes.find((a) => a.code === 'size');
    const picked = card.selectedValues?.[colour.id] ?? null;
    const allowed = size ? (card.allowedAttributeOptions?.[size.id] ?? size.options) : [];
    return {
      colour: picked === null ? null : colour.options.find((o) => String(o.id) === String(picked))?.label ?? `invalid:${picked}`,
      picked: picked === null ? null : String(picked),
      sizes: allowed.length,
    };
  }));
}

test('product cards preselect the picked colour by id and keep their sizes', async ({ page }) => {
  await page.goto(`${CATEGORY}?color=black`);

  for (const card of await cards(page)) {
    expect(card.colour).toBe('Black');
    expect(card.sizes).toBeGreaterThan(0);
  }
});

test('after an AJAX pick the cards follow: the first picked colour each card has', async ({ page }) => {
  await page.goto(`${CATEGORY}?color=black`);
  const group = await openGroup(page, 'color');
  await swapped(page, () => group.locator('a.of-swatch', { has: page.locator('.of-swatch__label', { hasText: /^Blue$/ }) }).click());

  for (const card of await cards(page)) {
    expect(['Black', 'Blue']).toContain(card.colour);
    expect(card.sizes).toBeGreaterThan(0);
  }
});

test('a pick in the sidebar keeps the page where it is; the count shows next to the chips', async ({ page }) => {
  await page.goto(CATEGORY);
  const group = await openGroup(page, 'color');
  const swatch = group.locator('a.of-swatch').first();
  await swatch.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);

  await swapped(page, () => swatch.click());

  expect(Math.abs(await page.evaluate(() => window.scrollY) - before)).toBeLessThanOrEqual(2);
  await expect(page.locator('#of-state .of-state__list [data-of-count-text]')).toHaveText(/^\d+ products?$/);
  await expect(page.locator('#of-state .of-state__list [data-of-count-text]')).toHaveAttribute('aria-hidden', 'true');
});

test('price ranges read with an en dash', async ({ page }) => {
  await page.goto(`${CATEGORY}?price=20-50`);

  await expect(page.locator('#of-state .of-chip').first()).toContainText('–');
  await expect(page.locator('#of-state .of-chip').first()).not.toContainText(' - ');
});
