import { test, expect, magento, isHyva15 } from './fixture';
import { collectCspViolations, firstProductUrl } from './helpers';

/** Sample-data category present in every fixture build. */
const CATEGORY = '/women/tops-women.html';

test.describe('fixture store baseline', () => {
  test('home page renders the Hyvä theme behind Varnish with CSP enforced', async ({ page, request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['content-security-policy'], 'CSP must be in enforce mode on the storefront').toBeDefined();
    expect(headers['content-security-policy-report-only']).toBeUndefined();
    // Warden's Varnish keeps Via/X-Varnish; Magento's own VCL (CI) strips them, and the CI VCL adds X-Cache.
    expect(headers['via'] ?? headers['x-varnish'] ?? headers['x-cache'], 'Varnish must be in front of the store').toBeDefined();

    const violations = collectCspViolations(page);
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('class', /hyva-theme|cms-index-index/);
    expect(violations).toEqual([]);
  });

  test('category listing shows product cards and layered navigation', async ({ page }) => {
    const violations = collectCspViolations(page);
    await page.goto(CATEGORY);
    expect(await page.locator('.product-item').count()).toBeGreaterThan(0);
    await expect(page.locator('.product-item').first().locator('a.product-item-photo img')).toBeVisible();
    await expect(page.locator('[role="region"].block .filter-option').first()).toBeAttached();
    expect(violations).toEqual([]);
  });

  test('search results page shows product cards', async ({ page }) => {
    const violations = collectCspViolations(page);
    await page.goto('/catalogsearch/result/?q=jacket');
    expect(await page.locator('.product-item').count()).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  test('product page renders the Hyvä gallery container', async ({ page }) => {
    const violations = collectCspViolations(page);
    await page.goto(await firstProductUrl(page, CATEGORY));
    await expect(page.locator('#gallery-main')).toBeVisible();
    if (isHyva15()) {
      await expect(page.locator('#gallery-main img').first()).toBeVisible();
    } else {
      await expect(page.locator('#gallery-main img').first()).toHaveAttribute('width', /\d+/);
    }
    expect(violations).toEqual([]);
  });

  test('German store view serves German colour option labels', async ({ page }) => {
    await page.goto(`${CATEGORY}?___store=de`);
    // Swatch labels live in attributes and JSON config, not in visible text.
    expect(await page.content()).toMatch(/Schwarz|Grün|Weiß|Blau/);
  });

  test('OpenLabel and the shared base module are installed next to OpenFilter', async () => {
    const status = magento('module:status', 'Iranimij_Base', 'Iranimij_OpenLabel', 'Iranimij_OpenLabelHyva');
    expect(status).not.toMatch(/disabled/i);
  });
});
