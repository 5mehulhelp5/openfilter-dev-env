#!/usr/bin/env bash
# Installs OpenFilter on the fixture store exactly as the README tells a stranger to: the commands between
# <!-- install:start --> and <!-- install:end --> in iranimij/openfilter's README (at OPENFILTER_REF), run from the
# Magento root one by one. The store was built with OPENFILTER_INSTALL=none; nothing else is done here, so a README
# that forgets a step fails this job.
set -euo pipefail

: "${MAGENTO_ROOT:?}" "${OPENFILTER_REF:=main}"
# OPENFILTER_README: a local README instead of the one on GitHub (local checks).
# OPENFILTER_CONSTRAINT: e.g. "^1.0@RC" while only a release candidate exists (Magento projects are stability-stable);
#   the only change made to the README's commands, appended to the bundle in its composer require.
# OPENFILTER_DRY_RUN=1: print the commands instead of running them.
readme="${OPENFILTER_README:-}"
if [ -z "$readme" ]; then
  readme="$(mktemp)"
  curl -fsSL "https://raw.githubusercontent.com/iranimij/openfilter/${OPENFILTER_REF}/README.md" -o "$readme"
fi
commands="$(awk '/<!-- install:start -->/{on=1; next} /<!-- install:end -->/{on=0} on' "$readme" \
  | sed -n '/^```/,/^```/p' | grep -v '^```' | sed '/^[[:space:]]*$/d')"
if [ -z "$commands" ]; then
  echo "No install commands between <!-- install:start --> and <!-- install:end --> in the README (${OPENFILTER_REF})"
  exit 1
fi
if [ -n "${OPENFILTER_CONSTRAINT:-}" ]; then
  commands="$(sed -E "s#(composer require .*iranimij/openfilter-hyva-bundle)( |\$)#\1:${OPENFILTER_CONSTRAINT}\2#" <<< "$commands")"
fi
if [ "${OPENFILTER_DRY_RUN:-0}" = 1 ]; then
  printf '%s\n' "$commands"
  exit 0
fi
cd "$MAGENTO_ROOT"
while IFS= read -r command; do
  echo "::group::README: $command"
  bash -euo pipefail -c "$command"
  echo "::endgroup::"
done <<< "$commands"
