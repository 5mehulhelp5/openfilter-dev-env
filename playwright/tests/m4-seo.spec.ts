import { Page } from '@playwright/test';
import { test, expect } from './fixture';
import { openGroup } from './helpers';
import { canonicalCount, htmlHead, liveHead } from './seo-head';

/**
 * M4 S1: robots, canonical and nofollow (02 §4, 10 FE4). The fixture marks colour "Let Google index pages filtered by
 * this": one colour is indexable and its own canonical, anything more is NOINDEX,FOLLOW with the category as canonical.
 * After every AJAX swap the head equals a direct load of the same URL; a URL past the limit (5 values) is answered
 * with a 302 to the first five, which the AJAX layer follows.
 */
const CATEGORY = '/women/tops-women.html';

async function swapped(page: Page, action: () => Promise<void>): Promise<void> {
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await action();
  await done;
}

async function expectHeadOfDirectLoad(page: Page, request: import('@playwright/test').APIRequestContext): Promise<void> {
  const html = await (await request.get(page.url())).text();
  expect(canonicalCount(html), 'one canonical').toBeLessThanOrEqual(1);
  expect(await liveHead(page)).toEqual(htmlHead(html));
}

const colourLink = (page: Page, label: string) => page.locator('#of-filters [data-of-group="color"] a.of-swatch')
  .filter({ has: page.locator('.of-swatch__label', { hasText: new RegExp(`^${label}$`) }) });

test('indexable → not indexable → indexable: robots and canonical follow every swap', async ({ page, request }) => {
  await page.goto(CATEGORY);
  await openGroup(page, 'color');

  await swapped(page, () => colourLink(page, 'Black').click());
  expect(await liveHead(page)).toEqual({ robots: 'INDEX,FOLLOW', canonical: expect.stringMatching(/tops-women\.html\?color=black$/) });
  await expectHeadOfDirectLoad(page, request);

  await swapped(page, () => colourLink(page, 'Blue').click());
  expect(await liveHead(page)).toEqual({ robots: 'NOINDEX,FOLLOW', canonical: expect.stringMatching(/tops-women\.html$/) });
  await expectHeadOfDirectLoad(page, request);

  await swapped(page, () => page.locator('#of-state a.of-chip', { hasText: 'Blue' }).click());
  expect(await liveHead(page)).toEqual({ robots: 'INDEX,FOLLOW', canonical: expect.stringMatching(/\?color=black$/) });
  await expectHeadOfDirectLoad(page, request);
});

test('a filter not marked indexable and sorting: NOINDEX for the filter, canonical without the sort order', async ({ page, request }) => {
  await page.goto(`${CATEGORY}?color=black&product_list_order=name`);
  expect((await liveHead(page)).canonical).toMatch(/\?color=black$/);

  const size = (await openGroup(page, 'size')).locator('a.of-swatch').first();
  await swapped(page, () => size.click());
  expect((await liveHead(page)).robots).toBe('NOINDEX,FOLLOW');
  await expectHeadOfDirectLoad(page, request);
});

test('from two active values the other option links carry rel="nofollow"; removing links do not', async ({ page }) => {
  await page.goto(CATEGORY);
  await openGroup(page, 'color');
  await swapped(page, () => colourLink(page, 'Black').click());
  await expect(page.locator('#of-filters a[data-of-link][rel="nofollow"]')).toHaveCount(0);

  await swapped(page, () => colourLink(page, 'Blue').click());
  expect(await page.locator('#of-filters a[data-of-link]:not([aria-current])[rel="nofollow"]').count()).toBeGreaterThan(0);
  await expect(page.locator('#of-filters a[data-of-link][aria-current][rel="nofollow"]')).toHaveCount(0);
});

test('a sixth value is answered with a 302 to the first five; the swap lands there with NOINDEX', async ({ page, request }) => {
  const five = `${CATEGORY}?color=black,blue,brown,gray,green`;
  await page.goto(five);
  await openGroup(page, 'color');
  const sixth = page.locator('#of-filters [data-of-group="color"] a.of-swatch:not([aria-current]):visible').first();
  const href = (await sixth.getAttribute('href')) ?? '';
  const answer = await request.get(href, { maxRedirects: 0 });
  expect(answer.status()).toBe(302);
  expect(answer.headers()['x-robots-tag']).toBe('noindex');

  await swapped(page, () => sixth.click());
  expect(new URL(page.url()).search).toBe('?color=black,blue,brown,gray,green');
  expect(await liveHead(page)).toEqual({ robots: 'NOINDEX,FOLLOW', canonical: expect.stringMatching(/tops-women\.html$/) });
});

test('a non-canonical URL is normalised (301) before the page renders its head', async ({ page }) => {
  const response = await page.goto(`${CATEGORY}?color=BLACK`);
  expect(response?.request().redirectedFrom()?.url()).toContain('color=BLACK');
  expect(new URL(page.url()).search).toBe('?color=black');
  expect((await liveHead(page)).robots).toBe('INDEX,FOLLOW');
});
