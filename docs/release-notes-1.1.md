OpenFilter 1.1 adds the features merchants ask paid layered navigation modules for, plus a headless API. Every new mode is opt-in: a 1.0 store that updates keeps the same storefront, URLs, head tags and counts (checked page by page on the upgrade).

**New for shoppers**

- **Match all** per filter (AND), with "Products have all picked values." under the title.
- **Price ranges** as options (your list or automatic round ranges), several at once.
- **Category tree** with several categories picked on the same page.
- **Dropdown** display type, **tooltips**, a **horizontal bar** above the products with "More filters", a **sticky sidebar** and a desktop **apply mode** with a "Show N products" bar.

**New for merchants**

- **Where it shows**: every category, only some, or all except some.
- **Sort filters** page (drag, or keyboard), the filter form per store view, grid columns for order, matching and visibility, warnings for duplicate names and empty search pages.
- **SEO templates** for title, meta description and H1 (`{filters}`, `{category}`, `{store}`), and an **XML sitemap** of the filter pages search engines may index.

**New for developers**

- **GraphQL** `products { openfilter_aggregations }`: filters in order, disjunctive counts from the same request, URL names, swatches, ranges, categories. A plain HTML + JavaScript headless example lives in `examples/headless`.
- **REST** for filter settings and the config export/import.

**Still one search request per page**

| Page | Magento | OpenFilter |
|---|---|---|
| Category page | 4 requests · 189 ms | 1 request · 171 ms |
| Three filters | 4 requests · 159 ms | 1 request · 160 ms |
| Two values of one filter | not possible | 1 request · 175 ms |
| Search page | 4 requests · 169 ms | 1 request · 160 ms |

Same store, Varnish and the page cache skipped, median of 11 loads ([benchmark](https://github.com/iranimij/openfilter/blob/main/docs/benchmark.md)). Every filter click stays cacheable by Varnish.

**Update**

```bash
composer require iranimij/openfilter-hyva-bundle:^1.1
bin/magento setup:upgrade
bin/magento setup:static-content:deploy   # production mode
```

`iranimij/openfilter-hyva` 1.1 needs `iranimij/openfilter` 1.1; update both or the bundle. Documentation: https://iranimij.github.io/openfilter/ · Changelog: CHANGELOG.md.
