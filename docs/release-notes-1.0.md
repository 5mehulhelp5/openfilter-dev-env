OpenFilter is a free, MIT-licensed layered navigation for Magento 2 and Hyvä, built on the OpenSearch Magento already ships.

**Highlights**

- Multi-select filters with correct (disjunctive) counts in one search request, no extra MySQL queries.
- AJAX that fetches the same URL as a normal page load, so Varnish serves filter clicks; one Alpine component, CSP-clean on Hyvä.
- Every filter works without JavaScript (real links, GET forms).
- Price and decimal sliders (display currency and tax aware); rating, in stock, on sale and new filters.
- Mobile drawer with "Show N products" counted before you apply.
- SEO rules: readable URL names, 301 to one canonical URL, robots and canonical tags, nofollow from 2 active values, at most 5 values per URL.
- Admin: Filters grid, a form per filter, settings on the attribute page, "Why is this filter not showing?".
- CLI: `openfilter:doctor`, `openfilter:slugs:generate`, `openfilter:config:export` / `import`.

**Install**

```bash
composer require iranimij/openfilter-hyva-bundle
bin/magento setup:upgrade
bin/magento indexer:reindex catalogsearch_fulltext
```

Tested on Magento 2.4.7 (OpenSearch and Elasticsearch 8), 2.4.8 and 2.4.9 with PHP 8.2–8.4, Hyvä 1.4.2 and 1.5.2, Varnish and an enforced CSP, together with OpenLabel. Documentation: https://iranimij.github.io/openfilter/ · Changelog: CHANGELOG.md.
