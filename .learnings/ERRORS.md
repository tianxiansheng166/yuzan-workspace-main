# Error Log

## [ERR-20260714-001] pnpm-install-offline

- Logged: 2026-07-14T02:11:51+08:00
- Priority: medium
- Status: resolved
- Area: dependencies / runtime
- Command: `pnpm install --offline`
- Result: `ERR_PNPM_NO_OFFLINE_META` for the newly declared `pg` dependency range; pnpm also reported that Node.js v22.19.0 does not satisfy the repository engine requirement (`>=24 <27`).
- Impact: generated Prisma client and package validation cannot rely on a fresh offline install yet.
- Resolution: activated Node 24.18.0 through `fnm`, then `corepack pnpm install` completed successfully.

## [ERR-20260714-002] generic-prettier-prisma

- Logged: 2026-07-14T02:14:00+08:00
- Priority: low
- Status: resolved
- Area: formatting
- Command: `pnpm exec prettier --write <all changed files>`
- Result: Prettier formatted supported files but returned non-zero because it cannot infer a parser for `schema.prisma`.
- Resolution: exclude Prisma schema and SQL migration files from the generic Prettier pass; use `prisma format` for the schema.

## [ERR-20260714-003] prisma-config-env

- Logged: 2026-07-14T02:16:00+08:00
- Priority: low
- Status: resolved
- Area: local worktree setup
- Command: `pnpm --filter @yuzan/database exec prisma format`
- Result: Prisma config failed while loading the worktree root `.env`, which is intentionally ignored and therefore absent in a fresh worktree; the wrapper then surfaced a misleading `prisma not found` line.
- Resolution: copy the existing ignored local environment file into the isolated worktree without printing or committing it, and invoke the package script (`pnpm --filter @yuzan/database format`).

## [ERR-20260714-004] contract-generator-node24-windows

- Logged: 2026-07-14T02:18:00+08:00
- Priority: medium
- Status: resolved
- Area: contracts / Windows tooling
- Command: `pnpm contract:types`
- Result: the repository generator uses `spawnSync("pnpm.cmd", ...)`, which fails with `EINVAL` under the available Node 24.18.0 Windows runtime. OpenAPI validation itself passed with two pre-existing warnings.
- Resolution: generated through the same binaries, then updated the generator and its test helper to opt into a shell only for Windows command shims. This retains the existing fixed command and argument list while making Node 24 able to launch `pnpm.cmd`.

## [ERR-20260714-005] api-typecheck-before-database-build

- Logged: 2026-07-14T02:20:00+08:00
- Priority: low
- Status: resolved
- Area: validation ordering
- Command: `pnpm --filter @yuzan/api typecheck`
- Result: the fresh worktree had no `infra/database/dist`, so TypeScript could not resolve the workspace package and cascaded into missing PrismaService members.
- Resolution: build `@yuzan/database` before running the API typecheck in a fresh worktree.

## [ERR-20260714-006] local-postgres-port-conflict

- Logged: 2026-07-14T02:23:00+08:00
- Priority: low
- Status: resolved
- Area: local integration environment
- Command: `docker compose up -d postgres`
- Result: the worktree-local PostgreSQL container could not bind port 5432 because another project owns it.
- Resolution: removed only the newly created stopped worktree container and retained its recoverable volume; use the already running Yuzan PostgreSQL instance on its dedicated mapped port from the copied local environment.

## [ERR-20260714-007] shared-postgres-credentials-and-seed-import

- Logged: 2026-07-14T02:25:00+08:00
- Priority: medium
- Status: resolved
- Area: database integration
- Commands: `prisma migrate deploy`; `node --experimental-strip-types prisma/seed.ts`
- Result: the copied environment does not authenticate against the pre-existing shared Yuzan container, and the source-mode seed imported the generated Prisma client with a `.js` suffix even though Prisma's source generator emits `client.ts`.
- Resolution: use a task-owned PostgreSQL container on port 55433 with the repository's development-only credentials and override `DATABASE_URL` only in validation commands. Prisma's generated TypeScript internally imports `.js` modules, so the seed script now builds the database package first and imports the compiled client from `dist`.

## [ERR-20260714-008] filtered-api-start-env-cwd

- Logged: 2026-07-14T02:27:00+08:00
- Priority: low
- Status: resolved
- Area: local runtime
- Command: `pnpm --filter @yuzan/api start`
- Result: pnpm starts in `apps/api`, so Nest could not find the root ignored `.env` and rejected the missing `SESSION_SECRET`.
- Resolution: launch the already-built API from repository root with Node's `--env-file=.env`, while overriding only the task database URL in the process environment.

## [ERR-20260714-009] playwright-python-selection

- Logged: 2026-07-14T02:29:00+08:00
- Priority: low
- Status: resolved
- Area: browser validation
- Command: `python .runtime/recon.py`
- Result: the default Python 3.12 environment does not contain Playwright.
- Resolution: use the installed Python 3.10 interpreter, which already provides the Playwright package and browser driver.

## [ERR-20260714-010] volunteer-link-strict-selector

- Logged: 2026-07-14T02:31:00+08:00
- Priority: low
- Status: resolved
- Area: browser test harness
- Command: volunteer browser journey
- Result: the expected training link correctly appeared in both global navigation and page content, causing Playwright's strict locator assertion to reject the ambiguous two-element selector.
- Resolution: assert and click the first visible link while retaining the duplicate occurrence as evidence that both global and contextual entry points exist.

## [ERR-20260714-011] training-hydration-race

- Logged: 2026-07-14T02:32:00+08:00
- Priority: low
- Status: resolved
- Area: browser test harness
- Command: volunteer browser journey
- Result: checking the progress button count immediately after navigation raced the asynchronous training render; the later assertion snapshot showed both real save buttons.
- Resolution: explicitly wait for either a save button or persisted marker before deciding which state to assert.

## [ERR-20260714-012] inline-sql-shell-quoting

- Logged: 2026-07-14T02:34:00+08:00
- Priority: low
- Status: resolved
- Area: validation harness
- Command: inline Node PostgreSQL count query
- Result: nested PowerShell and JavaScript quoting corrupted the quoted mixed-case PostgreSQL table name.
- Resolution: construct the identifier quote with `String.fromCharCode(34)` inside JavaScript, avoiding cross-shell quote interpretation.

## [ERR-20260714-013] powershell-dynamic-route-literal-path

- Logged: 2026-07-14T02:36:00+08:00
- Priority: low
- Status: resolved
- Area: repository inspection
- Command: `Get-Content apps/web/app/pages/student/learning/[activityId].vue`
- Result: PowerShell treated square brackets in the Nuxt route filename as a wildcard expression.
- Resolution: use `Get-Content -LiteralPath` for dynamic route filenames.

## [ERR-20260714-014] powershell-rg-pattern-quoting

- Logged: 2026-07-14T02:40:00+08:00
- Priority: low
- Status: resolved
- Area: repository inspection
- Command: a PowerShell `rg` command containing nested quote characters
- Result: PowerShell rejected the unterminated pattern string before running ripgrep.
- Resolution: inspect the small Vue file directly and use a scoped DOM selector (`.reports ol > li a`) in the browser journey.

## [ERR-20260714-015] teacher-class-link-expectation

- Logged: 2026-07-14T02:42:00+08:00
- Priority: low
- Status: resolved
- Area: browser test harness
- Command: teacher browser journey
- Result: the preserved VM class detail page intentionally exposes assessment and assessment-report links, not assignment-detail links.
- Resolution: assert the repaired real assessment route on class detail, then enter the assignment list and assignment detail through their actual global upstream navigation.

## [ERR-20260714-016] review-status-text-selector

- Logged: 2026-07-14T02:44:00+08:00
- Priority: low
- Status: resolved
- Area: browser test harness
- Command: teacher feedback journey
- Result: filtering an entire review card by `NEEDS_REVIEW` also matched the explanatory helper sentence present in every card, selecting a newer submitted attempt rather than the seeded review-ready attempt.
- Resolution: scope the filter to the status paragraph inside `.identity`, then publish feedback only against the actual `NEEDS_REVIEW` record.

## [ERR-20260714-017] live-report-summary-used-duplicate-dto

- Logged: 2026-07-14T02:46:00+08:00
- Priority: high
- Status: resolved
- Area: reporting connectivity
- Command: teacher report browser journey
- Result: the report list did not generate the student-growth upstream link because the runtime imports `dto/report-response.ts`, while the first edit had updated the similarly named unused `dto/report.response.ts` only.
- Resolution: add `enrollmentId` and `classId` to the actual runtime response mapper, rebuild/restart the API, and repeat the browser journey.

## [ERR-20260714-018] playwright-query-url-glob

- Logged: 2026-07-14T02:49:00+08:00
- Priority: low
- Status: resolved
- Area: browser test harness
- Command: teacher student-growth report navigation
- Result: Playwright recorded the correct `/reports/students/{id}?from=/reports` navigation, but the terminal `*` URL glob did not accept the query-bearing URL as expected.
- Resolution: wait on a URL-string predicate that checks the route segment, preserving verification of the actual generated source query. Python Playwright passes the URL as a string rather than a parsed URL object.

## [ERR-20260714-019] responsive-navigation-session-rerender

- Logged: 2026-07-14T02:53:00+08:00
- Priority: low
- Status: resolved
- Area: browser test harness
- Command: responsive role navigation journey
- Result: the harness opened navigation and performed several assertions before clicking; during that interval the session/navigation computed tree rerendered and closed the responsive menu, leaving the target link present but hidden.
- Resolution: wait one Vue navigation tick after each URL change before opening the menu; then click the secondary route immediately, reopen on the destination, and verify account actions and forbidden-role links before returning home.

## [ERR-20260714-020] public-home-duplicate-teacher-cta

- Logged: 2026-07-14T02:56:00+08:00
- Priority: low
- Status: resolved
- Area: browser test harness
- Command: role-mismatch recovery journey
- Result: the preserved public homepage provides both a feature card and a text CTA for `/teacher`, so a strict unscoped locator matched two real entry points.
- Resolution: click the first visible homepage CTA; the middleware outcome is independent of which duplicate contextual entry generated the navigation.

## [ERR-20260714-021] stale-source-contract-tests

- Logged: 2026-07-14T03:00:00+08:00
- Priority: medium
- Status: resolved
- Area: web package tests
- Command: `pnpm --filter @yuzan/web test`
- Result: two source-string tests still required hardcoded AppShell routes and whitespace-free media queries after navigation moved to the registry and Prettier normalized CSS. A translation test also expected the explicit phrase “未接入” while the truthful 404 message only said “暂不可用”.
- Resolution: make the shell test assert registry-derived entries, accept valid CSS whitespace in the page guardrail test, and clarify the translation failure as “尚未接入或暂不可用”.

## [ERR-20260714-022] full-api-suite-role-fixtures-and-test-db

- Logged: 2026-07-14T03:12:00+08:00
- Priority: high
- Status: resolved
- Area: API full-suite validation
- Command: `pnpm --filter @yuzan/api test`
- Result: seven unit expectations still modeled volunteer operations with STUDENT or PLATFORM_ADMIN roles after VOLUNTEER became formal; integration suites also lacked an isolated, migrated test database URL.
- Resolution: migrated volunteer self-service fixtures to MembershipRole.VOLUNTEER, asserted PLATFORM_ADMIN self-enrollment is forbidden, migrated the task-owned `yuzan_runtime_test` database, and passed all 782 API tests.

## [ERR-20260714-023] policy-file-path-assumption

- Logged: 2026-07-14T03:14:00+08:00
- Priority: low
- Status: resolved
- Area: repository inspection
- Command: inspect presumed `modules/*/domain/*.policy.ts` paths
- Result: the repository stores policy files at each module root, so two read-only `Get-Content` paths failed after the relevant test excerpts had printed.
- Resolution: locate policy sources with `rg --files` before reading them; no files were changed by the failed command.

## [ERR-20260714-024] error-log-encoding-anchor

- Logged: 2026-07-14T03:15:00+08:00
- Priority: low
- Status: resolved
- Area: learning log maintenance
- Command: append ERR-022 and ERR-023 with `apply_patch`
- Result: the first patch used mojibake copied from default PowerShell output as its context anchor, so verification failed without changing the file.
- Resolution: reread the tail as UTF-8 and use the actual Chinese text as the patch anchor.

## [ERR-20260714-025] isolated-test-database-bootstrap

- Logged: 2026-07-14T03:20:00+08:00
- Priority: medium
- Status: resolved
- Area: API integration-test database
- Command: inspect/create `yuzan_runtime_test` and run filtered Prisma migration
- Result: the task-owned container returned no database query output, the script called `.Trim()` on null, and `pnpm --filter @yuzan/database prisma` selected no package script; PowerShell still returned exit 0 from the final command.
- Resolution: verified the exact running container, created the missing database directly, invoked `pnpm --filter @yuzan/database migrate:deploy`, and used that isolated URL for the passing API suite.

## [ERR-20260714-026] package-lint-prerequisites

- Logged: 2026-07-14T03:24:00+08:00
- Priority: medium
- Status: resolved
- Area: final lint validation
- Command: lint API, Web, database, and contracts packages
- Result: database and OpenAPI lint completed, but Web ESLint could not import ungenerated `.nuxt/eslint.config.mjs`, while API ESLint could not resolve the config's `@eslint/js` import. Typechecks exited successfully, with the existing non-fatal Vue/Volar route-block plugin warning.
- Resolution: audited both package configurations. Database and contract lint pass; API/Web lint remain repository-level baseline gaps (API has 589 existing errors once its missing config dependency is temporarily supplied; Web declares but does not enable the Nuxt ESLint module). The temporary API dependency was removed to avoid unrelated package changes.

## [ERR-20260714-027] nuxt-prepare-missing-eslint-config

- Logged: 2026-07-14T03:28:00+08:00
- Priority: medium
- Status: resolved
- Area: Web lint configuration
- Command: add API's missing direct ESLint config dependency, run `nuxt prepare`, then lint API and Web
- Result: Nuxt generated types but still did not create `.nuxt/eslint.config.mjs`; the recursive lint stopped on the same missing generated module before reporting API completion. The install also surfaced a pre-existing Nuxt ESLint peer mismatch between `@eslint/js` 10 and ESLint 9.
- Resolution: confirmed `nuxt.config.ts` does not enable `@nuxt/eslint`, so prepare cannot produce the imported config. Recorded this as a non-blocking baseline toolchain issue; no broad ESLint/Nuxt upgrade or unrelated configuration change was made.

## [ERR-20260714-028] runtime-cleanup-child-handle

- Logged: 2026-07-14T03:34:00+08:00
- Priority: low
- Status: resolved
- Area: task-owned development runtime cleanup
- Command: stop exact worktree process IDs and remove verified `.runtime`
- Result: one esbuild child exited between lookup and stop, and a compiled API child whose command used a relative path retained two log handles after its parent shell stopped; PowerShell continued and left those two files.
- Resolution: resolved PID 20104 from task API port 4000, stopped only that process, and successfully removed the verified worktree-local `.runtime` directory.

## [ERR-20260714-029] absent-base-orchestration-path

- Logged: 2026-07-14T03:39:00+08:00
- Priority: low
- Status: resolved
- Area: final VM-route report audit
- Command: search `orchestration`, `PROJECT-CHARTER.md`, and Web sources for a named five-route VM list
- Result: the task base commit does not contain the top-level charter path present in the integration worktree instructions, so `rg` returned exit 1 after finding only Web-source VM references.
- Resolution: rely on the already executed visual/browser coverage and report the preserved high-value route families explicitly, without inventing an unavailable canonical five-route list.

## [ERR-20260717-001] canonical-root-runtime-environment

- Logged: 2026-07-17T09:18:00+08:00
- Priority: high
- Status: resolved
- Area: local runtime and browser validation
- Command: start the canonical root API/Nuxt runtime and execute four-role browser journeys
- Result: the previous Nuxt listener was an old V4-adoption worktree; the new API initially missed root `.env` because the filtered package runs from `apps/api`; the browser's IPv4 `127.0.0.1` target was refused while Nuxt listened through `localhost`.
- Resolution: stopped only the identified old process, made `integration/four-port-role-navigation-connectivity-003` the root checkout branch after a verified recovery snapshot, loaded root `.env` into the API launch process, and used `localhost` for browser journeys. API runs on 4000, Nuxt runs on 3000, and all tested routes originate from the canonical root checkout.
