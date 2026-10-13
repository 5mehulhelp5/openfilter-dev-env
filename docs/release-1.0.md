# OpenFilter 1.0 release runbook

Prepared in M4 (2026-10-13). Every step that touches GitHub or Packagist runs **after hours only**
(`bin/after-hours` exits 0) and **only after Iman's explicit go**. Order: M3 merged (Iman's yes) → M4 merged →
rc1 → Packagist (Iman) → README gate → 1.0.0.

## 0. Preconditions (all green, links in PROGRESS.md)

- [ ] M0–M4 merged into `main` of `openfilter`, `openfilter-hyva`, `openfilter-dev-env`; bundle `chore/m4-release` merged.
- [ ] CI full matrix green on `openfilter` main (incl. job "Performance"), CI green on `openfilter-hyva` main.
- [ ] E2E green on dev-env main (Hyvä 1.4.2 and 1.5.2 legs, timing budgets, Lighthouse on/off).
- [ ] `openfilter-hyva/.github/ci/openfilter-ref` says `main`.

## 1. Release candidate (Claude Code, after Iman's go)

One release PR per repository (as OpenLabel's `chore: 1.0.0-rc1`): CHANGELOG `[Unreleased]` → `[1.0.0-rc1] - <date>`.

```bash
bin/after-hours || exit 1
for repo in openfilter openfilter-hyva openfilter-hyva-bundle; do
  cd modules/$repo && git switch main && git pull --ff-only
  git switch -c release/1.0.0-rc1
  sed -i '' 's/^## \[Unreleased\]/## [1.0.0-rc1] - '"$(date +%F)"'/' CHANGELOG.md
  git commit -am "chore: 1.0.0-rc1" && git push -u origin release/1.0.0-rc1
  gh pr create --base main --title "chore: 1.0.0-rc1" --body "Release candidate 1.0.0-rc1."
  cd -
done
# after the three PRs are green and merged:
for repo in openfilter openfilter-hyva openfilter-hyva-bundle; do
  (cd modules/$repo && git switch main && git pull --ff-only && git tag -a v1.0.0-rc1 -m "OpenFilter 1.0.0-rc1" && git push origin v1.0.0-rc1)
done
gh release create v1.0.0-rc1 --repo iranimij/openfilter --prerelease --title "OpenFilter 1.0.0-rc1" --notes-file docs/release-notes-1.0.md
gh release create v1.0.0-rc1 --repo iranimij/openfilter-hyva --prerelease --title "OpenFilter for Hyvä 1.0.0-rc1" --notes "See https://github.com/iranimij/openfilter/releases/tag/v1.0.0-rc1"
gh release create v1.0.0-rc1 --repo iranimij/openfilter-hyva-bundle --prerelease --title "OpenFilter bundle 1.0.0-rc1" --notes "See https://github.com/iranimij/openfilter/releases/tag/v1.0.0-rc1"
```

Order matters for Composer: core first, then hyva (requires `iranimij/openfilter ^1.0`), then the bundle.

## 2. Packagist (Iman clicks)

Log in at <https://packagist.org> as `iranimij`, then **Submit** each repository URL, in this order:

1. `https://github.com/iranimij/openfilter` → `iranimij/openfilter`
2. `https://github.com/iranimij/openfilter-hyva` → `iranimij/openfilter-hyva`
3. `https://github.com/iranimij/openfilter-hyva-bundle` → `iranimij/openfilter-hyva-bundle`

Packagist sets up the GitHub hook itself when the account is connected to GitHub (as for OpenLabel); otherwise add it
under each repository's Settings › Webhooks (Packagist shows the URL and token on the package page). Keywords come from
`composer.json` (hyva, layered-navigation, ajax-filters, opensearch, magento2, mage-os). Check that each package page
shows `v1.0.0-rc1` and `dev-main` (alias `1.0.x-dev`).

## 3. README install gate on rc1 (Claude Code, after hours)

```bash
gh workflow run E2E --repo iranimij/openfilter-dev-env -f readme=true -f openfilter_constraint='^1.0@RC'
```

The README leg builds a fresh store, runs only the README's three commands (the bundle required as
`iranimij/openfilter-hyva-bundle:^1.0@RC`, the only change), then the quick start in Playwright
(`readme-chromium`). It must be green before 1.0.0.

## 4. 1.0.0 (after Iman's go)

Same as step 1 with `1.0.0` (`chore: 1.0.0`, CHANGELOG `[1.0.0-rc1]` gets a `[1.0.0] - <date>` heading above it,
release without `--prerelease`). Then:

```bash
gh workflow run E2E --repo iranimij/openfilter-dev-env -f readme=true      # unchanged README commands
gh variable set OPENFILTER_ON_PACKAGIST --repo iranimij/openfilter-dev-env --body true   # README leg on main and nightly
```

The docs site publishes from `openfilter` main through `docs.yml` (GitHub Pages, `gh-pages` branch); check
<https://iranimij.github.io/openfilter/>.

## 5. After the release

- Hyvä compatibility tracker: submit `openfilter/docs/tracker-entry.md` (Iman).
- 03 · Feature Superset: 1.0 rows marked shipped; 07 §8 boxes ticked; build log entry.
- 05 · Go-to-Market launch steps (joint launch with OpenLabel).
