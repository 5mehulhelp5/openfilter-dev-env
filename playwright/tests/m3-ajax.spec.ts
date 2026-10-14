import { Page } from '@playwright/test';
import { test, expect } from './fixture';
import { collectCspViolations, decodeEntities, openGroup, productTotal } from './helpers';

/**
 * M3 S4: same-URL AJAX on Hyvä 1.4.2 and 1.5.2 (08 §7, 10 FE2–FE5, FE10–FE11): no page load, disjunctive counts,
 * back/forward with scroll, head equal to a direct load, product cards alive after a swap, ≤ 300 ms on cached URLs.
 */
const CATEGORY = '/women/tops-women.html';

async function markPage(page: Page): Promise<void> {
  await page.evaluate(() => { (window as unknown as { ofMarker: number }).ofMarker = 1; });
}

async function swapped(page: Page, action: () => Promise<void>): Promise<void> {
  const done = page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
  await action();
  await done;
}

async function stillSamePage(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { ofMarker?: number }).ofMarker === 1);
}

async function count(link: import('@playwright/test').Locator): Promise<number> {
  return Number(await link.locator('[class$="__count"]').evaluate((el) => el.firstChild?.textContent ?? '0'));
}

test('two colours and a size update the results without a page load; other colours keep their counts', async ({ page, request }) => {
  const violations = collectCspViolations(page);
  await page.goto(CATEGORY);
  await markPage(page);
  const colour = await openGroup(page, 'color');

  await swapped(page, () => colour.locator('a.of-swatch', { hasText: 'Black' }).click());
  await swapped(page, () => page.locator('#of-filters [data-of-group="color"] a.of-swatch', { hasText: 'Blue' }).click());
  const sizeM = (await openGroup(page, 'size')).locator('a.of-swatch')
    .filter({ has: page.locator('.of-swatch__label', { hasText: /^M$/ }) });
  await swapped(page, () => sizeM.click());

  expect(await stillSamePage(page), 'no full page load').toBe(true);
  expect(page.url()).toMatch(/color=black,blue/);
  expect(page.url()).toMatch(/size=/);
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(3);
  const others = page.locator('#of-filters [data-of-group="color"] a.of-swatch:not([aria-current])');
  const counts = await others.evaluateAll((links) => links.map((a) => Number(a.querySelector('.of-swatch__count')?.firstChild?.textContent ?? '0')));
  expect(counts.some((c) => c > 0), 'disjunctive: unselected colours keep non-zero counts').toBe(true);
  expect(productTotal(await page.content())).toBe(productTotal(await (await request.get(page.url())).text()));
  expect(violations).toEqual([]);
});

test('focus stays on the clicked option, the live region announces the count, a chip removal focuses the results', async ({ page }) => {
  await page.goto(CATEGORY);
  await markPage(page);
  const option = (await openGroup(page, 'material')).locator('a.of-option').first();
  const value = await option.getAttribute('data-of-value');
  const expected = await count(option);

  await swapped(page, () => option.click());
  await expect(page.locator(`#of-filters [data-of-group="material"] a[data-of-value="${value}"]`)).toBeFocused();
  await expect(page.locator('[data-of-live]')).toHaveText(`${expected} products`);

  await swapped(page, () => page.locator('#of-state a.of-chip').first().click());
  expect(await page.evaluate(() => document.activeElement?.closest('#of-results') !== null)).toBe(true);
  expect(await stillSamePage(page)).toBe(true);
});

test('back and forward restore the filter state and the scroll position', async ({ page }) => {
  await page.goto(CATEGORY);
  await markPage(page);
  const option = (await openGroup(page, 'climate')).locator('a.of-option').first();
  await option.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(300);
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(100);

  await swapped(page, () => option.click());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const filteredUrl = page.url();

  await swapped(page, () => page.goBack());
  expect(page.url()).toMatch(new RegExp(`${CATEGORY.replace(/\./g, '\\.')}$`));
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(0);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - scrolled)).toBeLessThan(40);

  await swapped(page, () => page.goForward());
  expect(page.url()).toBe(filteredUrl);
  await expect(page.locator('#of-state a.of-chip')).toHaveCount(1);
  expect(await stillSamePage(page)).toBe(true);
});

test('head after a swap matches a direct load of the same URL (title, robots, canonical, prev/next)', async ({ page, request }) => {
  await page.goto(`${CATEGORY}?product_list_limit=12`);
  await markPage(page);
  await swapped(page, () => page.locator('#of-results .pages a[href*="p=2"]').first().click());
  await swapped(page, async () => { await (await openGroup(page, 'climate')).locator('a.of-option').first().click(); });

  const head = await page.evaluate(() => ({
    title: document.title,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    prev: document.querySelector('link[rel="prev"]')?.getAttribute('href') ?? null,
    next: document.querySelector('link[rel="next"]')?.getAttribute('href') ?? null,
  }));
  const html = decodeEntities(await (await request.get(page.url())).text());
  const attr = (pattern: RegExp) => pattern.exec(html)?.[1] ?? null;
  expect(head.title).toBe(decodeEntities(attr(/<title>([^<]*)<\/title>/) ?? ''));
  expect(head.robots).toBe(attr(/<meta name="robots" content="([^"]*)"/));
  expect(head.canonical).toBe(attr(/<link\s+rel="canonical"\s+href="([^"]*)"/));
  expect(head.prev).toBe(attr(/<link\s+rel="prev"\s+href="([^"]*)"/));
  expect(head.next).toBe(attr(/<link\s+rel="next"\s+href="([^"]*)"/));
  expect(await stillSamePage(page)).toBe(true);
});

test('sorting and the pager swap too; the pager focuses the results', async ({ page }) => {
  await page.goto(CATEGORY);
  await markPage(page);
  await swapped(page, () => page.locator('#of-results select').first().selectOption('name'));
  expect(page.url()).toContain('product_list_order=name');
  await swapped(page, () => page.locator('#of-results .pages a[href*="p=2"]').first().click());
  expect(page.url()).toContain('p=2');
  expect(page.url()).toContain('product_list_order=name');
  expect(await page.evaluate(() => document.activeElement?.closest('#of-results') !== null)).toBe(true);
  expect(await stillSamePage(page)).toBe(true);
});

async function filterBags(page: Page): Promise<import('@playwright/test').Locator> {
  await page.goto('/gear/bags.html');
  await markPage(page);
  const group = page.locator('#of-filters details.of-group:not(.of-group--category):not(.of-group--slider)').first();
  const key = await group.getAttribute('data-of-group');
  await swapped(page, async () => { await (await openGroup(page, key!)).locator('a[data-of-link]').first().click(); });
  expect(await stillSamePage(page)).toBe(true);
  const card = page.locator('#of-results form.product-item').first();
  await card.scrollIntoViewIfNeeded();
  return card;
}

test('product cards work after a swap: add to cart posts a valid form key', async ({ page }) => {
  const card = await filterBags(page);
  await Promise.all([page.waitForNavigation(), card.locator('button[data-addto="cart"]').click()]);
  await expect(page.locator('body')).toContainText(/You added .* to your shopping cart/);
});

test('product cards work after a swap: the wishlist button runs (guests are sent to log in)', async ({ page }) => {
  const card = await filterBags(page);
  await card.locator('button[aria-label^="Add to Wish List"]').click();
  // Hyvä 1.4 redirects guests to the login page, 1.5 shows a message: either proves the component is alive.
  await expect(page.locator('body')).toContainText(/log ?in|sign ?in/i);
});

test('a cached URL swaps in at most 300 ms without long tasks over 50 ms @perf', async ({ page }) => {
  const target = `${CATEGORY}?climate=indoor`;
  await page.request.get(target);
  await page.request.get(target); // warm Varnish
  await page.goto(CATEGORY);
  await page.evaluate(() => {
    const w = window as unknown as { ofLongTasks: number[] };
    w.ofLongTasks = [];
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.ofLongTasks.push(e.duration))).observe({ type: 'longtask', buffered: false });
  });
  const link = (await openGroup(page, 'climate')).locator('a.of-option', { hasText: 'Indoor' });
  const start = await page.evaluate(() => performance.now());
  await swapped(page, () => link.click());
  const result = await page.evaluate((t0) => {
    const measure = performance.getEntriesByName('of:swap').pop();
    const w = window as unknown as { ofLongTasks: number[] };
    return { total: (measure ? measure.startTime + measure.duration : 0) - t0, swap: measure?.duration ?? 0, long: w.ofLongTasks };
  }, start);
  test.info().annotations.push({ type: 'swap', description: `click to swap ${result.total.toFixed(0)} ms, swap ${result.swap.toFixed(0)} ms, long tasks ${JSON.stringify(result.long)}` });
  expect(result.total).toBeLessThanOrEqual(300);
  // Long tasks are a hard gate locally; GitHub's runners record 50–100 ms tasks while Hyvä's product cards start
  // (Iman, 2026-10-14: CI gates the 300 ms swap and records long tasks in the report).
  if (!process.env.CI) {
    expect(result.long.filter((d) => d > 50)).toEqual([]);
  }
});

test('the search box narrows a long list as you type, also into "Show more", and restores it when cleared', async ({ page }) => {
  await page.goto(CATEGORY);
  const material = await openGroup(page, 'material');
  const visible = () => material.locator('li:visible [class$="__label"]').allInnerTexts();
  const before = await visible();

  await material.locator('input.of-search__input').fill('cot');
  await expect.poll(visible).toEqual(expect.arrayContaining(['Cotton']));
  expect((await visible()).every((label) => /cot/i.test(label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))).toBe(true);

  await material.locator('input.of-search__input').fill('');
  await expect.poll(visible).toEqual(before);
});

test('a page without products offers one click back to the previous filters', async ({ page }) => {
  await page.goto(`${CATEGORY}?color=green`);
  await markPage(page);
  const previous = page.url();
  await swapped(page, () => page.evaluate((url) => { (window as unknown as { openFilter: { navigate: (u: string) => void } }).openFilter.navigate(url); }, `${CATEGORY}?color=green&price=90-100`));

  await expect(page.locator('#of-state .of-empty')).toContainText('No products match.');
  const undo = page.locator('#of-state .of-empty a');
  await expect(undo).toHaveAttribute('href', previous);
  await swapped(page, () => undo.click());
  expect(page.url()).toBe(previous);
  expect(productTotal(await page.content())).toBeGreaterThan(0);
  expect(await stillSamePage(page)).toBe(true);
});
