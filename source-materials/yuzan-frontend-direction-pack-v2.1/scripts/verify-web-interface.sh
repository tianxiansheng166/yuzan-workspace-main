#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-.}"
BASELINE="${2:?baseline directory required}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$SCRIPT_DIR/snapshot-web-interface.sh" "$REPO" "$TMP/current" >/dev/null

status=0

compare_required() {
  local name="$1"
  if ! diff -u "$BASELINE/$name" "$TMP/current/$name"; then
    echo "INTERFACE_CHANGE_DETECTED=$name" >&2
    status=1
  fi
}

# These must remain byte-identical for visual-only streams unless explicit scope says otherwise.
compare_required protected-files.txt
compare_required protected-sha256.txt
compare_required runtime-files.txt

# Existing page and test files may be added, but not removed.
comm -23 "$BASELINE/page-files.txt" "$TMP/current/page-files.txt" \
  > "$TMP/removed-pages.txt" || true
comm -23 "$BASELINE/test-files.txt" "$TMP/current/test-files.txt" \
  > "$TMP/removed-tests.txt" || true
comm -23 "$BASELINE/api-references.txt" "$TMP/current/api-references.txt" \
  > "$TMP/removed-api-references.txt" || true

for f in removed-pages removed-tests removed-api-references; do
  if [[ -s "$TMP/$f.txt" ]]; then
    echo "INTERFACE_REMOVAL_DETECTED=$f" >&2
    cat "$TMP/$f.txt" >&2
    status=1
  fi
done

if [[ "$status" -ne 0 ]]; then
  echo "INTERFACE_VERIFICATION_FAILED" >&2
  exit 51
fi

echo "INTERFACE_VERIFICATION_PASSED"
