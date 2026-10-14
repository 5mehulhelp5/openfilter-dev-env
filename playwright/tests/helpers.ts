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

/** Layered navigation option links in server HTML (also inside Hyvä 1.4's x-if templates): href, label, count. */
export function filterOptionLinks(html: string): Array<{ href: string; label: string; count: number }> {
  const links: Array<{ href: string; label: string; count: number }> = [];
  const pattern = /<a\s+href="([^"]+)"[^>]*?aria-label="([^"]*?) filter, (\d+) available products?"/g;
  for (const match of decodeEntities(html).matchAll(pattern)) {
    links.push({ href: match[1], label: match[2], count: Number(match[3]) });
  }
  return links;
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
