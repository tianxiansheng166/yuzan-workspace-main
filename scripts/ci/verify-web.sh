#!/usr/bin/env bash
set -euo pipefail

# Local verification script for the web layer.
# Does NOT run root-level checks affected by the pending GOV-002 baseline.
# For full repository checks, see .github/workflows/ci.yml (root-baseline job).

export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
export NUXT_TELEMETRY_DISABLED=1

echo "==> install"
pnpm install --frozen-lockfile

echo "==> nuxt prepare"
pnpm --filter @yuzan/web exec nuxt prepare

echo "==> web test"
pnpm --filter @yuzan/web test

echo "==> web typecheck"
pnpm --filter @yuzan/web typecheck

echo "==> web build"
pnpm --filter @yuzan/web build

echo "==> format check"
pnpm format:check

echo "==> git whitespace check"
git diff --check

echo "==> web verification passed"
