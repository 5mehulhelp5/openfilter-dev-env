# openfilter-dev-env

Fixture store and end-to-end tests for [OpenFilter](https://github.com/iranimij/openfilter), the free MIT layered navigation for Magento 2 and Hyvä.

The store: Magento Open Source 2.4.9 with sample data (2,040 products), Hyvä 1.4.2 (OSL packages), OpenSearch, Varnish in front, storefront CSP **enforced**, OpenLabel 1.1 installed (OpenFilter is always tested next to it), a German store view `de` with German colour option labels (Grün, Weiß, …) and catalog price rules that give General (−10 %), Wholesale (−20 %) and Retailer (−15 %) different prices. Both OpenLabel and OpenFilter build on the shared core module [`iranimij/module-base`](https://github.com/iranimij/module-base).

This repository versions only the environment definition, setup scripts and Playwright tests. The Magento installation created by `bin/setup` is ignored.

## Build the store (Warden)

```bash
cp .env.example .env && cp admin.env.example admin.env   # set an admin password
warden sign-certificate openfilter.test
warden env up -d
bin/setup            # Magento + sample data, Hyvä (bin/install-hyva), OpenLabel + OpenFilter (bin/install-modules), fixture data
bin/install-hyva15   # Hyvä 1.5.2 as a second theme for store view "hyva15" (local 1.5 gate), then fixture data again
```

Store views: `default` (Hyvä 1.4.2), `de` (German), `hyva15` (Hyvä 1.5.2, copied from the public tag under the theme name `OpenFilterFixture/hyva-1-5-2`; the fixture module `app/code/OpenFilterFixture/Themes` tells Hyvä it is a base theme) and `ar` (ar_SA, right to left through the child theme `app/design/frontend/OpenFilterFixture/hyva-rtl`).

- Store: https://app.openfilter.test/ · admin: https://app.openfilter.test/admin (credentials in `admin.env`; two-factor auth and admin URL secret keys are off on this dev store only).
- `./hyva` holds only the OSL/AFL-licensed Hyvä theme packages; nothing proprietary.
- `./modules` holds the OpenFilter checkouts (`openfilter`, `openfilter-hyva`, `openfilter-hyva-bundle`), installed through a Composer path repository with version overrides (1.0.0) so `^1.0` constraints resolve.
- On Apple Silicon the OpenSearch image is pinned to `opensearchproject/opensearch:2.5.0` (`.warden/warden-env.yml`).
- Docker memory: Docker Desktop has 16 GB (since 2026-10-13), so several Warden stacks (openfilter, openlabel, openimport) run side by side; within one stack, never run integration tests and Playwright at the same time.

## Playwright

```bash
cd playwright && npm ci && npx playwright install chromium
npx playwright test                          # all projects
npx playwright test --project=desktop-h14 --project=desktop-h15
npm run perf          # timing budgets (swap ≤ 300 ms, no long task > 50 ms), one worker
npm run lighthouse    # OpenFilter on vs off: CLS, score, bytes (writes lighthouse-report/)
```

Storefront projects run once per Hyvä version: `desktop-h14` / `desktop-h15`, `mobile-h14` / `mobile-h15` (`*.mobile.spec.ts`), `nojs-h14` / `nojs-h15` (`nojs/`, JavaScript disabled); `desktop-rtl` (`rtl/`) runs on store view `ar`. The `store-setup` project saves each store view's `store` and `X-Magento-Vary` cookies (never the session cookie). Specs import `test` from `tests/fixture.ts`, whose `request` fixture carries those cookies, and read the Hyvä version from the project (`isHyva15()`). `admin-chromium` (`admin/`, one login, serial). CI (`.github/workflows/e2e.yml`) builds the same store from public sources with `ci/install-fixture.sh`, one leg per Hyvä version installed as the default theme (`OF_THEMES=h14:default` or `h15:default`); `workflow_dispatch` takes `openfilter_ref` / `openfilter_hyva_ref` for stacked branches.

## GitHub activity window

`bin/after-hours` exits 1 during working hours (Mon–Fri 08:00–18:00 Europe/Berlin). Pushes, pull requests, merges, tags and repository changes happen only after hours.

## Licence

MIT, see [LICENSE](LICENSE).
