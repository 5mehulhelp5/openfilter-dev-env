# Ledger — M5 · Release 1.1 (superset + benchmark + headless). Plan: /Users/imanaboheydary/.claude/plans/pasted-content-id-96ce-read-https-app-n-eager-hinton.md (approved 2026-10-14 ~21:00)
Iman's answers: plan approved; the four questions taken with the recommendations (D19: schema + API as planned, vanilla headless page, benchmark vs documented claims only, 6 KB JS kept for the default with per-mode scripts). GitHub working-hours rule lifted (tags still on Iman's go).
Stacks: openfilter `feat/m5-sN-*` on `main` (617a1d1, M4 merged); dev-env `test/m5-e2e` on `main` (b700f63).

## S0 · Store-view scope in the filter form (Iman, 2026-10-14 ~22:00: "what do they do when they have 20 languages, I think the table would be broken")
Ruling: Magento's store switcher (as products/categories) instead of one column per store view; chosen over a sideways-scrolling table (does not scale, one save touches every store view, no "inherited" signal).
Ruling: settings are global ([GLOBAL], read only in a store view); Save ignores them in a store view whatever the request carries — cost if wrong: none (they are global in the schema).
Ruling: "generate again" in All Store Views regenerates everywhere (1.0 behaviour); in a store view only that store view.
Ruling: the filter's own URL name per store view is now editable (storefront and repository already supported it; only the form lacked it).
Finding: Magento's dynamic-rows inputs and single checkboxes have no accessible name (axe "label", 48 nodes on colour in a store view; true in 1.0 too). Own templates `row-input` / `row-checkbox` name them "<column> – <option>".
Finding: a refused save could leave uncommitted URL names in OpenFilter's cache (the name checks rebuild the slug cache inside the transaction) — same class as M4's dry-run finding. `Model/Cache/AfterRollback` drops cache + in-memory copies after every rollback in Save; regression test `testARefusedSaveLeavesNoUncommittedNameInTheCache`.
Finding: Store::delete in an integration test's tearDownAfterClass needs the isSecureArea registry flag (AdminFixture::deleteStoreView sets it).
Finding (flaky, cause not verified): one full admin Playwright run was logged out mid-run (two specs saw the sign-in page); the re-run was green 18/18. Likely the same admin user signing in from another session.
Tests: unit 349 (FormScope 100 %, AttributeSlugScope 100 %, OptionSlugBatch 100 %, FilterForm 96 % lines; widths for 1/4/20 store views); integration core 141/141 (FilterFormTest 16, incl. 20 store views, store-view-only save, collision per store view, regenerate per store view, cache after rollback; SQL budget 118 = 118); PHPCS zero; PHPStan clean; Playwright admin 18/18 (m5-store-scope 6, m2-filter-form 3 updated).
Commits: core 9fd8201 (feat/m5-s0-store-scope), dev-env 9ba8fbc (test/m5-e2e).
CI (S0): full matrix green on feat/m5-s0-store-scope (run 38631929685: 2.4.7 OpenSearch + ES8, 2.4.8, 2.4.9 × PHP 8.2–8.4, Performance); E2E run 38631952431 pending at the time of writing.

## S1 · Config for 1.1 (every setting defaults to 1.0 behaviour)
Ruling: ranges stored as a string in the URL range format ("0-50,50-100,100-", null = automatic); Model/Url/RangeList validates it (ascending, no overlap, at most 20, only the first open below and the last open above) and S3's codec reuses it — cost if wrong: one class.
Ruling: tree_depth lives on both behaviour tables (one generic BEHAVIOUR_COLUMNS path; only the category filter shows it) — cost if wrong: one unused column on openfilter_attribute.
Ruling: "Match all" only for multi-select option filters (select/multiselect, not built-ins, not single-select).
Ruling: export schema 2 written, 1 and 2 read; tooltips are a section like labels.
Ruling: tooltips per store view through the same scope switcher as labels (form section "Label and tooltip").
Finding: clearing a built-in's store label deleted the whole openfilter_builtin_store row (fine in 1.0, would drop a tooltip in 1.1): label and tooltip writes now share saveBuiltinText(), which deletes the row only when both are empty (integration test).
Finding: FilterForm::field() merged its defaults over the given settings (a textarea stayed an input) — order fixed.
Finding: the I18n test reads PHP and etc/*.xml only; UI-component form phrases are added to en_US/de_DE by hand.
Tests: unit 399 (RangeList 14 cases, Config 9 new getters, Validator 17 new cases, schema v2, exporter/importer v1 + "and"); integration 147/147 (+6: 1.1 settings persisted/validated, tooltips per store view + label clear keeps tooltip, per-category table, form logic/tooltip per scope, defaults = 1.0) + performance 17/17 (server time −35.4 ms); PHPCS zero; PHPStan clean; Playwright admin 22/22 (m5-config 4), storefront 129 + 10 skipped by design.
Commits: core e6e4dc5 (feat/m5-s1-config, PR #43 on #42), dev-env aa4a7d1. setup:upgrade applied on the fixture (columns ranges, tree_depth, builtin_store.tooltip, table openfilter_filter_category).
S1 fix-up: the unit UninstallTest pins the dropped tables; the new table was added to Uninstall without the test (caught by the S2 unit run) — fixed on S1 (0f3738e), S2 rebased; the first S1 matrix (old commit) cancelled and re-dispatched (run 38635247827).

## S2 · Products must match all of the picked values
Ruling: AND is applied by adding one term clause per picked value next to core's terms filter (core's request holds one filter per field) in MapperPlugin through Model/Search/AndLogic; the attribute leaves the disjunctive facet filters, so every count includes it ("an option's count = products that have it as well") — cost if wrong: one class.
Ruling: the AND set is read from FilterConfigProvider for the current store view (logic is global; the provider is cached, 0 SQL on a warm cache).
Finding: Luma's configurables carry their children's colours and sizes in the index, so M1Catalog already holds products with several values per attribute (no new fixture).
Finding: BudgetTest's SQL comparison needs OpenFilter's cache warm; a test that saves a filter before it made the comparison 129 vs 118 — the new "all of" budget test runs last (alone: 112 = 112).
Finding: re-dispatching E2E on the same dev-env branch cancels the run before it (concurrency group): S0's E2E was cancelled by S1's, which contains it.
Note: hyva #17 (other session, openfilter-ref → main) was blocked for an hour by an HTTP 429 from api.github.com in Composer (Unit 2.4.7 / PHP 8.2); re-ran the failed job (auto-merge on).
Tests: unit 403 (AndLogic 4); integration 157 (AndLogicCountsTest 9: both oracles × both strategies × category/search, German store view, groups; Budget "all of" = 1 request); PHPCS zero; PHPStan clean; Playwright admin 24/24 (m5-and-logic 2 on the real store: style counts = page sizes, any-of widens), storefront 129 + 10 skipped.
Deferred to S6: the "All must match" hint in the group (Hyvä template).
Commits: core 89860c7 + docs (feat/m5-s2-and-logic, PR #44, full matrix run 38636444647), dev-env a86d9b7.
CI: S1 full matrix green (run 38635247827), S2 full matrix green incl. 2.4.7 + ES8 (run 38636444647), E2E with S1 green on Hyvä 1.4.2 and 1.5.2 (run 38634645550). hyva #17 merged after the re-run (M4 closed).

## S3 · Price and decimal ranges as a list
Ruling: ranges are [from, to) for filtering and counting ("€0.00 - €39.99" labels, a cent below the bound for prices), unlike the 1.0 slider's inclusive upper bound; a single picked range in "Ranges" mode follows [from, to) too — cost if wrong: one clause builder.
Ruling: automatic ranges = about five, step 1/2/5 × 10^n of (max − min)/5, first bound floored to the step, last range open; computed from a histogram one display unit wide (offset a thousandth down so values on a bound land in the bucket that starts there) in the same request — no extra request like core's automatic ranges need.
Ruling: picked ranges narrow core's request to their outer bounds (core holds one range per field); RangeListQuery swaps that clause for the exact "any of" clause in the engine query and registers a clause-less facet filter so SingleQuery counts the range aggregation without the price pick.
Ruling: PerAttribute groups facet filters by field: one count request per active field with all its aggregations (same numbers as before for one bucket per field; no extra request for the ranges aggregation).
Ruling: the layer filter hands its ranges to the mapper through RangeLists (request-scoped), and the registration is taken once, so a later request in the same process cannot inherit it.
Finding: Hyvä's group template falls back to the list template for unknown display types, so ranges render as options before S6's own template.
Finding (tests): my expectations for automatic ranges were wrong twice (a bucket at display 20.00 belongs to 20–40; 10–56 gives steps of 10, not 20) — the code was right; the integration test now checks against the catalog model.
Tests: unit 420 (NiceRanges 6, RangeListQuery 4 incl. SingleQuery wrapping, RangeListItems 4, codec ranges, PerAttribute per field, FilterBlock ranges); integration 165 (RangeListsTest 8) + performance 17/17 (−43.3 ms); coverage gate ok (Search 93 %, Url 99.5 %, ViewModel 98.5 %); PHPCS zero; PHPStan clean; Playwright admin 26/26 (m5-ranges 2 on the real store, EUR), storefront 129 + 10 skipped.
Commits: core e4f59ae (feat/m5-s3-ranges, PR #45, matrix run 38639520862), dev-env m5-ranges spec; E2E run 38639528362 with S3.
CI: S3 full matrix green (run 38639520862, every version and engine).

## S4 · Category tree with multi-select
Ruling: the tree replaces core's drill-down only in "Category tree" mode (list = 1.0 drill-down, unchanged); picks stay on the page (?cat=ids) and count only when below the page's category.
Ruling: picks are one terms clause on category_ids next to the page's own category filter (CategoryPicks, taken once per request); the tree is counted by core's category_bucket with include = the tree's nodes, wrapped by SingleQuery without the picks.
Ruling: the codec owns `cat` only in tree mode (ids validated against the cached tree, canonical order = depth-first tree order); the layer filter decides which picks are below the page.
Finding: Magento cleans the general category tag (cat_c) only for new, deleted, moved categories or a changed include-in-menu; a plain save (rename) cleans only cat_c_<id>. The tree cache therefore carries cat_c and every category's own tag (caught by the integration test "rebuilt when a category is saved").
Finding: StoreInterface has no getRootCategoryId(); the root comes from the store group (PHPStan + unit test).
Finding: the tree page needs fewer SQL queries than core's drill-down (core runs getChildrenCategories per request): 100 vs 118 alone, 106 vs 125 in the suite.
Tests: unit 427; integration 175 (CategoryTreeTest 6, BudgetTest +4: one request, tree ≤ core drill-down SQL) + performance 17/17 (−54.6 ms); coverage gate ok; PHPCS zero; PHPStan clean; Playwright admin 27/27 (m5-category-tree on Women › Tops), storefront 129 + 10 skipped.
Commits: core f505018 (feat/m5-s4-category, PR #46, matrix 38642371107), dev-env tree spec; E2E 38642378157.
CI: S4 full matrix green (run 38642371107); E2E with S4 green on Hyvä 1.4.2 and 1.5.2 (run 38642378157; S3's run was cancelled by it).

## S5 · Where it shows, Sort filters, preview
Ruling: "Where it shows" is global (like the other settings), matches the page's category and every category above it (a rule on Tops covers Tees), and never applies on search pages; stored in openfilter_filter_category (show/hide rows), read into the cached filter config — 0 extra SQL on the storefront.
Ruling: Sort filters is its own admin page (ordered list, drag handle + Move up / Move down) instead of Magento's dynamic-rows drag, which is mouse-only; positions are written as 10, 20, 30… in one transaction; the list's ends are aria-disabled (not disabled) so focus stays on the button.
Ruling: the preview link lives in the "Why is this filter not showing?" panel (it already picks a store view and a category) and comes from the category's URL rewrite in that store view; new dependency magento/module-url-rewrite (^102.0, core).
Finding: FilterConfigRepository::save compared the new category rule with the "current" config, but getByCode() returns the provider's cached object, so the caller's setters had changed "current" too and the rule was never written — now always written (integration test FilterVisibilityTest found it).
Finding: Magento's escapeHtmlAttr writes spaces as &#x20; (test assertions on attributes use the escaped form).
Finding: the category picker shows a category's path ("Default Category / Women / Tops"), which tells same-named categories apart; Playwright picks by that path.
Tests: unit 440; integration 190 (FilterVisibilityTest 7, SortAndWhereTest 8) + performance 17/17 (−34.1 ms); coverage gate ok; PHPCS zero; PHPStan clean; Playwright admin 30/30 (m5-admin 3 incl. axe on the sort list), storefront 129 + 10 skipped. Screenshots s5-sort-filters.png, s5-where-it-shows.png.
Commits: core 2221a41 (feat/m5-s5-admin, PR #47, matrix 38646153924), dev-env m5-admin spec + screenshots; E2E 38646161170.
CI: S5 full matrix green (run 38646153924); E2E with S5 green on Hyvä 1.4.2 and 1.5.2 (run 38646161170).
Process fix (dev-env 44eab80): in CI every Playwright project runs in one command, so the serial admin project (whose specs change settings the storefront reads: URL names, ranges, the category tree, where filters show) could overlap the parallel storefront projects; in CI it now depends on them. Locally unchanged.

## S6 · Storefront modes (Hyvä)
Ruling: tooltips and "all must match" are a visible hint at the top of the open group (a summary must not contain a button, hover-only content fails on touch screens, and a hint needs no JavaScript) instead of an info-button popover.
Ruling: the dropdown is a native select in a GET form: works without JavaScript (button), the option id goes through the normaliser's 301 to the canonical URL; with JavaScript a change loads in place (and is staged in apply mode, like any pick).
Ruling: the horizontal bar moves the filter dialog to the top of the content and switches the page to one column (Hyvä keeps a sidebar column otherwise); the sidebar's other blocks are left out on those pages; groups start closed (popovers), one open at a time; phones keep the drawer.
Ruling: the 1.1 behaviour lives in js/extras.phtml (1.49 KB gzipped), printed only on store views that use a mode; the main component got a staging hook and exports (6,090 of 6,144 bytes).
Ruling: the sticky sidebar needs the theme's grid to let the filter sidebar span the product rows: the only theme selectors in OpenFilter's CSS, behind :has(.of-drawer--sticky) (StorefrontCssTest allows exactly that form).
Finding: Hyvä's .columns grid sizes row 1 to the sidebar (868 px), so a sticky dialog inside it cannot move; the second sidebar fills row 2.
Finding: printing class names through escapeHtmlAttr writes spaces as &#x20; — the 1.0 markup changed until the fixed names printed unescaped (AjaxComponentTest caught it).
Finding: a stale "Show N products" label after Reset let a test click before staging finished — the label is cleared when the bar hides.
Finding (tests): contexts created with browser.newContext() do not inherit the project's baseURL.
Tests: core unit 444 (FilterBlock 4 new), hyva unit 19 (Ajax extras 5 cases, extras budget/CSP), hyva integration 34 (StorefrontModesTest 6), core integration 190 + performance 17/17 (−39.8 ms); PHPCS zero; PHPStan clean; Playwright storefront 129 + 10 skipped (defaults unchanged), admin 39/39 (m5-storefront-modes 10: desktop, phone, no-JS, axe, CSP), perf 4/4, Lighthouse on/off PASS.
Commits: core 93eaa42 (PR #48), hyva 505d5f1 (PR openfilter-hyva#18, openfilter-ref = feat/m5-s6-storefront), dev-env b8345db; E2E 38652306373 (core + hyva S6).

## S7 · SEO templates and XML sitemap
Ruling: templates (title, meta description, H1; store view scope) apply on filtered category pages only; search pages are NOINDEX and keep Magento's tags; {filters} lists the active values in the page's order; a title template never changes the H1.
Ruling: the sitemap lists exactly the pages the robots rule leaves INDEX (one value of an indexable select/multiselect filter), only where the filter shows (path match: a category counts with the ones below it), with ≥ N products counted as shoppers see them, most products first, capped per store view (default 5,000); priority, change frequency and lastmod are the categories'. Off by default.
Ruling: the admin gets the length limits in the field comments (60 / 160 characters) instead of a live preview — the system configuration page has no storefront context to render {category}/{filters}; noted for the 1.2 admin pass.
Finding: core's title block (Magento\Theme\Block\Html\Title) reads only the value set through setPageTitle(), and the category block sets the category name that way; setData('page_title') changed nothing (SeoTemplatesTest).
Finding: removeSharedInstance() exists only on the integration-test object manager — the sitemap counter would have crashed on a real store (PHPStan caught it; the integration tests could not). Core's shared search criteria builder appends every filter and never clears them, so each category needs its own: CategoryCollectionFactory creates the engines' `elasticsearchCategoryCollection` with a fresh builder (Magento cannot generate a factory for Fulltext\Collection, so it is hand-written).
Finding: the template tidy-up removed the space before "|" ("Tops| Luma") — unit test.
Finding (CI): dev-env PR runs installed OpenFilter main, where openfilter_filter_category does not exist, so every admin spec's snapshot failed; E2E now reads the branches from ci/openfilter-refs when not dispatched (this branch: feat/m5-s7-seo; back to main when M5 merges).
Tests: core unit 461 (SeoTemplates 7, FilterPages 7, OptionCounts 2, tree path), hyva unit 21 (H1 template extras on/off); coverage gate adds Model/Sitemap (100 %); integration 199 (SeoTemplatesTest 4, Sitemap\FilterPagesTest 5 vs the catalog model, via Magento's composite provider) + hyva 34 + performance 17/17 (−39.0 ms); PHPCS zero; PHPStan clean; Playwright storefront 129 + 10 skipped, admin 41/41 (m5-seo 2: after every swap = direct load, no-JS), perf 4/4, Lighthouse PASS.
Commits: core aa04e2f (PR #49), hyva (PR openfilter-hyva#19, openfilter-ref = feat/m5-s7-seo), dev-env 2a3b390 + 51ca4be; full matrix 38656746635, E2E 38656749187. S6 E2E 38652306373 green.
