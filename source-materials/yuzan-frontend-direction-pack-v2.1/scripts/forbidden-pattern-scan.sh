#!/usr/bin/env bash
set -euo pipefail
WEB_ROOT="${1:-apps/web}"
UI_ROOT="${2:-packages/ui}"

patterns=(
  'backdrop-filter'
  'YUZAN NEXT · BRAND SYSTEM'
  'CORE VALUE'
  'BRAND PRINCIPLES'
  'Unified App Shell'
  '开发预览'
  '#F7F2E8'
  '#EFE4D2'
)

status=0
for p in "${patterns[@]}"; do
  if rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!.nuxt/**' --fixed-strings "$p" "$WEB_ROOT" "$UI_ROOT" 2>/dev/null; then
    echo "FORBIDDEN_PATTERN_FOUND=$p" >&2
    status=1
  fi
done

exit "$status"
