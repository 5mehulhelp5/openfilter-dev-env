import { test, expect } from './fixture';
import { collectCspViolations, decodeEntities, filterOptionLinks, productTotal as total, swatchLinks } from './helpers';

/**
 * M1 on the stock Hyvä templates: readable multi-select filter URLs, options of an active filter stay listed with
 * disjunctive counts, swatch links add values, non-canonical URLs answer 301, the German store view has its own
 * URL names. (OpenFilter's own templates, AJAX and the slider arrive in M3.)
 */
const CATEGORY = '/women/tops-women.html';

test('two values of one filter: other values keep counts, selected values link to their removal', async ({ request }) => {
  const html = await (await request.get(`${CATEGORY}?climate=cold,indoor`)).text();
  const climate = filterOptionLinks(html).filter((o) => /[?&]climate=/.test(o.href));
  const byLabel = new Map(climate.map((o) => [o.label, o]));

  expect(byLabel.get('Cold')?.href, 'Cold is selected: its link removes it').toMatch(/[?&]climate=indoor(&|$)/);
  expect(byLabel.get('Indoor')?.href).toMatch(/[?&]climate=cold(&|$)/);
  const warm = byLabel.get('Warm');
  expect(warm, 'unselected values of the active filter stay listed').toBeDefined();
  expect(warm!.count).toBeGreaterThan(0);
  expect(warm!.href).toContain('climate=cold,indoor,warm');

  const before = total(html);
  const after = total(await (await request.get(warm!.href)).text());
  expect(after, 'OR within the filter: adding a value never shrinks the result').toBeGreaterThanOrEqual(Math.max(before, warm!.count));
});

test('colour swatches add values in canonical order and remove selected ones', async ({ request }) => {
  const html = await (await request.get(`${CATEGORY}?color=blue`)).text();
  const swatches = swatchLinks(html);

  expect(swatches.length).toBeGreaterThan(1);
  expect(swatches.some((href) => /[?&]color=blue,red(&|$)/.test(href)), 'red adds to blue').toBe(true);
  expect(swatches.some((href) => href.endsWith(CATEGORY)), 'selected blue links to its removal').toBe(true);
});

test('non-canonical filter URLs answer 301 to the canonical one', async ({ request }) => {
  const order = await request.get(`${CATEGORY}?color=red,blue&product_list_order=name`, { maxRedirects: 0 });
  expect(order.status()).toBe(301);
  expect(order.headers()['location']).toMatch(/\?color=blue,red&product_list_order=name$/);

  const junk = await request.get(`${CATEGORY}?color=nonsense&p=2`, { maxRedirects: 0 });
  expect(junk.status()).toBe(301);
  expect(junk.headers()['location']).toMatch(new RegExp(`${CATEGORY.replace(/\./g, '\\.')}$`));

  const canonical = await request.get(`${CATEGORY}?color=blue,red`, { maxRedirects: 0 });
  expect(canonical.status()).toBe(200);
});

test('German store view: German URL names, same products', async ({ request }) => {
  const german = decodeEntities(await (await request.get(`${CATEGORY}?___store=de`)).text());
  expect(german).toMatch(/[?&]color=gruen(&|")/);
  expect(german).toMatch(/[?&]color=weiss(&|")/);

  const rot = total(await (await request.get(`${CATEGORY}?___store=de&color=rot`)).text());
  const red = total(await (await request.get(`${CATEGORY}?color=red`)).text());
  expect(rot).toBeGreaterThan(0);
  expect(rot).toBe(red);
});

test('filtered page in the browser: no CSP errors, the product count matches the URL', async ({ page, request }) => {
  const violations = collectCspViolations(page);
  const url = `${CATEGORY}?color=blue,red&size=m`;
  const expected = total(await (await request.get(url)).text());

  await page.goto(url);
  await expect(page.locator('.toolbar-amount').first()).toContainText(String(expected));
  expect(expected).toBeGreaterThan(0);
  expect(violations).toEqual([]);
});
