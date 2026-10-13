import { test, expect, hyvaThemeVersion } from './fixture';
import { openFilterGroup } from './helpers';

/**
 * Pins the stock Hyvä layered navigation markup OpenFilter replaces and the regions it wraps
 * (docs/hyva-integration.md in iranimij/openfilter). If Hyvä changes these, this spec fails first.
 * Skipped once OpenFilter's own templates are active (M3 replaces the block's template).
 */
const CATEGORY = '/women/tops-women.html';
const isHyva15 = (): boolean => {
  const [major, minor] = hyvaThemeVersion();
  return major > 1 || (major === 1 && minor >= 5);
};

test.describe('stock Hyvä layered navigation (M0 verification)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CATEGORY);
    test.skip(await page.locator('#of-filters').count() > 0, 'OpenFilter templates are active');
  });

  test('filter block is a labelled region in the sidebar with one .filter-option per filter', async ({ page }) => {
    const region = page.locator('.sidebar [role="region"][aria-label="Product filters"]');
    await expect(region).toHaveCount(1);
    expect(await region.locator('.filter-option').count()).toBeGreaterThan(2);
    await expect(region.locator('#filters-content')).toBeAttached();
  });

  test('option links: 1.4 renders them only after a group is opened (x-if), 1.5 keeps them in the DOM (details)', async ({ page }) => {
    const firstGroup = page.locator('.filter-option').first();
    if (isHyva15()) {
      await expect(firstGroup).toHaveJSProperty('tagName', 'DETAILS');
      expect(await firstGroup.locator('.filter-options-content a[href]').count()).toBeGreaterThan(0);
    } else {
      expect(await firstGroup.locator('a[href]').count(), 'closed group has no links in the DOM').toBe(0);
      await openFilterGroup(firstGroup);
      await expect(firstGroup.locator('.filter-options-content a[href]').first()).toBeAttached();
    }
  });

  test('product list section, toolbar and pager are inside #product-list', async ({ page }) => {
    const list = page.locator('section#product-list');
    await expect(list).toHaveCount(1);
    await expect(list.locator('.toolbar-products').first()).toBeAttached();
    await expect(list.locator('.products.wrapper .product-item').first()).toBeVisible();
  });

  test('swatch filter links carry rel=nofollow and an aria-label but no visible text for colours', async ({ page }) => {
    await openFilterGroup(page.locator('.filter-option', { hasText: /Color/ }).first());
    // 1.4: a.swatch-option-link-layered with an empty body; 1.5: a.swatch-option (SwatchRenderer view model) with
    // the colour code as sr-only text.
    const link = page.locator('.swatch-layered a.swatch-option-link-layered, [x-data="initLayeredSwatch"] a.swatch-option').first();
    await expect(link).toHaveAttribute('rel', 'nofollow');
    await expect(link).toHaveAttribute('aria-label', /Filter Color /);
    const visibleText = await link.evaluate((el) => [...el.querySelectorAll('*')]
      .filter((child) => !child.classList.contains('sr-only') && child.children.length === 0)
      .map((child) => child.textContent ?? '').join('').trim() || (el.children.length === 0 ? el.textContent ?? '' : '').trim());
    expect(visibleText, 'colour swatches have no visible text').toBe('');
  });

  test('Alpine 3 is on the page', async ({ page }) => {
    const version = await page.evaluate(() => (window as unknown as { Alpine?: { version: string } }).Alpine?.version ?? '');
    expect(version).toMatch(/^3\./);
  });
});
