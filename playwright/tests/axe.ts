import AxeBuilder from '@axe-core/playwright';
import { Page, expect, test } from '@playwright/test';

/**
 * axe-core gate for OpenFilter's markup (07 §6, 10): no WCAG 2.1 A/AA violation inside the filter dialog (with its
 * filters) and #of-state; the theme's full-page findings are recorded as an annotation, not a gate.
 */
export const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export async function axeOpenFilter(page: Page, label: string): Promise<void> {
  const ours = await new AxeBuilder({ page }).include('#of-drawer').include('#of-state').withTags(WCAG).analyze();
  const page_ = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  test.info().annotations.push({ type: 'axe', description: `${label}: OpenFilter ${ours.violations.length}, whole page ${page_.violations.map((v) => v.id).join(', ') || 'none'}` });
  expect(ours.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

