/**
 * Storefront variants the specs run on. Each Hyvä version is a store view of the fixture store, chosen by the
 * `store` cookie (and Magento's X-Magento-Vary cookie, so Varnish serves that store's pages):
 * - locally: `default` = Hyvä 1.4.2, `hyva15` = Hyvä 1.5.2 copied from the public tag (bin/install-hyva15);
 * - in CI each leg installs one Hyvä version as the default theme (OF_THEMES=h14:default or h15:default).
 * `ar` is a right-to-left store view (child theme OpenFilterFixture/hyva-rtl); OF_RTL_STORE='' switches it off.
 */
export interface StorefrontTheme {
  /** Project suffix: h14 or h15. */
  key: string;
  /** Store view code. */
  store: string;
  /** Hyvä default theme version as "major.minor". */
  hyva: string;
}

export function storefrontThemes(): StorefrontTheme[] {
  return (process.env.OF_THEMES ?? 'h14:default,h15:hyva15').split(',').filter(Boolean).map((entry) => {
    const [key, store] = entry.split(':');
    return { key, store: store ?? 'default', hyva: key === 'h15' ? '1.5' : '1.4' };
  });
}

export function rtlStore(): string {
  return process.env.OF_RTL_STORE ?? 'ar';
}

/** Saved cookies for a store view, or undefined for the default store view (no cookie needed). */
export function storeStateFile(store: string): string | undefined {
  return store === 'default' ? undefined : `.auth/store-${store}.json`;
}
