# SDD ledger — plan: /Users/imanaboheydary/.claude/plans/i-wanna-create-a-elegant-comet.md
Pre-flight: S0 fixture consumed by S3 (Hyvä markup), S4 storefront spec and every later Playwright spec; S1 Config (TypedReader) consumed by S4 MapperPlugin (enabled flag) and StrategyResolver (debug); S4 FacetFilterInterface/FacetCountStrategyInterface consumed by M1 (production strategies, price stats); S5 hooks consumed by M1 S6 (built-in index fields). No conflicts.
Ruling: full-run without questions (Iman, 2026-10-13: "dont ask me anything just make the whole plan and start"); D3–D8 and D13 recommendations adopted and logged in 07 §10 — cost if wrong: one decision page to revisit.
Ruling: working-hours rule applies to OpenFilter even though OpenLabel's was lifted on 2026-10-12 (Iman restated it on 2026-10-13); bin/after-hours gates every GitHub write — cost if wrong: a few hours of delay.
Ruling: both modules require and use iranimij/module-base (Iman, 2026-10-13: "we have a general core module, both module should have that and use that") — cost if wrong: none (OpenLabel pattern).
Ruling: one chat per milestone (Iman, 2026-10-13); this chat stops after M0's local slices and hands S7 to the next chat — cost if wrong: none.
Ruling: fixture is a fresh Warden env `openfilter` built by bin/setup (not a database copy of openlabel), OpenLabel 1.1 from Packagist; openlabel stack stopped (Docker 7.6 GB) — cost if wrong: 6 minutes of setup.
Ruling: Traefik needed a restart to route the new env (it restarted before the env's containers were up) — cost if wrong: none; noted in PROGRESS gotchas.
Task S0: complete (openfilter-dev-env e5525b7; Playwright smoke 6/6; German store view + 3 catalog rules via ci/fixture-data.php; storefront CSP enforce + Varnish verified by the smoke spec).
Ruling: integration CI is an own script (.github/ci/integration.sh) instead of the ExtDN integration action, because the action hardcodes Elasticsearch 8.18 and OpenFilter lives in the search adapter; search engine via docker run per leg — cost if wrong: one script to maintain.
Ruling: 2.4.7's ES8 leg adds magento/module-elasticsearch-8 (^101.0), absent from the 2.4.7 project — cost if wrong: the leg fails at composer install, visible immediately.
Task S1: complete (openfilter 0dc7308; unit 9/9 then 24/24 after S4; integration 4/4; PHPCS clean, PHPStan 6 clean; ModuleTest asserts the module-base dependency, tab and ACL parent).
Task S2: complete (openfilter-hyva de816d3 + 3c3e61a, unit 4/4, integration 1/1, PHPCS + PHPStan clean; bundle 2563318; dev-env e2e workflow with Hyvä 1.4.2 + 1.5.2 legs, README leg deferred to M4).
Finding (S3): Hyvä 1.4.2 renders filter options inside <template x-if="open"> (no links in the DOM until a group opens; x-defer="intersect" starts a group only when in view); 1.5.2 uses <details>. Option markup unchanged; swatches use inline styles in both.
Finding (S3): no #product-list on empty results; sorter/limiter/view mode set location.href (no links); Alpine 3.14.3 (+ CSP build shipped); card cache key has no filter state.
Task S3: complete (docs/hyva-integration.md in openfilter 0dc7308; Notion 02 §5 and 10 FE2 updated; Playwright hyva-layered-nav 5/5).
Ruling: docs/hyva-integration.md was committed with the S1 skeleton (written while the store built) — cost if wrong: none.
Finding (S4): ElasticAdapter\SearchAdapter\Mapper and SearchAdapter\Aggregation\Builder are byte-identical on 2.4.7-p10, 2.4.8-p5, 2.4.9 (diffed from the public mirror); OpenSearch and ES8 adapters both delegate to them and call setQuery() then build($request, $raw).
Finding (S4): core's dynamic (price) bucket re-runs the QueryContainer query for statistics; the plugin hands it the original query so price stays core until M1.
Ruling: facet filters = must-term filters on fields with a term bucket in catalog_view_container / quick_search_container; category_ids and visibility excluded; other requests untouched — cost if wrong: one di argument.
Ruling: auto strategy = SingleQuery for opensearch, elasticsearch8, elasticsearch7 (preliminary until the CI matrix confirms) — cost if wrong: one di.xml mapping.
Task S4: complete (openfilter 0467d83 on feat/m0-s4-facet-counts; RED: StrategyResolver missing → GREEN; integration DisjunctiveCountsTest 18/18 (counts = brute force for both strategies × 4 selections; requests over core measured on the engine: SingleQuery 0, PerAttribute 1/1/2/3); unit 24/24, coverage Model 99.2 %; PHPCS + PHPStan clean; Playwright facet-counts 1/1; checked in Chrome: filtered category page shows "Items 1-12 of 22", no errors).
Ruling: Playwright reads option hrefs and counts from server HTML (also inside Hyvä 1.4's x-if templates) instead of clicking stock groups — cost if wrong: none.
Task S5: complete (openfilter feat/m0-s5-index-fields; IndexHooksTest 4/4: additionalFieldsProviderForElasticsearch pool, elasticsearch5FieldProvider, mview tables; docs/index-fields.md).
Finding (S5): catalogsearch_fulltext mview does not subscribe to review_entity_summary nor cataloginventory_stock_item; MSI reindexes on salability change; special price date windows need a price-indexer hook. M1 adds triggers.
Task S6: complete (Notion: Spec FilterConfig, Spec Slug, Spec UrlCodec under 02 · Architecture; 02 §3/§5 and 10 FE2 [M0 verify] items resolved).
Task S7: open (after hours) — see PROGRESS.md "Exact next step".
