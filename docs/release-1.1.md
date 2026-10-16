# OpenFilter 1.1 release runbook

Prepared in M5 (2026-10-15). Every step that tags, releases or publishes runs **only after Iman's explicit go**
(GitHub activity itself is allowed at any time since 2026-10-14). Order: **1.0.0 released first** (docs/release-1.0.md)
→ M5 merged → rc1 → README gate → 1.1.0.

## 0. Preconditions

- [ ] v1.0.0 tagged on `openfilter`, `openfilter-hyva`, `openfilter-hyva-bundle` (1.1 is cut after it; the 1.0 search
      paging fix, openfilter-hyva#20 + openfilter#53, is part of 1.0).
- [ ] M5 stacks merged in order into `main`: openfilter #42 → #54 (+ S12), openfilter-hyva #18 → #19 (+ S12),
      dev-env #6. Rebase each slice on `main` after the 1.0 release commits if GitHub reports conflicts
      (CHANGELOG headings: the 1.1 section sits above `[1.0.0]`).
- [ ] `openfilter-hyva/.github/ci/openfilter-ref` and `openfilter-dev-env/ci/openfilter-refs` point to `main`.
- [ ] CI full matrix green on `openfilter` main (2.4.7 OpenSearch + ES8, 2.4.8, 2.4.9 × PHP 8.2–8.4, Performance);
      CI green on `openfilter-hyva` main; E2E green on dev-env main **with `bench=true`** (benchmark gate).
- [ ] Upgrade gate: on a 1.0.0 store, `node playwright/scripts/upgrade-gate.mjs capture /tmp/of-1.0.json`, then
      `composer require iranimij/openfilter-hyva-bundle:^1.1@RC && bin/magento setup:upgrade && bin/magento cache:flush`,
      then `node playwright/scripts/upgrade-gate.mjs compare /tmp/of-1.0.json` → "no differences" (M5: 10 pages, none).

## 1. Release candidate (after Iman's go)

As 1.0 step 1 with `1.1.0-rc1`: one release PR per repository (`chore: 1.1.0-rc1`, CHANGELOG `[1.1.0] - unreleased`
→ `[1.1.0-rc1] - <date>`), tags `v1.1.0-rc1` in the order core → hyva → bundle, GitHub pre-releases. The bundle's
constraints move to `iranimij/openfilter ^1.1` and `iranimij/openfilter-hyva ^1.1` (1.1 needs both 1.1 packages:
the hyva package reads the 1.1 settings).

## 2. README install gate on rc1

```bash
gh workflow run E2E --repo iranimij/openfilter-dev-env -f readme=true -f openfilter_constraint='^1.1@RC' -f bench=true
```

## 3. 1.1.0 (after Iman's go)

Same as step 1 with `1.1.0`, release without `--prerelease`; release notes from the CHANGELOG 1.1 section plus the
benchmark table (`openfilter/docs/benchmark.md`, results attached by the E2E run as `bench/results/latest.json`).

## 4. After the release

- 03 · Feature Superset: 1.1 rows marked shipped; build log entry.
- Hyvä compatibility tracker entry updated (1.1 modes, GraphQL).
- Headless example announced with the docs page `graphql.md`.
