#!/usr/bin/env bash
#
# Fetches the noise-benchmark corpus into a durable cache directory and
# records the commit each target is pinned to.
#
# The corpus used to live in /tmp, where macOS reaping silently emptied it and
# made a recorded baseline impossible to reproduce. Keep it out of /tmp.
#
# Usage:
#   ./benchmarks/fetch-corpus.sh              # clone anything missing
#   UXLINT_CORPUS=/path ./benchmarks/fetch-corpus.sh
#
# Then:
#   npm run build
#   node benchmarks/noise-benchmark.mjs "$UXLINT_CORPUS"/*

set -euo pipefail

CORPUS="${UXLINT_CORPUS:-$HOME/.cache/uxlint-benchmark-corpus}"

REPOS=(
  "shadcn-ui/taxonomy"
  "excalidraw/excalidraw"
  "shadcn-ui/ui"
  "mantinedev/mantine"
  "vercel/commerce"
)

mkdir -p "$CORPUS"

for repo in "${REPOS[@]}"; do
  name="$(basename "$repo")"
  target="$CORPUS/$name"

  if [ -d "$target/.git" ]; then
    echo "have $name"
  else
    echo "clone $name"
    rm -rf "$target"
    git clone --quiet --depth 1 "https://github.com/$repo.git" "$target"
  fi
done

echo ""
echo "corpus: $CORPUS"
echo ""
printf '%-14s %-12s %s\n' "TARGET" "COMMIT" "SOURCE FILES"
for repo in "${REPOS[@]}"; do
  name="$(basename "$repo")"
  target="$CORPUS/$name"
  commit="$(git -C "$target" rev-parse --short HEAD)"
  files="$(find "$target" -name '*.tsx' -o -name '*.jsx' | grep -vc node_modules || true)"
  printf '%-14s %-12s %s\n' "$name" "$commit" "$files"
done
