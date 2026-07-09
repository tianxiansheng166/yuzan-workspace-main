# BASELINE-READINESS

## 1. Final Status

- Status: `BASELINE_PARTIAL`
- Ready to dispatch Wave 0 tasks: `No`

`BASELINE_READY` was not reached because:

- `git status` on `main` is not clean (`258` entries remain).
- All five task worktrees are not clean (`259` entries each).
- `pnpm lint` and `pnpm test` still fail because `packages/contracts` hits the known OpenAPI lint errors reserved for `GOV-002`.
- `pnpm check` still fails before linting because `prettier --check .` reports formatting issues in `147` files.

## 2. Login Shell Toolchain

- `bash -lc 'node --version'` -> `v24.18.0`
- `bash -lc 'npm --version'` -> `11.16.0`
- `bash -lc 'pnpm --version'` -> `10.13.1`
- `bash -lc 'which node'` -> `/home/admin01/.nvm/versions/node/v24.18.0/bin/node`
- `bash -lc 'which pnpm'` -> `/home/admin01/.nvm/versions/node/v24.18.0/bin/pnpm`
- NVM init already existed in `~/.bashrc`; no duplicate loader block was added.

## 3. pnpm Build Script Approval

- `pnpm approve-builds` approved only the requested 7 locked packages.
- `pnpm ignored-builds` now reports `None`.
- `pnpm install --frozen-lockfile` -> passed
- `pnpm rebuild` -> passed

Approved packages and observed locked versions/source chains:

| Package           | Version  | Observed source chain                                                                  |
| ----------------- | -------- | -------------------------------------------------------------------------------------- |
| `@parcel/watcher` | `2.5.6`  | `apps/web -> nuxt@4.4.8 -> listhen@1.10.0 -> @parcel/watcher@2.5.6`                    |
| `@prisma/engines` | `7.8.0`  | `infra/database -> prisma@7.8.0 -> @prisma/engines@7.8.0`                              |
| `core-js`         | `3.32.1` | `packages/contracts -> @redocly/cli dependency graph -> core-js@3.32.1`                |
| `esbuild`         | `0.28.1` | `apps/web -> nuxt/nitropack/vite dependency graph -> esbuild@0.28.1`                   |
| `prisma`          | `7.8.0`  | `infra/database/package.json -> prisma@^7.8.0 -> lock to 7.8.0`                        |
| `protobufjs`      | `7.6.5`  | `OpenTelemetry stack -> @opentelemetry/otlp-transformer@0.53.0 -> protobufjs@7.6.5`    |
| `unrs-resolver`   | `1.12.2` | `eslint-plugin-import-x@4.17.1 -> eslint-import-context@0.1.9 -> unrs-resolver@1.12.2` |

The approval list was persisted in `yuzan-next/pnpm-workspace.yaml` under `onlyBuiltDependencies`.

## 4. Docker / Compose / Registry Diagnostics

- `docker --version` -> `29.1.3`
- Original state: `docker compose` missing, only `docker-compose 1.29.2`
- Installed official Compose v2 package: `docker-compose-v2 2.40.3+ds1-0ubuntu1~24.04.1`
- `docker compose version` -> `2.40.3+ds1-0ubuntu1~24.04.1`
- `docker info` -> daemon healthy
- `getent hosts registry-1.docker.io` -> resolved successfully
- `curl -I https://registry-1.docker.io/v2/` -> `HTTP/2 401`, which is the expected unauthenticated registry handshake
- `env | grep -i proxy` -> no proxy environment variables
- Existing Docker config already had third-party registry mirrors present in daemon config; this round did **not** change or add any mirror settings

## 5. Service Status

- `docker pull postgres:17-alpine` -> passed
- `docker pull minio/minio:latest` -> passed
- `docker compose config` -> passed
- `docker compose up -d postgres minio` -> passed
- `docker compose ps` final:

```text
NAME                    IMAGE                COMMAND                  SERVICE    CREATED         STATUS                   PORTS
yuzan-next-minio-1      minio/minio:latest   "/usr/bin/docker-ent…"   minio      4 minutes ago   Up 4 minutes             0.0.0.0:9000-9001->9000-9001/tcp, [::]:9000-9001->9000-9001/tcp
yuzan-next-postgres-1   postgres:17-alpine   "docker-entrypoint.s…"   postgres   4 minutes ago   Up 4 minutes (healthy)   0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
```

Service log summary:

- PostgreSQL initialized successfully and reached `healthy`
- MinIO initialized successfully and remained `Up` without restart loops

## 6. Prisma / Database

- Root `.env` exists
- `DATABASE_URL` exists in root `.env`
- Fix applied: `infra/database/prisma.config.ts` now explicitly loads the repo-root `.env` via Node 24 `loadEnvFile(...)`
- `pnpm db:generate` -> passed
- `pnpm db:validate` -> passed
- Safe migration command found in repo: `pnpm db:migrate` -> `pnpm --filter @yuzan/database migrate:dev`
- Actual migration execution:
  - command run: `pnpm db:migrate`
  - interactive migration name entered: `baseline_init`
  - result: migration created and applied
  - generated path: `infra/database/prisma/migrations/20260708174110_baseline_init/migration.sql`

## 7. Validation Results

| Command                  | Result | Notes                                                                                          |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------- |
| `pnpm contract:validate` | Failed | Known `GOV-002` OpenAPI issues; `18` errors, primarily missing operation `summary` fields      |
| `pnpm lint`              | Failed | Failure comes from `packages/contracts` running the same Redocly OpenAPI lint                  |
| `pnpm typecheck`         | Passed | After adding `apps/web/tsconfig.json`; Nuxt/Volar emitted plugin warnings but exited `0`       |
| `pnpm test`              | Failed | Failure comes from `packages/contracts` running the same Redocly OpenAPI lint                  |
| `pnpm build`             | Passed | Full workspace build completed                                                                 |
| `pnpm check`             | Failed | Stops at `prettier --check .`; reports formatting issues in `147` files before lint/test/build |

## 8. contract:validate Error Summary

Known reserved-for-`GOV-002` failure set observed:

- `18` Redocly errors
- Main recurring error: operation objects missing `summary`
- Representative failing paths:
  - `/health/live`
  - `/health/ready`
  - `/auth/login`
  - `/auth/refresh`
  - `/auth/logout`
  - `/me`
  - `/course-versions`
  - `/classes`
  - `/assignments`
  - `/students/me/today`
  - `/activities/{activityId}/progress`
  - `/submissions/{submissionId}/feedback`
  - `/sync/push`
  - `/sync/pull`

Warnings also observed for missing `license`, localhost server URL, and missing tag descriptions.

Full logs are stored under:

- `runtime-reports/baseline-logs/contract_validate.log`
- `runtime-reports/baseline-logs/lint_final.log`
- `runtime-reports/baseline-logs/test_final.log`

## 9. Git / Worktree State

- Main branch HEAD before this round: `6db5f8e 初始化项目：语赞心声 yuzan-next`
- Baseline commit created on `main`: `3bf720579637b679c97d7b319f141045e0aafd6a`
- Commit message: `chore: baseline environment readiness fixes`

Files included in the baseline commit:

- `apps/web/tsconfig.json`
- `infra/database/prisma.config.ts`
- `infra/database/prisma/migrations/20260708174110_baseline_init/migration.sql`
- `infra/database/prisma/migrations/migration_lock.toml`
- `pnpm-workspace.yaml`

Current status after commit:

- `main` worktree: not clean (`258` entries)
- `worktrees/gov-001`: not clean (`259` entries)
- `worktrees/gov-002`: not clean (`259` entries)
- `worktrees/gov-003`: not clean (`259` entries)
- `worktrees/gov-004`: not clean (`259` entries)
- `worktrees/mig-001`: not clean (`259` entries)

Additional uncommitted runtime artifacts now present on `main` include:

- `infra/database/generated/`

## 10. Files Modified This Round

Committed:

- `yuzan-next/apps/web/tsconfig.json`
- `yuzan-next/infra/database/prisma.config.ts`
- `yuzan-next/infra/database/prisma/migrations/20260708174110_baseline_init/migration.sql`
- `yuzan-next/infra/database/prisma/migrations/migration_lock.toml`
- `yuzan-next/pnpm-workspace.yaml`

Generated but not committed:

- `yuzan-next/infra/database/generated/**`
- `runtime-reports/baseline-logs/*.log`
- `runtime-reports/BASELINE-READINESS.md`

## 11. Failed Commands and Reasons

- `pnpm contract:validate`
  - reason: known OpenAPI lint errors reserved for `GOV-002`
- `pnpm lint`
  - reason: `packages/contracts` lint delegates to Redocly and fails on the same known OpenAPI errors
- `pnpm test`
  - reason: `packages/contracts` test delegates to Redocly and fails on the same known OpenAPI errors
- `pnpm check`
  - reason: `prettier --check .` fails on `147` files before the rest of the composite script can finish

Previously fixed in this round:

- `pnpm db:generate` / `pnpm db:validate`
  - original failure: Prisma could not resolve `DATABASE_URL` from subdirectory execution
  - fix: explicit root `.env` loading in `infra/database/prisma.config.ts`
- `pnpm typecheck` / `pnpm build`
  - original failure: `apps/web` missing `tsconfig.json`
  - fix: added `apps/web/tsconfig.json` extending `./.nuxt/tsconfig.json`

## 12. Overall Conclusion

Environment baselines are now reproducible enough to:

- open a fresh login shell with Node 24 and pnpm 10.13.1
- install and rebuild approved native/build-script dependencies
- use official Docker Compose v2
- run PostgreSQL and MinIO locally
- generate, validate, and migrate Prisma successfully
- complete workspace `typecheck` and `build`

But the repository is still **not ready** for formal Wave 0 dispatch because:

- main and all task worktrees are dirty
- `lint` and `test` are still blocked by the known OpenAPI contract failures
- `check` is still blocked by broad formatting drift across the repository
