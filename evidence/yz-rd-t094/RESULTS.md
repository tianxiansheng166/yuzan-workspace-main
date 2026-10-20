# YZ-RD-T094 Results

## Identity and scope

- `TASK_ID`: `YZ-RD-T094`
- `BASE`: `abf95ca78cfac816b0af7148a4c86c296c4870ff`
- `BRANCH`: `feat/yz-rd-t094-submission-bound-audio-playback`
- `WORKTREE`: `/home/tian/.devspace/worktrees/yuzan-workspace-t094`
- `REPO_AGENTS_ACTUALLY_READ`: `AGENTS.md`, blob `a931f77fa17dad8e023adf4034c1550227c321b8`; `README-FIRST.md`, blob `6328bb2070a9c83ee41c305b3ed52f02b6bcc68e`.
- Also read the target worktree's `CURRENT_HANDOFF.md` and `CURRENT_TASK.md` once before implementation. The task-specific card took precedence over its unrelated current task.
- `NOTION_POLICY_READ`: `READ_OK` for POLICY_REF, LANE_REF and ROUTING_REF. The YZ-RD lane explicitly says the AutoAim V2.2 marker is not applicable to this repository.

## Implementation

- Added `GET /api/v1/schools/:schoolId/submissions/:submissionId/recording-playback` under `SubmissionsController`. It first calls `SubmissionsService.getSubmission`, which verifies the school-scoped, non-deleted submission and the existing teacher/class or school-admin authorization path.
- Playback uses `RecordingRepositoryPort.findBySubmissionId`. It checks the school, persisted submission relation and enrollment against the authorized submission before signing. The newest persisted recording is selected, with descending ID as a timestamp tie-breaker; an unavailable newest recording fails closed. Only `COMPLETE`, `PROCESSING` and `READY` recordings with a persisted non-empty `objectKey` can receive a signed URL. Invalid cases do not call `generateDownloadUrl`.
- Recording initialization now rejects a supplied submission unless it is non-deleted and matches both the requested school and enrollment. Idempotent reuse also requires the same school and submission binding.
- The teacher page uses native accessible `<audio controls>`, fetches the submission-scoped endpoint using the route submission ID and active school ID, and assigns `src` only from a valid server-returned HTTP(S) `downloadUrl`. It ignores legacy `recordingUrl`, announces loading, no-recording and authorization states, clears the source after media errors, and reports playback only from the native `playing` event.
- OpenAPI changes remain deferred to the T005 owner-path decision. No schema or protected T005 file changed.

## Changed paths

- `backend/api/src/modules/recordings/recordings.service.ts`
- `backend/api/src/modules/submissions/submissions.controller.ts`
- `backend/api/src/modules/submissions/submissions.module.ts`
- `backend/api/test/recordings/recordings.service.spec.ts`
- `backend/api/test/modules/submissions/submission-recording-playback.controller.spec.ts`
- `frontend/teacher/submissions/detail/app.js`
- `frontend/teacher/submissions/detail/index.html`
- `frontend/teacher/submissions/detail/styles.css`
- `frontend/teacher/submissions/detail/playback.test.mjs`
- `frontend/package.json`
- `evidence/yz-rd-t094/RESULTS.md`
- `evidence/yz-rd-t094/logs/api-focused-final.txt`
- `evidence/yz-rd-t094/logs/api-initial-wide-scan-before-prisma-generation.txt`
- `evidence/yz-rd-t094/logs/api-typecheck-before-prisma-generation.txt`
- `evidence/yz-rd-t094/logs/api-typecheck-final.txt`
- `evidence/yz-rd-t094/logs/database-build.txt`
- `evidence/yz-rd-t094/logs/database-generate.txt`
- `evidence/yz-rd-t094/logs/diff-check.txt`
- `evidence/yz-rd-t094/logs/frontend-focused.txt`
- `evidence/yz-rd-t094/logs/frontend-suite.txt`
- `evidence/yz-rd-t094/logs/js-gate.txt`
- `evidence/yz-rd-t094/logs/node-check.txt`
- `evidence/yz-rd-t094/logs/runtime-verifier.txt`
- `evidence/yz-rd-t094/logs/target-lint-final.txt`

## Verification

- `API_TEST_PASS_FAIL_SKIP_NOTRUN`: `39 / 0 / 0 / 0` across the focused recording service and submission playback controller tests.
- `API_TYPECHECK`: `PASS`.
- `TARGET_LINT`: `PASS`, no findings in the five changed API source/test files.
- `FRONTEND_TESTS`: focused playback test `9 passed`; `pnpm --filter @yuzan/frontend test` `199 passed, 0 failed, 0 skipped`.
- `JS_GATE`: `PASS`, business syntax gate checked 100 JS/MJS files.
- `RUNTIME_VERIFIER`: `PASS` via the frontend build script and the full frontend test script.
- Changed frontend JS/MJS `node --check`: `PASS`.
- `git diff --check`: `PASS`.
- `BROWSER_API_PG_MINIO_E2E`: `NOT_RUN`. The card supplied no already-authorized T094 isolated PostgreSQL/MinIO/browser runtime coordinates. No runtime was started, no shared or old database/storage was used, and fixture results are not represented as E2E evidence.
- `OPENAPI_UPDATE`: `DEFERRED_T005_OWNER_PATH`.
- `READY_TO_MERGE`: `NO`; the owner-path decision and required native acceptance remain open.
- `HISTORICAL_L4_INCIDENT_OPEN`: `OPEN`.

Initial API attempts before Prisma client generation are retained separately: Vitest could not resolve `@yuzan/database`, and the first `pnpm test -- <files>` invocation ran the full API test discovery instead of the requested file set. After generating/building the existing database workspace package without a database connection or migration, the direct focused Vitest command passed. ESLint findings encountered during implementation were corrected before the final targeted lint passed. Initial attempts are not counted as final gate results.

## Raw logs

Logs are in [`logs/`](logs/). Final-gate logs include `api-focused-final.txt`, `api-typecheck-final.txt`, `target-lint-final.txt`, `frontend-focused.txt`, `frontend-suite.txt`, `js-gate.txt`, `runtime-verifier.txt`, `node-check.txt` and `diff-check.txt`. Prisma client generation/build setup logs and superseded initial-attempt logs are retained there as well.

The final commit SHA and post-push remote equality are reported in the task receipt; they are not embedded here because the results file is part of that commit.
