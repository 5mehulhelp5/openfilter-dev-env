import { Page } from '@playwright/test';
import { decodeEntities } from './helpers';

/** Robots and canonical as the browser's head has them now (after swaps), and as a direct load's HTML has them. */
export interface SeoHead { robots: string | null; canonical: string | null }

export async function liveHead(page: Page): Promise<SeoHead> {
  return page.evaluate(() => ({
    robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
  }));
}

export function htmlHead(html: string): SeoHead {
  const attr = (pattern: RegExp) => { const m = pattern.exec(html); return m ? decodeEntities(m[1]) : null; };
  return {
    robots: attr(/<meta name="robots" content="([^"]*)"/),
    canonical: attr(/<link\s+rel="canonical"\s+href="([^"]*)"/),
  };
}

export function canonicalCount(html: string): number {
  return (html.match(/<link\s+rel="canonical"/g) ?? []).length;
}
