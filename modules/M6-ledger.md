# M6 ledger · release 1.2 (professional edge)

Plan: `~/.claude/plans/pasted-content-id-96ce-read-https-app-n-eager-hinton.md` (approved 2026-10-16, Notion D20). One PR per slice on `main`, merged when CI and E2E are green. 1.3 (Luma package, ElasticSuite adapter) is M7.

## S0 · Config for 1.2
Ruling: the 1.2 store settings (pagination, URL format, quick bar, All Products, insights) arrive with the slice that uses them, so no inert setting ever sits on `main`; S0 is the per-filter fields only.
Ruling: `depends_values` holds the parent's option ids (stable across store views and URL name changes); the export writes the parent's option keys (admin labels), the import maps them back and refuses unknown ones, so files still move between installations.
Finding: the CI integration scripts and the E2E fixture installed every OpenFilter branch as version 1.0.0; since 1.1 the Hyvä package requires `openfilter ^1.1`, so branch installs could not resolve. Both now read the branch's own `dev-main` alias (core #61 for CI, dev-env #9 for the fixture).
Tests: unit 503, integration 214 (+ 1.2 settings persisted), PHPCS zero, PHPStan clean.
Commits: core PR #63.

## S1 · Dependent filters
Ruling: one rule class (`Model\Config\DependencyRule`) used by the filter list, the codec, GraphQL and the repository. Picks of a filter that does not show are pruned in `UrlCodec` on decode and encode: every link drops them with the parent's pick, the page state never applies them (Magento applies only the filters in the list), and old links 301 through the existing normaliser.
Ruling: parents offered in the form = every other filter; values = options (≤ 200), rating levels, on/off, the merchant's price ranges; sliders and the category filter wait for any pick.
Finding: Magento's ui-select has no `setOptions`; a component that swaps its list must set `cacheOptions.plain/tree` (filtering and captions read the cache) and the `options` observable.
Tests: unit 509 (DependencyRule, codec pruning, filter list, form meta), integration 222 (DependentFiltersTest, GraphQL), performance 17/17; Playwright admin m6-dependent 6/6.
Commits: core PR #64, dev-env PR #9.

## S2 · Option images
Ruling: one display type *Images* (label always shown, for accessibility) instead of separate "images" and "images and labels"; it reuses the swatch template, and GraphQL reports the images through the existing `swatch` field (no schema change).
Ruling: images only for attributes without swatches (swatch attributes have their own pictures) and the same in every store view; edited with *All Store Views*.
Finding: Magento's media gallery integration plugs into `Catalog\Model\ImageUploader` (plugins reach virtual types too) and imports every moved file into the gallery, which refuses folders outside its own ("Could not import media assets"); OpenFilter has its own small uploader on `MediaStorage` with the image adapter's validation.
Finding: `m2-config` (settings page validation message) fails now and then in a full admin run and passes alone; seen before M6 changes, watched.
Tests: unit 518, integration 223 + hyva 37, PHPCS zero, PHPStan clean; Playwright admin 52 (m6-option-images: upload, image served on the storefront, removal).
Commits: core PR #65, hyva PR #28.
