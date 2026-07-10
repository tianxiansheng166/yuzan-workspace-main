#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
REPO_ROOT="${2:-$(pwd)}"
TARGET="$REPO_ROOT/source-materials/yuzan-frontend-direction-pack-v2.1"

git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null

if [[ -e "$TARGET" ]]; then
  echo "TARGET_ALREADY_EXISTS=$TARGET" >&2
  exit 42
fi

mkdir -p "$(dirname "$TARGET")"
cp -a "$SOURCE_DIR" "$TARGET"

echo "DESIGN_PACK_INSTALLED"
echo "target=$TARGET"
echo "runtime_import_allowed=no"
echo "next=append project-adapter/asset-register-import.csv after deduplication"
