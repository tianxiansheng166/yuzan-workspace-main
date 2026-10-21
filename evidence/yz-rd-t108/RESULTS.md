# YZ-RD-T108 — Sep 8 Recovery + T104 Quality Integration

## Status and source truth

- `TASK_ID=YZ-RD-T108`
- `STATUS=OFFLINE_INTEGRATION_VERIFIED; NATIVE_E2E_NOT_RUN`
- `BASE_SHA=9b0276810e7cc5dd96acf16070ab3a751824daec` (exact T106 branch tip at preflight)
- `T104_SHA=adcbd6e0e099a0db280fbb731a995d52e7835d25`
- `OUTPUT_BRANCH=feat/yz-rd-t108-sep08-recovery-quality-integration`
- `WORKTREE=/home/tian/.devspace/worktrees/yuzan-workspace-t108`
- Normal non-squash merge commit: `6b4c684c44481c121ab6684a59d8cce5af6f43b2`
- Merge parents, in order: T106 `9b0276810e7cc5dd96acf16070ab3a751824daec`; T104 `adcbd6e0e099a0db280fbb731a995d52e7835d25`.
- `READY_TO_MERGE=NO_UNTIL_OWNER_ACCEPTANCE`; no merge to a shared branch or deployment was performed.
- `HISTORICAL_L4_INCIDENT_OPEN=YES`; no L4 content was accessed.

## Commit graph and preflight

T104 and T106 have exactly one merge base: T102 `f28a1461930642bf33010beeedd67b3d88f28851`. T104's exact commit is a direct child of that T102 commit. T106's checked-in recovery line is `f28a146 -> cd3dad2 -> 375cef8 -> 51ac17a -> 78de341 -> 89d6b92 -> 9b02768`; T108 starts at the final T106 documentation/source tip `9b02768`. The product-history baseline remains the Sep 8 commit `0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8` recorded in T102 `BASELINE.md`.

Remote preflight SHA snapshot:

| Branch                                                | SHA                                        |
| ----------------------------------------------------- | ------------------------------------------ |
| `feat/yz-rd-t102-recover-2026-09-08-student-baseline` | `f28a1461930642bf33010beeedd67b3d88f28851` |
| `feat/yz-rd-t103-course-player-native-acceptance`     | `375cef8cffcb955dc6dc76f6685ff41f96e3fbc8` |
| `test/yz-rd-t105-real-course-playback-acceptance`     | `78de341e4fcebf930173a9b40e93cbc5c6c10526` |
| `feat/yz-rd-t104-quality-gate-baseline-audit`         | `adcbd6e0e099a0db280fbb731a995d52e7835d25` |
| `fix/yz-rd-t106-course-video-progress-reliability`    | `9b0276810e7cc5dd96acf16070ab3a751824daec` |
| T108 output branch                                    | absent before local creation               |

The designated T108 worktree path was absent before creation. The output branch was absent locally and remotely before creation. T104/T106 remote tips matched the required exact SHAs before integration; neither source branch moved during the recorded preflight. No force, reset, stash, or overwrite was used.

## Merge and conflict resolution

`git merge --no-ff --no-commit --no-edit adcbd6e0e099a0db280fbb731a995d52e7835d25` exited 0 with “Automatic merge went well”; **no conflicts** occurred. Git auto-merged the two reviewed overlap paths:

- `frontend/student/courses/course-detail/course-player-state.test.mjs`: retained all T106 server-authoritative completion, 409 refresh, stale-response and activity-switch cases; retained T104's formatted assertion. The integrated test file has 8 cases, and the course/media suites were rerun below.
- `CURRENT_HANDOFF.md`: retained the complete T106/T105/T103/T102 history and appended the T104 checkpoint. The T108 checkpoint below is appended after it; no previous handoff text was removed.

The only T104 historical evidence edits were formatting changes to `evidence/yz-rd-t093/verification.md` and `evidence/yz-rd-t095/RESULTS.md`. Both were restored from T106 BASE and are byte-identical there: T093 blob `c1ba2f660fadf0b0f38a555f1e5af16df64bcdeb`; T095 blob `614be778503e1f88bd83fe00652984e503f79446`. No historical acceptance fact was changed. T104's own `evidence/yz-rd-t104/RESULTS.md` remains included.

## File-owner guard

Changes relative to T106 BASE are attributable only to T104 quality/tooling and test fixes, the T104/T108 handoff additions, and this T108 evidence:

```text
CURRENT_HANDOFF.md
backend/api/package.json
backend/api/test/assessment/assessment.service.spec.ts
backend/api/test/assessment/question-bank-deterministic-scoring.service.spec.ts
backend/api/test/tsconfig.json
evidence/yz-rd-t104/RESULTS.md
evidence/yz-rd-t108/RESULTS.md
frontend/login/auth-fail-closed.test.mjs
frontend/student/courses/course-detail/course-player-state.test.mjs
frontend/student/courses/courses.test.mjs
frontend/tests/assessment/t102-unanswered-submit.test.mjs
pnpm-lock.yaml
```

T104 contributes the direct locked `@eslint/js@9.39.4` API dev dependency, its matching lock importer, `backend/api/test/tsconfig.json`, API test fake/assertion fixes, and focused frontend test formatting. No API production source, schema/migration, contract, teacher UI, T005 path, or protected source was changed. `frontend/student/today/**` and `frontend/student/growth/**` are byte-identical to T106 BASE; the only Courses directory deltas are the two T104/T106 test files listed above. Course-detail production assets, cover art, recommendation flow, practice entry, and the T106 player implementation are unchanged from BASE. T098 (`17ff508075e51ab3fabf546d711a1e22023c44e6`) and T101 (`55770e4f051c4c7b58c054f92fdf76b320ec96a1`) are not ancestors of T108.

## Verification commands and exit codes

Commands ran against the integrated T108 tree. Node was `v24.20.0`; Corepack `0.35.0`; locked pnpm `10.13.1`; ESLint and `@eslint/js` `9.39.4`; TypeScript `5.9.3`; Vitest `3.2.7`.

| Check                                     | Command / conditions                                                                                                                               |  Exit | Result                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen offline install                    | `corepack pnpm install --frozen-lockfile --offline`                                                                                                |     0 | Lockfile current; 783 packages reused, no download.                                                                                                                                                                                                                                                                                                 |
| Prisma client generation                  | `corepack pnpm db:generate`, with a dummy loopback `DATABASE_URL` for generation only and a temporary PATH shim ensuring nested pnpm 10.13.1       |     0 | Client generated; no database connection. The first attempt exited 1 because a system pnpm 11.7.0 shim was selected; corrected invocation succeeded.                                                                                                                                                                                                |
| Database package build                    | `corepack pnpm --filter @yuzan/database build`                                                                                                     |     0 | TypeScript build passed.                                                                                                                                                                                                                                                                                                                            |
| Full frontend suite + runtime verifier    | `corepack pnpm --filter @yuzan/frontend test`                                                                                                      |     0 | 70 passed, 0 failed, 0 skipped; runtime verifier passed.                                                                                                                                                                                                                                                                                            |
| Course-focused suite                      | `node --test` on Courses route, course API adapter, player state, media controller, practice sync, and shell visibility tests                      |     0 | 34/34 passed.                                                                                                                                                                                                                                                                                                                                       |
| Player state + media status               | `node --test frontend/student/courses/course-detail/course-player-state.test.mjs frontend/student/courses/course-detail/media-controller.test.mjs` |     0 | 22/22 passed.                                                                                                                                                                                                                                                                                                                                       |
| T099 partial/all-empty submit regressions | `node --test frontend/tests/assessment/t102-unanswered-submit.test.mjs`                                                                            |     0 | 10/10 passed.                                                                                                                                                                                                                                                                                                                                       |
| Full API suite                            | `corepack pnpm --filter @yuzan/api test`; `DATABASE_URL` and `QB_RUNTIME_DATABASE_URL` unset                                                       |     0 | 66 files passed, 10 skipped; 1,072 passed, 64 skipped, 0 failed. The 64 skips are the existing database-gated cases, not passes; no DB was contacted.                                                                                                                                                                                               |
| API source typecheck                      | `corepack pnpm --filter @yuzan/api typecheck`                                                                                                      |     0 | Passed.                                                                                                                                                                                                                                                                                                                                             |
| API test-project type probe               | `corepack pnpm --filter @yuzan/api exec tsc -p test/tsconfig.json --noEmit --pretty false`                                                         |     1 | 234 existing test TypeScript diagnostics, matching T104's BASE and T102 count; no new test TS diagnostic versus the recorded baseline. This is separate from the passing source typecheck.                                                                                                                                                          |
| Frontend lint / typecheck                 | `corepack pnpm --filter @yuzan/frontend lint`; `corepack pnpm --filter @yuzan/frontend typecheck`                                                  | 0 / 0 | Both package scripts' Node syntax checks passed.                                                                                                                                                                                                                                                                                                    |
| Frontend build/runtime                    | `corepack pnpm --filter @yuzan/frontend build`                                                                                                     |     0 | Runtime verifier passed.                                                                                                                                                                                                                                                                                                                            |
| Changed JS/MJS syntax                     | `git diff --name-only 9b0276810e7cc5dd96acf16070ab3a751824daec -- '*.js' '*.mjs' '*.cjs' \| xargs -r -n 1 node --check`                            |     0 | All changed JS test modules parsed.                                                                                                                                                                                                                                                                                                                 |
| API ESLint                                | `corepack pnpm --filter @yuzan/api lint`                                                                                                           |     1 | ESLint starts and analyzes tests: 2,649 errors, 1 warning, 0 project-service parser errors. This is baseline debt, not a green lint gate.                                                                                                                                                                                                           |
| Repository format check                   | `corepack pnpm format:check`                                                                                                                       |     2 | 745 warning files and 12 parser-error paths; not green.                                                                                                                                                                                                                                                                                             |
| Exact T106 format comparison              | Same `format:check` in a temporary detached snapshot at `9b0276810e7cc5dd96acf16070ab3a751824daec`                                                 |     2 | T106 BASE: 748 warnings / same 12 parser-error paths. T108 added 0 warning paths and removed 3 (`frontend/login/auth-fail-closed.test.mjs`, `frontend/student/courses/courses.test.mjs`, and `frontend/tests/assessment/t102-unanswered-submit.test.mjs`). Parser-error path set is unchanged. The temporary snapshot was removed after comparison. |
| Whitespace check                          | `git diff --check`                                                                                                                                 |     0 | No whitespace errors.                                                                                                                                                                                                                                                                                                                               |

### Lint and formatting debt versus new diagnostics

T104 compared the same ESLint `9.39.4` configuration (with the exact locked dependency and the test-project config) against its BASE and T102. Its JSON diagnostic comparison reported **0 added / 26 removed**; API lint was 2,675 errors / 1 warning on BASE and 2,649 / 1 on T102. T108's API source tree is identical to that T104 tree, and the integrated rerun reproduced 2,649 / 1 with zero parser errors. There are **0 T108-added ESLint diagnostics**. The remaining 2,649 errors and 1 warning are existing repository debt; lint is not green.

T104 recorded the full repository at 737 formatting warnings / 12 parser errors after focused formatting. Against the exact T106 BASE, T108 adds no warning path and removes three; the integrated total is 745 / 12 because T106 itself contains more warning paths than T102. The 12 parser failures are unchanged legacy paths: `frontend/teacher.html`, `frontend/teacher/ai-tools/index.html`, `frontend/teacher/assessments/create/app.js`, `frontend/teacher/assessments/detail/index.html`, `frontend/teacher/assessments/tasks/index.html`, `frontend/teacher/assignments/index.html`, `frontend/teacher/classes/detail/index.html`, `frontend/teacher/classes/index.html`, `frontend/teacher/reviews/submission-1/index.html`, `frontend/teacher/students/demo/index.html`, `frontend/volunteer.css`, and `infra/ai/provider-stub/index.ts`.

## Native E2E and resource state

`NATIVE_E2E=NOT_RUN`. T106's `native-e2e-summary.json` and browser result are valid for T106 SHA `9b027...` only and are not projected to T108. No separately authorized T108 Browser/API/PostgreSQL/MinIO stack, student account/course authorization, or T108 resource receipt was available. T107's worktree was checked read-only: branch `ops/yz-rd-t107-t106-five-service-resource-bounds` remained clean at `9b027...`, with no T107 evidence directory or resource receipt present. The already-running T106 five-service stack was left untouched; it was not reused, restarted, or replaced.

`RESOURCE_BOUNDS_OF_ANY_TEST_STACK=NONE`: no T108 test container or service stack was started, so there are no T108 CPU, memory, or PID limits to report. No new unlimited external container blocker was created. Real account authorization, current course availability, API progress persistence, and playback on the integrated SHA remain unverified; fixture coverage is not native acceptance.

## Rollback

No shared branch was changed. To roll the T108 branch back without rewriting history, first revert its later evidence checkpoint commit, then revert merge commit `6b4c684c44481c121ab6684a59d8cce5af6f43b2` with mainline 1 (`git revert -m 1 6b4c684c44481c121ab6684a59d8cce5af6f43b2`). This preserves the T106 recovery line and removes the T104 integration through ordinary revert commits. No force-push or deployment is part of rollback.

## Delivery receipt

The branch push, final remote SHA comparison, final evidence checkpoint SHA, and Draft PR URL or permission blocker are recorded in the appended delivery receipt after the authorized delivery attempt.
