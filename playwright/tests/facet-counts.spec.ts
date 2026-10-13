import { test, expect } from '@playwright/test';
import { collectCspViolations, filterOptionLinks } from './helpers';

/**
 * M0 search spike on the storefront: with OpenFilter's facet count plugins active, a filtered category page
 * renders, and each remaining option count equals the number of products its link leads to (other attributes
 * count under the active filter, as in core).
 */
const CATEGORY = '/women/tops-women.html';

test('filtered category page: option counts match the products their links lead to', async ({ page, request }) => {
  const start = await (await request.get(CATEGORY)).text();
  const colour = /<a\s+href="([^"]+)"[^>]*class="swatch-option-link-layered/.exec(start);
  expect(colour, 'a colour swatch link on the category page').not.toBeNull();
  const filteredUrl = colour![1].replace(/&amp;/g, '&');

  const filtered = await (await request.get(filteredUrl)).text();
  const options = filterOptionLinks(filtered).slice(0, 3);
  expect(options.length).toBeGreaterThan(0);

  const violations = collectCspViolations(page);
  for (const option of options) {
    await page.goto(option.href);
    const shown = await page.locator('.toolbar-amount').first().innerText();
    const total = Number((/(\d+)\s*$/.exec(shown.trim()) ?? /(\d+)/.exec(shown))![1]);
    expect(total, `${option.label}: count ${option.count}, page says "${shown}"`).toBe(option.count);
  }
  expect(violations).toEqual([]);
});
