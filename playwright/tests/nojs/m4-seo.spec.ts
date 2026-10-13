import { test, expect } from '../fixture';
import { canonicalCount, htmlHead } from '../seo-head';

/**
 * M4 S1 without JavaScript: what a crawler sees. Robots and one canonical in the HTML, rel="nofollow" on option links
 * from two active values, the 302 of the max values guard.
 */
const CATEGORY = '/women/tops-women.html';

test('crawler view: indexable single colour, not indexable pair, nofollow links, one canonical', async ({ page }) => {
  await page.goto(`${CATEGORY}?color=black`);
  let html = await page.content();
  expect(htmlHead(html)).toEqual({ robots: 'INDEX,FOLLOW', canonical: expect.stringMatching(/\?color=black$/) });
  expect(await page.locator('#of-filters a[data-of-link][rel="nofollow"]').count()).toBe(0);

  await page.goto(`${CATEGORY}?color=black,blue`);
  html = await page.content();
  expect(htmlHead(html)).toEqual({ robots: 'NOINDEX,FOLLOW', canonical: expect.stringMatching(/tops-women\.html$/) });
  expect(canonicalCount(html)).toBe(1);
  expect(await page.locator('#of-filters a[data-of-link]:not([aria-current])[rel="nofollow"]').count()).toBeGreaterThan(0);
});

test('following a link past five values ends on the first five, not indexed', async ({ page }) => {
  const response = await page.goto(`${CATEGORY}?color=black,blue,brown,gray,green,yellow`);
  expect(response?.request().redirectedFrom()).not.toBeNull();
  expect(new URL(page.url()).search).toBe('?color=black,blue,brown,gray,green');
  expect(htmlHead(await page.content()).robots).toBe('NOINDEX,FOLLOW');
});
