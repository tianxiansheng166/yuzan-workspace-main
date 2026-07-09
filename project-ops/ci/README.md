# CI baseline

This directory documents the repository CI and local verification approach.

## GitHub Actions

- `.github/workflows/ci.yml` is the main workflow.
- It runs on every pull request and on pushes to `main`.
- Required gating jobs:
  - `format` — `pnpm format:check` plus `git diff --check`.
  - `web` — install, prepare Nuxt, test, typecheck and build `@yuzan/web`.
- Experimental job:
  - `root-baseline` — runs `contract:validate`, `db:validate`, `lint`,
    `typecheck`, `test`, `build` at the repository root. It is marked
    `continue-on-error: true` until GOV-002 "root-level baseline" is finalized
    and merged. Failures here are visible in the logs but do not block merges.

## Local verification

Run the web-layer check script:

```bash
bash scripts/ci/verify-web.sh
```

This script does not run root-level checks that depend on the pending GOV-002
baseline.

## Known limitations

- Root-level contract, database and recursive lint/typecheck/test/build checks
  may fail because the GOV-002 baseline is still provisional. Do not treat those
  failures as blockers for web-only changes.
- `verify-web.sh` expects Node 24 and pnpm 10 to be available.
