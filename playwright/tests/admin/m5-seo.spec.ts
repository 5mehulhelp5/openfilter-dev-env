import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { collectCspViolations, decodeEntities, openGroup } from '../helpers';
import { magento, sql, uncached } from './admin';

/**
 * M5 S7: title, meta description and H1 templates of filtered category pages on the default store view. After every
 * AJAX swap the title, description and H1 equal a direct load of the same URL; a page without filters goes back to
 * Magento's. Runs in the serial admin project because it changes settings for the store view; restored afterwards.
 */
const TOPS = '/women/tops-women.html';
const TEMPLATES: Record<string, string> = {
  'openfilter/seo/meta_title': '{filters} {category} | {store}',
  'openfilter/seo/meta_description': 'Shop {filters} {category} at {store}.',
  'openfilter/seo/h1': '{filters} {category}',
};

function setting(path: string, value: string | null): void {
  sql(`DELETE FROM core_config_data WHERE path = '${path}' AND scope = 'stores'
       AND scope_id = (SELECT store_id FROM store WHERE code = 'default')`);
  if (value !== null) {
    sql(`INSERT INTO core_config_data (scope, scope_id, path, value)
         SELECT 'stores', store_id, '${path}', '${value}' FROM store WHERE code = 'default'`);
  }
}

function clean(): void {
  magento('cache:clean', 'config', 'full_page');
}

interface Texts { title: string; description: string | null; heading: string }

async function live(page: Page): Promise<Texts> {
  return page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
    heading: (document.querySelector('[data-ui-id="page-title-wrapper"]')?.textContent ?? '').trim(),
  }));
}

function html(markup: string): Texts {
  const match = (pattern: RegExp) => { const m = pattern.exec(markup); return m ? decodeEntities(m[1]) : null; };
  return {
    title: (match(/<title>([^<]*)<\/title>/) ?? '').trim(),
    description: match(/<meta name="description" content="([^"]*)"/),
    heading: (match(/data-ui-id="page-title-wrapper"[^>]*>([^<]*)</) ?? '').trim(),
  };
}

async function directLoad(page: Page, request: APIRequestContext): Promise<Texts> {
  return html(await (await request.get(uncached(page.url()))).text());
}

async function swapped(page: Page, action: () => Promise<void>): Promise<void> {
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await action();
  await done;
}

const colourLink = (page: Page, label: string) => page.locator('#of-filters [data-of-group="color"] a.of-swatch')
  .filter({ has: page.locator('.of-swatch__label', { hasText: new RegExp(`^${label}$`) }) });

test.beforeAll(() => {
  Object.entries(TEMPLATES).forEach(([path, value]) => setting(path, value));
  clean();
});

test.afterAll(() => {
  Object.keys(TEMPLATES).forEach((path) => setting(path, null));
  clean();
});

test('templates on filtered pages follow every swap like a direct load; no filters = Magento\'s', async ({ page, request }) => {
  const csp = collectCspViolations(page);
  await page.goto(uncached(TOPS), { waitUntil: 'networkidle' });
  const plain = await live(page);
  expect(plain.heading).toBe('Tops');
  expect(plain.title).not.toContain('|');

  await openGroup(page, 'color');
  await swapped(page, () => colourLink(page, 'Black').click());
  const black = await live(page);
  expect(black.heading).toBe('Black Tops');
  expect(black.title).toMatch(/^Black Tops \| /);
  expect(black.description).toMatch(/^Shop Black Tops at .+\.$/);
  expect(black).toEqual(await directLoad(page, request));

  await swapped(page, () => colourLink(page, 'Blue').click());
  const two = await live(page);
  expect(two.heading).toMatch(/^(Black, Blue|Blue, Black) Tops$/);
  expect(two).toEqual(await directLoad(page, request));

  await swapped(page, () => page.locator('#of-state a.of-chip', { hasText: 'Blue' }).click());
  await swapped(page, () => page.locator('#of-state a.of-chip', { hasText: 'Black' }).click());
  expect(await live(page)).toEqual(plain);
  expect(csp).toEqual([]);
});

test('JavaScript off: a filtered page carries the templates in its HTML', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, ignoreHTTPSErrors: true, baseURL: String(test.info().project.use.baseURL) });
  const page = await context.newPage();
  await page.goto(uncached(`${TOPS}?color=black`));

  await expect(page.locator('[data-ui-id="page-title-wrapper"]')).toHaveText('Black Tops');
  await expect(page).toHaveTitle(/^Black Tops \| /);
  await context.close();
});
