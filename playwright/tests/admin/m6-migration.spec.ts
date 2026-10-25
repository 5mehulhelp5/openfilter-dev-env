import { test, expect } from '@playwright/test';
import { magento, sql, uncached } from './admin';

/**
 * M6 S8 redirects of old filter URLs (other modules' formats) on the default store view: off by default (404); on, an
 * old URL answers 301 to OpenFilter's URL of the same filters, and an address with an unknown word stays 404.
 * Serial admin project.
 */
const OLD = '/women/tops-women/color_black.html';
const PATH = 'openfilter/migration/redirects';

function setting(value: string | null): void {
  sql(`DELETE FROM core_config_data WHERE path = '${PATH}' AND scope = 'stores'
       AND scope_id = (SELECT store_id FROM store WHERE code = 'default')`);
  if (value !== null) {
    sql(`INSERT INTO core_config_data (scope, scope_id, path, value)
         SELECT 'stores', store_id, '${PATH}', '${value}' FROM store WHERE code = 'default'`);
  }
  magento('cache:clean', 'config', 'full_page');
}

test.afterAll(() => setting(null));

test('old filter URLs are 404 while redirects are off', async ({ request }) => {
  const old = await request.get(uncached(OLD), { maxRedirects: 0 });
  expect(old.status()).toBe(404);
});

test('on, an old filter URL redirects (301) and an unknown word stays 404', async ({ request }) => {
  setting('1');
  const old = await request.get(uncached(OLD), { maxRedirects: 0 });
  expect(old.status()).toBe(301);
  expect(old.headers().location).toMatch(/\/women\/tops-women\.html\?color=black(?:&of_t=\d+)?$/);

  const unknown = await request.get(uncached('/women/tops-women/color_nonsense.html'), { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
});
