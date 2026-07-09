# GOV-002 baseline status

## Task

GOV-002 establishes the root-level baseline for lint, typecheck, test and build
across all workspace packages, including contract validation and database schema
validation.

## Current status

GOV-002 is **provisional and not yet merged** into `main`.

## Impact on CI

- Root-level checks (`pnpm contract:validate`, `pnpm db:validate`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build`) are run in the CI `root-baseline`
  job as an experimental check.
- This job is configured with `continue-on-error: true` so that known baseline
  failures do not block web-layer changes.
- Once GOV-002 is merged, the `root-baseline` job should be switched to required
  and any remaining failures fixed.

## What is gated today

- `format` — Prettier formatting for the whole repository.
- `web` — test, typecheck and build of `@yuzan/web`.

## Local verification

Developers should run `bash scripts/ci/verify-web.sh` for the gated web-layer
checks.
