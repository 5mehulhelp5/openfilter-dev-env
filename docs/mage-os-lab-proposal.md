# Mage-OS Lab proposal (draft)

Draft for Iman to submit to the Mage-OS Lab after OpenFilter 1.2.0. Facts as of 2026-10-25.

## What

**OpenFilter**: free (MIT) layered navigation for Magento 2 / Mage-OS on the OpenSearch the platform already ships,
with a native Hyvä package. Repository: https://github.com/iranimij/openfilter · Packagist: `iranimij/openfilter-hyva-bundle`.

## Why it fits the Lab

- **Fills a gap every store has.** Core layered navigation offers one value per filter, recounts nothing and sends four
  search requests per page; shops buy a paid module for multi-select. OpenFilter does multi-select with correct
  (disjunctive) counts in **one** search request per page, measured by a public benchmark in CI.
- **Open and dependency-light.** MIT, no licence key, no paid tier, no extra search stack; works on Mage-OS 2.4.7–2.4.9,
  PHP 8.2–8.4, OpenSearch (and Elasticsearch 8 on 2.4.7).
- **Accessible and cache-friendly by design.** Every filter is a real link or form (works without JavaScript); AJAX
  fetches the same URLs Varnish caches; axe-clean, keyboard and right-to-left tested; CSP-compatible on Hyvä.
- **Tested in public.** Unit, integration (three Magento versions), Playwright end-to-end on two Hyvä versions, visual
  checks, performance budgets and a benchmark gate run on every change.

## Scope of 1.2

Multi-select (any / all), swatches and option images, sliders and ranges, category tree, rating / stock / sale / new,
dependent filters, query or path URLs, SEO rules and templates, landing pages, XML sitemap, "Load more" and infinite
scroll, quick filter bar, All Products page, anonymous insights, redirects from other modules' old filter URLs,
GraphQL and REST, admin diagnostics.

## What we would like from the Lab

- Visibility for Mage-OS merchants and agencies (listing, a demo store).
- Feedback from Mage-OS maintainers on making the Luma package (planned for 1.3) the default for non-Hyvä Mage-OS stores.
- Optional: a Mage-OS CI job installing OpenFilter on Mage-OS nightly builds.

## Maintainer

Iman Aboheydary (`iranimij`), maintainer since 2026; responds to issues within a week.
