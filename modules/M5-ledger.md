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
