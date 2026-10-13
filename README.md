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
```

- Store: https://app.openfilter.test/ · admin: https://app.openfilter.test/admin (credentials in `admin.env`; two-factor auth and admin URL secret keys are off on this dev store only).
- `./hyva` holds only the OSL/AFL-licensed Hyvä theme packages; nothing proprietary.
- `./modules` holds the OpenFilter checkouts (`openfilter`, `openfilter-hyva`, `openfilter-hyva-bundle`), installed through a Composer path repository with version overrides (1.0.0) so `^1.0` constraints resolve.
- On Apple Silicon the OpenSearch image is pinned to `opensearchproject/opensearch:2.5.0` (`.warden/warden-env.yml`).
- Docker memory: run one Magento stack at a time, and never run integration tests and Playwright at the same time.

## Playwright

```bash
cd playwright && npm ci && npx playwright install chromium
npx playwright test                          # all projects
npx playwright test --project=desktop-chromium
```

Projects: `desktop-chromium`, `mobile-chromium` (`*.mobile.spec.ts`), `nojs-chromium` (`nojs/`, JavaScript disabled), `admin-chromium` (`admin/`, one login, serial). CI (`.github/workflows/e2e.yml`) builds the same store from public sources with `ci/install-fixture.sh` on Hyvä 1.4.2 and 1.5.2.

## GitHub activity window

`bin/after-hours` exits 1 during working hours (Mon–Fri 08:00–18:00 Europe/Berlin). Pushes, pull requests, merges, tags and repository changes happen only after hours.

## Licence

MIT, see [LICENSE](LICENSE).
