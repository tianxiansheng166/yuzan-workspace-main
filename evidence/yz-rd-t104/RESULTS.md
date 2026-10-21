# YZ-RD-T104 Results

- **STATUS:** Completed quality gate recovery and baseline debt audit.
- **READY_TO_MERGE:** NO
- **DEPLOY:** FORBIDDEN; not performed.
- **SHARED_BRANCH_MERGE:** FORBIDDEN; not performed.

## Scope and source revisions

- Repository/worktree: `/home/tian/code/work/yuzan-workspace-t102`.
- Output branch: `feat/yz-rd-t104-quality-gate-baseline-audit`, created at T102 commit `f28a1461930642bf33010beeedd67b3d88f28851`.
- Comparison control: `0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8` (T102 `BASELINE.md`).
- Comparison tip: `f28a1461930642bf33010beeedd67b3d88f28851`.
- T102 reports read: `evidence/yz-rd-t102/RESULTS.md`, `BASELINE.md`, and `API_AUDIT.md`.
- T102 `AGENTS.md` has no `AA-DEV-V2.2` marker. The mismatch is recorded; this audit followed the supplied safety baseline and the checkout’s task-specific rules.
- No merge, deployment, database service, object store, production data, or authenticated E2E was used.

The task card’s `BASE` is the T102 branch parent (`f28a146…`); `BASELINE` is the source comparison commit (`0a7b931…`). The report uses those names separately to avoid conflating the branch start with the comparison control.

## Toolchain and preparation

| Tool                  | Version             | Evidence                                                            |
| --------------------- | ------------------- | ------------------------------------------------------------------- |
| Node.js               | `v24.20.0`          | Runtime; repository `.nvmrc` specifies Node 24.                     |
| Corepack              | `0.35.0`            | `corepack --version`.                                               |
| pnpm                  | `10.13.1`           | `corepack pnpm --version`; root `packageManager` is `pnpm@10.13.1`. |
| ESLint / `@eslint/js` | `9.39.4` / `9.39.4` | Frozen lockfile resolution.                                         |
| TypeScript            | `5.9.3`             | Frozen lockfile resolution.                                         |
| Vitest                | `3.2.7`             | Frozen lockfile resolution.                                         |
| Prettier              | `3.9.4`             | Frozen lockfile resolution.                                         |

BASE and T102 used the same Node/pnpm versions and the same dependency lock before T104. Their only package manifest difference was the frontend test script. A fresh BASE worktree was installed with `corepack pnpm install --frozen-lockfile --offline` (exit 0).

A first BASE API run before workspace generation/build exited 1: 37 suites failed during import because `@yuzan/database` had no generated/built entry; 679 tests passed and 3 skipped in that failed assembly attempt. This was a fresh-worktree setup failure, not an assertion failure. After repository setup, both revisions were prepared with:

```sh
DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test corepack pnpm db:generate
corepack pnpm --filter @yuzan/database build
```

Both commands exited 0 on BASE and T102. The placeholder URL was used only for Prisma client generation; no database connection was made. The API suite then ran from the same built workspace layout.

## Reproduced checks

The T102 report records the API command as `corepack pnpm --filter @yuzan/api test -- ...`, but omits the selector represented by `...`. I did not infer the missing argument. I reran the package’s exact full-suite script with no test filter; its script is `vitest run --passWithNoTests --pool=forks --poolOptions.forks.singleFork`.

| Check                               | Command                                                                                                                                                                | BASE (`0a7b931`)                                                                                      | T102 (`f28a146`)                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Frontend tests and runtime verifier | `corepack pnpm --filter @yuzan/frontend test`                                                                                                                          | exit 0; 7 passed, 0 failed; runtime verifier passed.                                                  | exit 0; 51 passed, 0 failed; runtime verifier passed.                      |
| Full API suite                      | `corepack pnpm --filter @yuzan/api test`                                                                                                                               | exit 0; 66 files passed, 10 skipped; 1,044 passed / 64 skipped / 0 failed.                            | exit 0; 66 files passed, 10 skipped; 1,072 passed / 64 skipped / 0 failed. |
| API source typecheck                | `corepack pnpm --filter @yuzan/api typecheck`                                                                                                                          | exit 0.                                                                                               | exit 0.                                                                    |
| Frontend typecheck                  | `corepack pnpm --filter @yuzan/frontend typecheck`                                                                                                                     | exit 0.                                                                                               | exit 0.                                                                    |
| Frontend lint                       | `corepack pnpm --filter @yuzan/frontend lint`                                                                                                                          | exit 0.                                                                                               | exit 0.                                                                    |
| Frontend build/runtime verification | `corepack pnpm --filter @yuzan/frontend build`                                                                                                                         | exit 0.                                                                                               | exit 0.                                                                    |
| Changed JS/MJS syntax               | T102: `git diff --name-only 0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8 f28a1461930642bf33010beeedd67b3d88f28851 -- '*.js' '*.mjs' '*.cjs' \| xargs -r -n 1 node --check` | BASE: exit 0; 9 existing files checked, 7 T102-only files absent. T102: exit 0; all 16 files checked. | Both revisions parse.                                                      |
| Course-detail inline script         | Extracted the inline `<script>` from `frontend/student/courses/course-detail/index.html` and ran `node --check` on the temporary file.                                 | N/A; file unchanged at BASE.                                                                          | exit 0.                                                                    |
| `git diff --check`                  | `git diff --check`                                                                                                                                                     | exit 0 on the clean BASE source.                                                                      | exit 0 after T104 edits.                                                   |

T102 added 28 net API tests and 44 net frontend tests relative to BASE. The final full API JSON run reports 0 failed tests. The 64 skipped cases are not counted as passes.

Named API results were captured with `corepack pnpm --filter @yuzan/api exec vitest run --passWithNoTests --pool=forks --poolOptions.forks.singleFork --reporter=json --outputFile=/tmp/yz-t104-base-api.json` on BASE and the same command with `--outputFile=/tmp/yz-t104-t102-api-final.json` on T102 (exit 0 on both). BASE and T102 skip-name sets were compared by file and full test name.

## ESLint recovery and comparison

Before the repair, `corepack pnpm --filter @yuzan/api lint` exited 2 on both BASE and T102 before analyzing source. `backend/api/eslint.config.mjs` imports `@eslint/js`, while `backend/api/package.json` did not declare it. The exact `@eslint/js@9.39.4` package was already present in the lockfile as ESLint’s dependency, but pnpm’s isolated package links did not make that undeclared transitive package importable by the API config.

T104 adds `@eslint/js: 9.39.4` to the API devDependencies and adds only the corresponding importer entry to `pnpm-lock.yaml`. This matches locked `eslint@9.39.4`; no package snapshot or dependency version changed. `corepack pnpm install --frozen-lockfile --offline` exits 0, `require.resolve('@eslint/js', { paths: ['./backend/api'] })` resolves the locked package, and ESLint starts.

Once ESLint started, its `projectService` could not find API test files because `backend/api/tsconfig.json` explicitly excludes `test`. Before the test config fix this produced 156 test-file parser errors on each revision. T104 adds `backend/api/test/tsconfig.json` with the Vitest module settings, allowing the service to analyze tests without changing the production API tsconfig or disabling type-aware rules. The comparison BASE worktree received the same untracked test-config overlay and a temporary symlink to its own frozen `@eslint/js@9.39.4` package; those comparison overlays were not changes to the BASE commit.

With the dependency linked but before adding the test config, both API lint runs reported 1,191 rule errors and 1 warning, including 156 test-project parser errors. With the test config, those parser errors disappear and ESLint reports the test-rule diagnostics instead; the higher lint count reflects that additional analysis.

| ESLint run                                                                                                        | Exit | Result                                                                     |
| ----------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| Native BASE/T102 before dependency repair: `corepack pnpm --filter @yuzan/api lint`                               | 2    | `ERR_MODULE_NOT_FOUND: @eslint/js`; ESLint produced no source diagnostics. |
| BASE with the exact locked package and same test-project config overlay: `corepack pnpm --filter @yuzan/api lint` | 1    | 2,675 errors and 1 warning across 185 files; 0 test-project parser errors. |
| T102 after T104 dependency and test-project fixes: `corepack pnpm --filter @yuzan/api lint`                       | 1    | 2,649 errors and 1 warning across 183 files; 0 test-project parser errors. |

A JSON diagnostic comparison normalized worktree paths and the order-only rendering difference in `Error | Constructable` union messages. Before T104’s test-spec fixes, the test-aware T102 run had 2,689 errors / 1 warning: 21 new findings in the changed assessment/scoring specs and 7 old `require-await` findings removed in the feedback fake/service specs. T104 fixed the 21 new findings with typed fakes, a public submit-flow report assertion, and promise-returning mocks. The final comparison finds 0 diagnostics added and 26 removed versus BASE. The remaining count is baseline lint debt, chiefly type-aware unsafe/unused and `require-await` rules. Changed API source files had these BASE → final counts: `assessment.service.ts` 137→137; deterministic scoring service 2→2; feedback service 2→2; Prisma feedback repository 1→1. The changed feedback fake/service specs improved 4→0 and 3→0; the assessment service spec improved 87→68. No T102-owned API source or test file has an added ESLint diagnostic after T104 repairs.

The standard API typecheck covers `src` and passes on both revisions. To measure test source typing separately, `corepack pnpm --filter @yuzan/api exec tsc -p test/tsconfig.json --noEmit --pretty false` reports 234 errors on BASE and 234 on T102 after T104. Before the fake repository fix, T102 had one additional `TS2322` (`never[]` from an untyped empty fake result); the fake now implements `WrittenAnswerRepositoryPort`, and the new diagnostic is gone. Remaining test-project diagnostics are baseline fixture/type debt (top codes: `TS2322` 59, `TS2345` 44, `TS2532` 37, `TS2375` 21); this separate probe is not the repository’s standard API typecheck.

## Formatting comparison

| Run                                      | Exit | Prettier warning files | Parser-error files |
| ---------------------------------------- | ---- | ---------------------: | -----------------: |
| BASE global `corepack pnpm format:check` | 2    |                    741 |                 12 |
| T102 before T104 focused formatting      | 2    |                    743 |                 12 |
| T102 after T104 focused formatting       | 2    |                    737 |                 12 |

The 12 parser-error paths are identical on BASE and T102 and are unchanged by T102: `frontend/teacher.html`, `frontend/teacher/ai-tools/index.html`, `frontend/teacher/assessments/create/app.js`, `frontend/teacher/assessments/detail/index.html`, `frontend/teacher/assessments/tasks/index.html`, `frontend/teacher/assignments/index.html`, `frontend/teacher/classes/detail/index.html`, `frontend/teacher/classes/index.html`, `frontend/teacher/reviews/submission-1/index.html`, `frontend/teacher/students/demo/index.html`, `frontend/volunteer.css`, and `infra/ai/provider-stub/index.ts`.

T102 introduced seven new whole-file Prettier warnings and removed five BASE warnings. T104 formatted these six paths, removing their new warnings: `evidence/yz-rd-t093/verification.md`, `evidence/yz-rd-t095/RESULTS.md`, `frontend/login/auth-fail-closed.test.mjs`, `frontend/student/courses/course-detail/course-player-state.test.mjs`, `frontend/student/courses/courses.test.mjs`, and `frontend/tests/assessment/t102-unanswered-submit.test.mjs`. The sole remaining new warning is `evidence/yz-rd-t095/api-full-lint.json`, a one-line raw ESLint result retained byte-for-byte as machine evidence. The modified API service/spec and legacy frontend source files that remain formatter warnings already failed the same check on BASE. No broad repository formatting was run. A focused Prettier check on the six repaired files, the new test tsconfig, package manifests, and this T104 report passes.

## T102 feature coverage review

- Frontend: 51/51 pass, including fail-closed login, Today empty/error states, dynamic course/activity IDs, fractional video progress, nested media aliases, Growth data validation/audio mapping, and T099 partial/all-blank Runner regressions. BASE had 7 frontend tests.
- API changed feature specs: 48 new passing full test names across assessment submission/scoring and T095 feedback service/policy suites; 20 prior case names were replaced, for a net +28 tests. The assessment service spec covers empty submissions, persisted nonblank vs blank answers, zero-score/unanswered reporting, remediation subsets, real recording/review preservation, and invalid max-score handling. Deterministic scoring tests cover unanswered published text/choice/speech and invalid scoring configuration. Feedback tests cover class/school/student scope and revision-checked writes.
- T095’s 36 feedback unit cases pass in the API suite. They are fixture/service tests; they do not replace live PostgreSQL concurrency verification.
- The 64 database-gated integrations listed below did not execute. Authenticated browser, live API, PostgreSQL, MinIO, and course playback E2E remain `NOT_RUN`.

## New issues and repair status

| Finding                                                                              | Evidence                                                                                                | Status                                                                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| API ESLint could not import undeclared `@eslint/js`.                                 | Same startup failure on BASE and T102 before analysis.                                                  | Fixed with the API direct devDependency at the exact locked ESLint-matched version.                      |
| ESLint project service rejected test files excluded by the source tsconfig.          | 156 project-service parser errors on each revision before test config overlay.                          | Fixed with a separate test tsconfig; lint now analyzes tests instead of treating them as parse failures. |
| T102-added API test code gained lint findings once the parser could inspect it.      | 21 added findings in the assessment/scoring specs; 7 older feedback-spec findings were removed by T102. | Fixed the 21 additions; final T102 diagnostic delta is 0 added / 26 removed versus BASE.                 |
| T102 fake answer repository inferred `never[]`, causing one new test-project TS2322. | BASE test-project probe 234 errors; T102 initially 235.                                                 | Fixed by typing the fake to `WrittenAnswerRepositoryPort`; T102 now matches BASE at 234.                 |
| T102-added test/docs formatting warnings.                                            | Seven new warning paths versus BASE before T104.                                                        | Six fixed with focused formatting; raw lint JSON remains intentionally unformatted machine evidence.     |
| Full API lint and repository format gates still fail.                                | BASE/T102 lint and format deltas above.                                                                 | Unresolved baseline debt; no broad cleanup performed.                                                    |

## Remaining limitations

- `corepack pnpm --filter @yuzan/api lint` now starts but exits 1 with 2,649 baseline-comparable errors and 1 warning on T102. T102 adds no ESLint diagnostics; lint is not green.
- `corepack pnpm format:check` exits 2 with 737 warning files and 12 parser errors. The 12 parser errors are proven present on the exact BASE.
- The separate test-project TypeScript probe still reports 234 BASE errors and 234 T102 errors. The repository’s production API typecheck remains green.
- All 64 API skips are conditional database gates, not passes. No DB endpoint was configured or accessed.
- Authenticated browser/API/PostgreSQL/MinIO E2E, live course playback, and feedback database concurrency verification remain `NOT_RUN`.

## Changed files, rollback, and delivery

T104 changes only API dependency metadata, the API test-project config, test fakes/specs, focused formatting of T102-added tests/reports, `CURRENT_HANDOFF.md`, and this evidence report. No production application source was changed by T104.

Rollback is one commit: `git revert <T104 checkpoint commit SHA>`. No reset, force-push, shared-branch merge, deployment, or remote configuration change was used.

## API skip inventory (64 cases)

The BASE and T102 JSON reports contain the same 64 skipped test names: added 0, removed 0. Eight cases are guarded by `QB_RUNTIME_DATABASE_URL` (two suites also fall back to `DATABASE_URL`); 56 require `DATABASE_URL`. There are no manual `.skip` or `todo` cases. Both API test shells had these variables unset. Each skipped case is listed below under its exact suite and gate cause.

### `test/assessment/qb015f.teacher-assignment.runtime.integration.spec.ts` — 2 skipped

**Cause:** The suite is guarded by QB_RUNTIME_DATABASE_URL ?? DATABASE_URL; both variables were unset.

- QB-015F teacher assignment — isolated PostgreSQL proves exact candidate snapshots, idempotency, focus coexistence, separation, and scope
- QB-015F teacher assignment — isolated PostgreSQL keeps assigned READ_ALOUD experimental and completes only through teacher review

### `test/assessment/question-bank-deterministic.integration.spec.ts` — 1 skipped

**Cause:** The suite is guarded by QB_RUNTIME_DATABASE_URL ?? DATABASE_URL; both variables were unset.

- Question Bank deterministic scoring — canonical Level 1 integration audits and scores the real published Level 1 versions without logging answer data

### `test/assessment/question-bank-progress.runtime.integration.spec.ts` — 1 skipped

**Cause:** The suite is guarded by QB_RUNTIME_DATABASE_URL; it was unset.

- Question Bank progress — PostgreSQL integration derives same-level 84 → 91 and four-item remediation without a cross-level delta

### `test/assessment/question-bank.runtime.integration.spec.ts` — 2 skipped

**Cause:** The suite is guarded by QB_RUNTIME_DATABASE_URL; it was unset.

- Question Bank runtime delivery — PostgreSQL integration keeps the six seeded legacy practices and six published level practices runnable
- Question Bank runtime delivery — PostgreSQL integration snapshots only deliverySpec for a temporary Question Bank practice

### `test/assessment/remediation.runtime.integration.spec.ts` — 1 skipped

**Cause:** The suite is guarded by QB_RUNTIME_DATABASE_URL; it was unset.

- Question Bank remediation — PostgreSQL integration creates and completes a diagnosis-owned subset without changing the formal report

### `test/bootstrap/startup.spec.ts` — 3 skipped

**Cause:** The integration block is guarded by DATABASE_URL; it was unset.

- API root startup starts the public health/live endpoint
- API root startup starts the public health/ready endpoint
- API root startup keeps protected feature routes closed without an authenticated context

### `test/database/database-runtime.integration.spec.ts` — 11 skipped

**Cause:** The integration block is guarded by DATABASE_URL; it was unset.

- Shared database runtime — PostgreSQL integration tests connects with valid configuration
- Shared database runtime — PostgreSQL integration tests rejects invalid connection string on query
- Shared database runtime — PostgreSQL integration tests provides same PrismaClient instance across concurrent accesses
- Shared database runtime — PostgreSQL integration tests commits a transaction successfully
- Shared database runtime — PostgreSQL integration tests rolls back a transaction on error
- Shared database runtime — PostgreSQL integration tests closes the pool on shutdown
- Shared database runtime — PostgreSQL integration tests repeated shutdown does not throw
- Shared database runtime — PostgreSQL integration tests fails closed when PostgreSQL is unavailable
- Shared database runtime — PostgreSQL integration tests error output does not contain full connection string
- Shared database runtime — PostgreSQL integration tests sanitizeDriverError does not expose driver error message
- Shared database runtime — PostgreSQL integration tests handles concurrent queries on the same client

### `test/pilot/pilot.runtime.integration.spec.ts` — 1 skipped

**Cause:** The suite is guarded by QB_RUNTIME_DATABASE_URL; it was unset.

- QB-016 pilot PostgreSQL integration aggregates real STANDARD/REMEDIATION rows and closes the feedback loop

### `test/root/app-composition.spec.ts` — 6 skipped

**Cause:** The integration block is guarded by DATABASE_URL; it was unset.

- AppModule root composition compiles and resolves approved feature and security providers
- AppModule root composition imports each approved module once and excludes modules awaiting approval
- AppModule root composition keeps health and readiness public without opening business controllers
- AppModule root composition normalizes the approved curriculum publish route for Nest 11 startup
- AppModule root composition keeps unavailable identity persistence fail-closed
- AppModule root composition keeps unavailable curriculum persistence fail-closed

### `test/integration/curriculum/prisma-course-version.repository.spec.ts` — 15 skipped

**Cause:** The integration block is guarded by DATABASE_URL; its Vitest config disables dotenv loading and the shell variable was unset.

- PrismaCourseVersionRepository save creates a new draft with stable version 1
- PrismaCourseVersionRepository save updates an existing draft without changing version
- PrismaCourseVersionRepository save round-trips the student catalog metadata on create and update
- PrismaCourseVersionRepository save rejects concurrent updates with mismatched updatedAt
- PrismaCourseVersionRepository save does not mutate a PUBLISHED version on save
- PrismaCourseVersionRepository save persists bilingual content and resource references
- PrismaCourseVersionRepository findById returns null when the version belongs to another school
- PrismaCourseVersionRepository list lists only versions for the requested school
- PrismaCourseVersionRepository publish publishes a DRAFT version and is idempotent
- PrismaCourseVersionRepository publish does not publish a RETIRED version
- PrismaCourseVersionRepository retire archives a PUBLISHED version
- PrismaCourseVersionRepository nextVersion returns the next version number without modifying existing versions
- PrismaCourseVersionRepository createNextVersionFromPublished workflow creates a new draft without mutating the published parent
- PrismaCourseVersionRepository tenant isolation findPublishedByCourseId filters by school
- PrismaCourseVersionRepository error handling translates unique constraint failures into conflict exceptions

### `test/integration/identity/prisma-identity.repository.spec.ts` — 21 skipped

**Cause:** The integration block is guarded by DATABASE_URL; its Vitest config disables dotenv loading and the shell variable was unset.

- PrismaIdentityRepository PostgreSQL integration A. repository construction and connection constructs the repository and connects to PostgreSQL
- PrismaIdentityRepository PostgreSQL integration A. repository construction and connection uses only the injected shared database runtime
- PrismaIdentityRepository PostgreSQL integration A. repository construction and connection remains fail-closed with an invalid host and does not leak the connection URL
- PrismaIdentityRepository PostgreSQL integration B. users and credentials looks up an existing user and never stores plaintext passwords
- PrismaIdentityRepository PostgreSQL integration B. users and credentials returns null for a missing user
- PrismaIdentityRepository PostgreSQL integration B. users and credentials rejects inactive users
- PrismaIdentityRepository PostgreSQL integration C. membership returns only ACTIVE memberships and does not default to the first school
- PrismaIdentityRepository PostgreSQL integration C. membership excludes INVITED, SUSPENDED and LEFT memberships
- PrismaIdentityRepository PostgreSQL integration C. membership returns null when querying an active membership across tenants
- PrismaIdentityRepository PostgreSQL integration D. session creation creates a complete session pair with correct relationships
- PrismaIdentityRepository PostgreSQL integration D. session creation stores only token hashes, never raw tokens
- PrismaIdentityRepository PostgreSQL integration D. session creation looks up sessions by access and refresh token hashes
- PrismaIdentityRepository PostgreSQL integration E. atomic rotation rotates once and only once under concurrent refresh
- PrismaIdentityRepository PostgreSQL integration F. replay rejection rejects replayed refresh tokens and creates no new rows
- PrismaIdentityRepository PostgreSQL integration G. revoke revokes a session and prevents subsequent refresh
- PrismaIdentityRepository PostgreSQL integration G. revoke is idempotent when revoking the same session twice
- PrismaIdentityRepository PostgreSQL integration G. revoke does not revoke another user's session
- PrismaIdentityRepository PostgreSQL integration H. expiry and cleanup rejects rotation of an expired refresh token
- PrismaIdentityRepository PostgreSQL integration H. expiry and cleanup cleanup removes expired pairs without leaving orphaned sessions
- PrismaIdentityRepository PostgreSQL integration H. expiry and cleanup cleanup does not delete a valid successor pair
- PrismaIdentityRepository PostgreSQL integration I. transaction rollback rolls back the entire pair when the second session row violates a unique constraint
