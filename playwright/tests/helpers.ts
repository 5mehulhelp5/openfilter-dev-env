import { Locator, Page, expect } from '@playwright/test';

/** Collects Content-Security-Policy violations reported by the browser console on a page. */
export function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(text)) {
      violations.push(text);
    }
  });
  return violations;
}

/** First product URL on the given category page, read from the product card link. */
export async function firstProductUrl(page: Page, categoryPath: string): Promise<string> {
  await page.goto(categoryPath);
  const href = await page.locator('.product-item a.product-item-photo').first().getAttribute('href');
  if (!href) {
    throw new Error(`No product card link found on ${categoryPath}`);
  }
  return href;
}

/** Decodes the HTML entities Magento's escaper writes into attributes (&#x20; &amp; …). */
export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/**
 * Layered navigation option links in server HTML: href, label, count. Reads OpenFilter's templates (M3) and Hyvä's
 * stock templates (also inside Hyvä 1.4's x-if templates).
 */
export function filterOptionLinks(html: string): Array<{ href: string; label: string; count: number }> {
  const decoded = decodeEntities(html);
  const links: Array<{ href: string; label: string; count: number }> = [];
  const openFilter = /<a class="of-option[^"]*"\s+href="([^"]+)"[\s\S]*?of-option__label">([^<]*)<[\s\S]*?of-option__count">(\d+)/g;
  for (const match of decoded.matchAll(openFilter)) {
    links.push({ href: match[1], label: match[2].trim(), count: Number(match[3]) });
  }
  const stock = /<a\s+href="([^"]+)"[^>]*?aria-label="([^"]*?) filter, (\d+) available products?"/g;
  for (const match of decoded.matchAll(stock)) {
    links.push({ href: match[1], label: match[2], count: Number(match[3]) });
  }
  return links;
}

/** Markup of one OpenFilter group (data-of-group="code") in server HTML, '' when absent. */
export function groupMarkup(html: string, code: string): string {
  const start = html.indexOf(`data-of-group="${code}"`);
  if (start < 0) {
    return '';
  }
  const end = html.indexOf('</details>', start);
  return html.slice(start, end < 0 ? undefined : end);
}

/**
 * Colour filter links in server HTML: OpenFilter's colour group (M3), else stock Hyvä's swatches (1.4
 * `a.swatch-option-link-layered`, 1.5 `a.swatch-option` from the SwatchRenderer view model). Hrefs are decoded.
 */
export function swatchLinks(html: string): string[] {
  const colour = groupMarkup(html, 'color');
  if (colour !== '') {
    return filterOptionLinks(colour).map((link) => link.href);
  }
  return [...html.matchAll(/<a\s+href="([^"]+)"[^>]*?class="swatch-option(?:-link-layered)?["\s]/g)].map((m) => decodeEntities(m[1]));
}

/** Product total of a listing page from the toolbar ("Items 1-12 of 31", "31 Items"; 1.4 and 1.5), 0 when absent. */
export function productTotal(html: string): number {
  const amounts = [...decodeEntities(html).matchAll(/class="[^"]*toolbar-amount[^"]*"[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  for (const text of amounts) {
    const match = /of (\d+)/.exec(text) ?? /(\d+) Items?/i.exec(text) ?? /(\d+)/.exec(text);
    if (match) {
      return Number(match[1]);
    }
  }
  return 0;
}

/** Opens a stock Hyvä filter group (1.4: x-defer="intersect" starts the group only once it is in view). */
export async function openFilterGroup(group: Locator): Promise<void> {
  await group.scrollIntoViewIfNeeded();
  const tagName = await group.evaluate((el) => el.tagName);
  if (tagName === 'DETAILS') {
    await group.evaluate((el) => { (el as HTMLDetailsElement).open = true; });
    return;
  }
  const toggle = group.locator('button.filter-options-title');
  await expect(async () => {
    if (await toggle.getAttribute('aria-expanded') !== 'true') {
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass({ timeout: 10000 });
}
