import { test, expect, seedOpenLabel, unseedOpenLabel } from './fixture';
import { openGroup } from './helpers';

/**
 * M3 acceptance (08 §7, 10 FE11, 07 §8): OpenLabel's labels are part of the product card HTML, so they survive every
 * swap: after three swaps and Back, each card carries a label and the label count equals a direct load.
 */
test('OpenLabel labels are on every card after swaps and Back, as on a direct load', async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const id = seedOpenLabel(`OpenFilter M3 ${testInfo.project.name}`);
  try {
    await page.goto('/women/tops-women.html');
    const swapped = () => page.evaluate(() => new Promise((resolve) => window.addEventListener('openfilter:swapped', resolve, { once: true })));
    for (const key of ['material', 'climate']) {
      const done = swapped();
      await (await openGroup(page, key)).locator('a[data-of-link]').first().click();
      await done;
    }
    const sort = swapped();
    await page.locator('#of-results select').first().selectOption('name');
    await sort;
    const back = swapped();
    await page.goBack();
    await back;

    const cards = page.locator('#of-results .product-item');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    expect(await page.locator('#of-results .product-item:not(:has(.ol-label))').count(), 'every card has a label').toBe(0);
    const direct = await (await request.get(page.url())).text();
    const labels = await page.locator('#of-results .ol-label').count();
    expect(labels).toBe((direct.match(/class="ol-label /g) ?? []).length);
    expect(await page.locator('link[href*="/openlabel/"][href$=".css"]').count(), 'OpenLabel stylesheet stays').toBe(1);
  } finally {
    unseedOpenLabel(id);
  }
});
