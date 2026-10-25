OpenFilter 1.2 brings the professional features of paid layered navigation modules: SEO-friendly path URLs, landing pages, a way off other filter modules, and insights into how shoppers filter. Every new feature is opt-in: a 1.1 store that updates keeps the same storefront, URLs, head tags and counts (checked page by page on the upgrade).

**New for shoppers**

- **Load more** button, or loading **as shoppers scroll** (two pages, then the button); the page links stay for search engines, Back restores the loaded pages.
- **Quick filter bar** above the products: one-click links to the values of the filters you mark.
- **Option images** for attributes without swatches (*Images* display type).
- **Dependent filters**: a filter shows only after a pick in another one (any value, or chosen values).
- **All Products page**: every product of the store view with the filters, at a URL key you choose.

**New for SEO**

- **Path filter URLs** (`/women/tops-women/color-black,blue/size-m.html`) instead of query parameters; old links redirect (301), canonical tags and the sitemap follow.
- **Landing pages**: a category with fixed filters at its own address, with its own title, H1, meta tags, robots value and text. Paste a filtered category address to make one; filter links that reach the same filters point to it.

**New for merchants**

- **Moving from another filter module**: `bin/magento openfilter:migrate` lists what to switch off and checks old URLs; opt-in 301 redirects of old filter URLs in the formats Amasty, Mirasvit and Mageplaza document publicly.
- **Insights** (off by default, anonymous): most used filters and values, unused filters, combinations without products, filters worth indexing, and a suggested order for *Sort filters*. Nothing about shoppers is stored.
- **Admin polish**: a *Set up OpenFilter* checklist, a one-line answer to "Why is this filter not showing?", a live preview of the SEO templates, and a useful filter order on new installs.

**New for developers**

- GraphQL `openfilter_landing_page(url_key)`; option images as image swatches in `openfilter_aggregations`; the insights beacon for headless storefronts.
- Config export schema 3 (schema 1 and 2 files still import).

**Still one search request per page**

| Page | Magento | OpenFilter |
|---|---|---|
| Category page | 4 requests · 245 ms | 1 request · 233 ms |
| Three filters | 4 requests · 225 ms | 1 request · 222 ms |
| Two values of one filter | not possible | 1 request · 237 ms |
| Path URL, one filter | 4 requests · 240 ms | 1 request · 233 ms |
| Next page ("Load more") | 4 requests · 242 ms | 1 request · 233 ms |
| Landing page | 4 requests · 239 ms | 1 request · 230 ms |
| Search page | 4 requests · 229 ms | 1 request · 226 ms |

Same store (Magento 2.4.9, Hyvä 1.5.2, CI runner, 1.2.0-rc1), Varnish and the page cache skipped, median of 11 loads ([benchmark](https://github.com/iranimij/openfilter/blob/main/docs/benchmark.md)). Every filter click stays cacheable by Varnish.

**Update**

```bash
composer require iranimij/openfilter-hyva-bundle:^1.2
bin/magento setup:upgrade
bin/magento setup:static-content:deploy   # production mode
```

`iranimij/openfilter-hyva` 1.2 needs `iranimij/openfilter` 1.2; update both or the bundle. 1.2 also contains the 1.1.1 fixes (no redirect loop behind Magento's Varnish configuration, apply bar colours). Documentation: https://iranimij.github.io/openfilter/ · Changelog: CHANGELOG.md.
