import { test, expect } from './fixture';
import { collectCspViolations, openGroup, productTotal } from './helpers';

/**
 * M3 S2: option templates per display mode on Hyvä 1.4.2 and 1.5.2: swatches (SVG colours, visible labels), text
 * swatches, rating, yes/no switches, category drill-down, "Show more" and the search box.
 */
const CATEGORY = '/women/tops-women.html';

test('colour swatches: SVG fills without inline styles, a visible label and count, selection ring after a click', async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.goto(CATEGORY);
  const colour = await openGroup(page, 'color');
  const black = colour.locator('a.of-swatch', { hasText: 'Black' });
  await expect(black.locator('svg rect')).toHaveAttribute('fill', '#000000');
  await expect(black.locator('.of-swatch__label')).toBeVisible();
  expect(await colour.locator('[style]').count(), 'no inline styles').toBe(0);
  const count = Number(await black.locator('.of-swatch__count').evaluate((el) => el.firstChild?.textContent ?? '0'));

  await black.click();
  const selected = page.locator('#of-filters [data-of-group="color"] a.of-swatch--selected');
  await expect(selected).toHaveCount(1);
  await expect(selected).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#of-state a.of-chip')).toContainText('Black');
  expect(productTotal(await page.content())).toBe(count);
  expect(violations).toEqual([]);
});

test('size is a text swatch, rating shows stars, Yes/No attributes are one switch, categories have no check box', async ({ page }) => {
  await page.goto(CATEGORY);
  for (const key of ['size', 'rating', 'eco_collection', 'cat']) {
    await openGroup(page, key);
  }
  await expect(page.locator('[data-of-group="size"] a.of-swatch .of-swatch__text').first()).toHaveText(/^(XS|S|M|L|XL)$/);
  await expect(page.locator('[data-of-group="rating"] a.of-option').first()).toContainText('4 stars & up');
  await expect(page.locator('[data-of-group="rating"] a.of-option').first().locator('svg.of-star--on')).toHaveCount(4);
  await expect(page.locator('[data-of-group="eco_collection"] a.of-toggle')).toHaveCount(1);
  await expect(page.locator('[data-of-group="eco_collection"] a.of-toggle .of-option__label')).toHaveText('Yes');
  await expect(page.locator('[data-of-group="cat"] .of-option__check')).toHaveCount(0);
});

test('rating "4 stars & up" filters to its count', async ({ page }) => {
  await page.goto(CATEGORY);
  const four = page.locator('[data-of-group="rating"] a.of-option').first();
  const count = Number(await four.locator('.of-option__count').evaluate((el) => el.firstChild?.textContent ?? '0'));
  await page.goto((await four.getAttribute('href'))!);
  await expect(page.locator('[data-of-group="rating"] a.of-option--selected')).toContainText('4 stars & up');
  expect(productTotal(await page.content())).toBe(count);
});

test('"Show more" opens the remaining options from the keyboard and reads "Show less" when open', async ({ page }) => {
  await page.goto(CATEGORY);
  const more = (await openGroup(page, 'color')).locator('details.of-more');
  const hidden = await more.locator('a.of-swatch').count();
  expect(hidden).toBeGreaterThan(0);
  await expect(more.locator('.of-more__show')).toHaveText(`Show more (${hidden})`);
  await expect(more.locator('.of-more__hide')).toBeHidden();
  await expect(more.locator('a.of-swatch').first()).toBeHidden();

  await more.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(more.locator('a.of-swatch').first()).toBeVisible();
  await expect(more.locator('.of-more__hide')).toHaveText('Show less');
  await expect(more.locator('.of-more__show')).toBeHidden();
});

test('long lists show a search box with JavaScript on', async ({ page }) => {
  await page.goto(CATEGORY);
  await expect((await openGroup(page, 'material')).locator('input.of-search__input')).toBeVisible();
});
