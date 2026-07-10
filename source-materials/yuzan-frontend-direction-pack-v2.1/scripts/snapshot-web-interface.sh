#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-.}"
OUT="${2:-.local/interface-baseline/default}"
cd "$REPO"
mkdir -p "$OUT"

find apps/web/app/pages -type f -name '*.vue' -print \
  | LC_ALL=C sort > "$OUT/page-files.txt"

find apps/web/app/middleware apps/web/app/plugins apps/web/server \
  -type f 2>/dev/null | LC_ALL=C sort > "$OUT/runtime-files.txt" || true

find apps/web/app packages/contracts \
  -type f \( -path '*/ports/*' -o -path '*/adapters/*' -o -path '*/state/*' \
  -o -path '*/runtime/*' -o -path '*/lib/api/*' \) \
  -print 2>/dev/null | LC_ALL=C sort > "$OUT/protected-files.txt" || true

while IFS= read -r f; do
  [[ -f "$f" ]] && sha256sum "$f"
done < "$OUT/protected-files.txt" > "$OUT/protected-sha256.txt"

rg -n --no-heading \
  '(/api/v1/|/auth/|/me\b|operationId|@yuzan/contracts|useFetch|[$]fetch|fetch\()' \
  apps/web/app 2>/dev/null \
  | sed -E 's/^[^:]+:[0-9]+://' \
  | LC_ALL=C sort -u > "$OUT/api-references.txt" || true

find apps/web/tests -type f 2>/dev/null \
  | LC_ALL=C sort > "$OUT/test-files.txt" || true

git rev-parse HEAD > "$OUT/base-commit.txt"
git status --porcelain > "$OUT/base-status.txt"

echo "INTERFACE_SNAPSHOT_READY=$OUT"
