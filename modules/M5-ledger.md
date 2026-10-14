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
