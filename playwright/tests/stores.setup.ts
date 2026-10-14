import { test as setup, expect, request as playwrightRequest } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { rtlStore, storefrontThemes, storeStateFile } from './stores';

const stores = [...new Set([...storefrontThemes().map((theme) => theme.store), rtlStore()].filter(Boolean))];

for (const store of stores) {
  const file = storeStateFile(store);
  if (!file) {
    continue;
  }
  setup(`store view ${store}: keep the store and vary cookies`, async ({ baseURL }) => {
    // Magento's store switcher (the same request the language switcher makes) sets `store` and X-Magento-Vary.
    const context = await playwrightRequest.newContext({ baseURL, ignoreHTTPSErrors: true });
    const home = Buffer.from(`${baseURL}/`).toString('base64url');
    const response = await context.get(`/stores/store/redirect/?___store=${store}&___from_store=default&uenc=${home}`);
    expect(response.ok()).toBeTruthy();
    // Keep only the store and vary cookies: a shared PHPSESSID would make parallel workers queue on one Redis
    // session lock ("Redis session exceeded concurrent connections").
    const state = await context.storageState();
    const cookies = state.cookies.filter((cookie) => ['store', 'X-Magento-Vary'].includes(cookie.name));
    expect(cookies.find((cookie) => cookie.name === 'store')?.value).toBe(store);
    expect(cookies.find((cookie) => cookie.name === 'X-Magento-Vary'), 'Varnish needs the vary cookie').toBeDefined();
    mkdirSync('.auth', { recursive: true });
    writeFileSync(file, JSON.stringify({ cookies, origins: [] }, null, 2));
    await context.dispose();
  });
}
