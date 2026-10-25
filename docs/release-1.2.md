# OpenFilter 1.2 release runbook

Prepared in M6 (2026-10-25). Tags and GitHub releases are created by Claude without a separate go (Iman, 2026-10-25).
Order: M6 slices merged → rc1 → README gate → 1.2.0, each step core → hyva → bundle.

## 0. Preconditions

- [ ] M6 merged into `main`: core S0–S10 (+ README #82), hyva S2–S4, S9; dev-env specs S1–S11 with the visual baselines.
- [ ] `openfilter-hyva/.github/ci/openfilter-ref` and `openfilter-dev-env/ci/openfilter-refs` point to `main`.
- [ ] CI green on core and hyva `main`; E2E green on dev-env `main` with `bench=true` (benchmark gate) and the visual checks.
- [x] Upgrade gate: 1.1.1 store → main: no differences on 10 pages (2026-10-25, local).

## 1. Release candidate

One release PR per repository (`chore: 1.2.0-rc1`, CHANGELOG `[Unreleased]` → `[1.2.0-rc1] - <date>`), tags `v1.2.0-rc1`
in the order core → hyva → bundle, GitHub pre-releases. The bundle's constraints move to `iranimij/openfilter ^1.2` and
`iranimij/openfilter-hyva ^1.2` (the hyva package reads 1.2 settings and view models).

## 2. README install gate on rc1

```bash
gh workflow run E2E --repo iranimij/openfilter-dev-env -f readme=true -f openfilter_constraint='^1.2@RC' -f bench=true
```

## 3. 1.2.0

Same as step 1 with `1.2.0`, releases without `--prerelease`; notes from `docs/release-notes-1.2.md` with the benchmark
table of the release run (`bench/results/latest.json` of the E2E). Then: ledger, Notion (03 rows "shipped in v1.2.0",
04 roadmap M7 = 1.3, 07 build log), Hyvä tracker entry, Mage-OS Lab proposal draft.
