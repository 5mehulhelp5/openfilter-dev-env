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

## S3 · Quick filter bar
Ruling: the bar sits at the top of `#of-state`, so every AJAX swap refreshes it with no script; picked values first, then by product count (insights can reorder later), up to the store's size (0 = off, the default). Built from Magento's shared filter lists (they keep the page's filters per layer): no extra search request.
Tests: unit QuickBarTest; hyva QuickBarTest (off by default, the pick first and marked); Playwright admin m6-quick-bar 4/4 (swap, axe, no JavaScript, off).

## S4 · More products (load more / infinite scroll)
Ruling: a separate static script (`js/more.phtml`, 1,147 B gzipped) printed only when chosen; mode and texts in `#of-more-config` (no PHP inside the script, so its CSP registration stays stable). The main script lends its script runner (`window.openFilter.run`, +8 B: 5,698 / 6,144 B).
Ruling: the address stays the first page's; the next pages' URLs live in sessionStorage, so Back from a product loads the same pages again (when the browser has no back/forward cache).
Finding: `window.openFilter` exists only once Alpine has started the main component; a script printed after it must wait for `alpine:initialized`.
Tests: hyva unit (budget, Ajax::pagination), integration (script only when chosen); Playwright admin m6-load-more 5/5 (button, focus, live region, pager moves on, Back, infinite stops after two pages, no JavaScript).

## S5 · All Products page
Ruling: a small frontend router (after Magento's URL rewrite router, before the standard one) instead of URL rewrites: no rows to keep in sync with settings saved through `bin/magento config:set`, and an address another page has keeps it. It sets the URL rewrite router's request alias, so `_use_rewrite` filter links keep the URL key.
Ruling: the page is the store's root category on Magento's layered category page (its handles added by the controller), so theme templates, OpenFilter's Hyvä templates, AJAX and SEO rules apply unchanged; title, H1 and canonical are set once the blocks exist (Magento's category view block names the page after the category while the layout is built).
Finding: integration tests must dispatch storefront paths with a leading slash for routers that read the path info.
Tests: unit AllProductsTest, RouterTest; integration AllProductsPageTest (404 when off, title, one canonical, links keep the URL key, 301 to the URL key); Playwright admin m6-all-products 3/3.

## S6 · Path filter URLs
Ruling: *SEO › Filter URLs on category pages* = *Paths* (`/women/tops-women/color-black,blue/size-m.html`) is opt-in; query parameters stay the default, and search pages and the All Products page keep them. Segments follow the canonical filter order; a filter whose segment could read as another stays in the query.
Ruling: `Controller\PathRouter` runs before Magento's URL rewrite router, moves the filter segments into query values and lets the URL rewrite router find the category: the same one rewrite lookup, no extra SQL, one search request. The normaliser 301s query links (including the no-JavaScript slider and dropdown forms) and other segment orders to the canonical path; canonical tags and the XML sitemap follow.
Tests: unit 536 (PathUrlTest), integration 234 (PathUrlsTest: same products as the query twin, 301s, 404, one search request, SQL no more than the query twin) + hyva 40, performance 17/17; Playwright storefront 141, admin 63 (m6-path-urls 3/3).
Commits: core PR #69.

## S7 · Landing pages
Ruling: a landing page is a category with fixed filters at its own URL key, with its own title, H1, meta tags, robots value and text. The merchant pastes the address of a filtered category page (query or path URLs) instead of picking filters one by one; URL keys taken by a category, product, CMS page or another landing page of the same store views are refused.
Ruling: a router after Magento's URL rewrites serves the URL key as the category page with the filters applied (same templates, counts, chips, AJAX). Filter links that reach exactly a landing page's state point to it, and the filtered category page names it canonical. Pages come from the OpenFilter cache: no SQL on the storefront. Indexable pages are in the XML sitemap; GraphQL `openfilter_landing_page(url_key)`.
Finding: admin specs snapshot OpenFilter's tables; the landing tables (`openfilter_landing_page_store` before its parent) are now part of that list.
Tests: unit 555, integration 243 + hyva 40, performance 17/17 (+3.5 ms); CI green; E2E run 40142672766 green on Hyvä 1.4.2, 1.5.2 and the README leg (Playwright admin m6-landing 2/2).
Commits: core PR #75.

## S8 · Migration from other filter modules
Ruling: redirects of old filter URLs are opt-in per store view (*Moving from another filter module › Redirect old filter URLs*). A router after URL rewrites, landing pages and the All Products page answers them with a 301 to OpenFilter's URL of the same category and filters (query or path format). Formats come only from the vendors' public user guides (Amasty, Mirasvit, Mageplaza; cited in `docs/migration.md`). Nothing is guessed: unknown words, or an option name two filters share without its attribute, stay 404.
Ruling: `bin/magento openfilter:migrate` lists other filter modules still enabled and the command to switch them off, the filters taken over and the redirect state; `--redirects=on|off`, `--filter-keys`, `--urls=<file>` (dry run). The doctor gains *No other layered navigation module is enabled*.
Commits: core PR #76 (CI fixes for PHPUnit 9 data providers and a fixture-independent shared-name test; E2E 40153081312 green; merged 2026-10-25), spec dev-env #11.

## Hand-off (2026-10-25)
The background session that merged S7 and S8 ran in a git worktree on the laptop (the "remote" isolation fell back to a local worktree); it stopped while building S9 when its worktree was removed. Its uncommitted S9 core work was saved as a WIP commit and finished in the laptop session.

## S9 · Merchant insights
Ruling: opt-in per store view and anonymous. A beacon (`POST /openfilter/insights/collect`, no form key so full-page-cached pages can send it) carries the store view, category, active filters and a product count bucket; every key and value is checked against the store view's active filters; counts are added per day, store view, category, filter and value (one upsert per beacon), a nightly cron job removes days past the retention, Magento's visitor log skips the route. Nothing about the shopper is read or stored.
Ruling: the Insights page lists the most used filters and values, unused filters, combinations without products, filters worth indexing and a suggested order that *Sort filters* shows for review (nothing saved before *Save order*).
Ruling: the Hyvä script (`js/insights.phtml`, 340 B gzipped, budget 768 B) is static and printed only when on; it reads `#of-insights` of the page, or of the fetched page after a swap (`openfilter:swapped` carries the document).
Finding: a template that throws (here the Hyvä S9 template on a core without S9) makes Magento log the error and send the page uncacheable (`no-store`), silently: the benchmark's Varnish row showed 0 of 6. Keep both module repositories on matching branches locally.
Tests: unit 612, integration CollectTest/PurgeTest/InsightsPageTest 17/17, hyva StorefrontModesTest 9/9 and the budget test; Playwright admin m6-insights 4/4; E2E 40179208590 green on both legs.
Commits: core #77, hyva #37, dev-env #12.

## Fixes found in M6 (released as 1.1.1)
Finding: Magento's Varnish configuration sorts query parameters alphabetically (`std.querysort` in `vcl_recv`). The normaliser 301ed filter URLs to the filters' own parameter order, so behind Magento's VCL any non-alphabetical order looped ("too many redirects"). Hidden until now: the sample data's positions tie and ties fall back to the filter code, which happens to be alphabetical; Warden's own VCL does not sort. S10's install order (price before colour) exposed it in CI. Fix: the parameter order alone never redirects (core #80).
Finding: the desktop apply bar is appended to `body`, outside the elements that define OpenFilter's colour variables, so it had no background, border or button colour (core #79). Found by S11's visual checks.
Release: v1.1.1 from `release/1.1.x` (core #81), tagged and released 2026-10-25; on Packagist.

## S10 · Admin polish
Ruling: *Set up OpenFilter* above the Filters grid: five steps whose state comes from what was saved (first-run flag, a saved order, display and SEO settings, cache state), hidden on request; the install order does not count as the merchant's.
Ruling: the Why panel opens with one status line (the first problem and its fix; "on search result pages" when only those miss the filter), the checks fold below.
Ruling: a live preview with a real category, two option labels and the store name under the SEO templates; the count measures the preview.
Ruling: new installs get category, price, swatch filters, then the others, written as sort positions by the install patch (it runs once, so existing shops keep their order). Uninstall removes OpenFilter's admin flags.
Finding: the new order changed several specs' assumptions (groups open by default, parameter and segment order); specs now pin or accept the order.
Commits: core #78, dev-env feat/m6-s10-spec.

## S11 · Visual checks and benchmark scenarios
Ruling: `toHaveScreenshot` baselines are rendered by the CI runner (Linux), one folder per Hyvä version and device (`visual-h14`, `visual-mobile-h15` …); the E2E input `update_snapshots` writes and uploads them; locally the visual projects only run on Linux or with OF_VISUAL_ANY=1 to try selectors.
Ruling: the benchmark adds a path URL, the next page as *Load more* fetches it and a landing page, each set up for the OpenFilter run only.
Tests: local benchmark (3 runs): 1 engine request in every OpenFilter scenario against Magento's 4; Varnish serves 6 of 6 of the second shopper's clicks.

## S12 · Close
Upgrade gate (2026-10-25, local): a store on core 1.1.1 + Hyvä 1.1.0 captured, upgraded to main (with S10), compared: no differences on 10 pages.

