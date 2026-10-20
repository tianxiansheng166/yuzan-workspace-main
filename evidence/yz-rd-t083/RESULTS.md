# YZ-RD-T083 Results

| Field | Result |
|---|---|
| `TASK_ID` | `YZ-RD-T083` |
| `STATUS` | `SCOPE_CONFLICT_PARTIAL` — Attempt contract delivered; course parity left to the active Owner |
| `BASE` | `8fb479e82c08a67a900650ebeb200bb17b7a27d6` |
| `WORKTREE` | `/home/tian/code/work/yuzan-workspace-t083` |
| `BRANCH` | `feat/yz-rd-t083-student-course-attempt-read-contract` |
| `FINAL_SHA` | Reported in the task return; the evidence commit does not write its own SHA |
| `GET_ATTEMPT_TYPED_SCHEMA` | `PASS` |
| `COURSE_NEXT_ACTIVITY_REQUIRED_PRACTICE_PARITY` | `SCOPE_CONFLICT` — `student-courses.service.ts` is currently T005-owned/modified in the canonical checkout |
| `CONTRACTS` | `PASS 6/6`; Redocly validation and type generation pass |
| `API_TESTS` | `29 passed`; `3 skipped` in the database-gated startup suite |
| `API_TYPECHECK` | `PASS` |
| `API_LINT` | `327 inherited test findings`, `0 added`, `0 warnings`; exit `1` |
| `READY_TO_MERGE` | `NO` |
| `RAW_SOURCE_READ_NO` | `YES` — no T005 dirty diff or restricted question-bank/L4 sources read |
| `HISTORICAL_L4_OPEN` | `OPEN` |

## Practice Attempt GET contract

The handler is `PracticeController.getAttempt` → `PracticeService.getAttempt`. There is no dedicated GET DTO today: the service returns the scalar `AssessmentSession` row after checking `practiceDefinitionId`. `RequestIdInterceptor` wraps it as `{ data, meta: { requestId } }`. The new OpenAPI `PracticeAttemptRead` plus `PracticeAttemptReadResponse` describe those exact runtime values; no handler, access rule, or response field was changed. The existing generic `AssessmentSession` schema was not reused because it does not describe this endpoint's runtime row.

The schema requires all returned scalar fields. Non-null fields are `id`, `schoolId`, `enrollmentId`, `classId`, `initiatorUserId`, `type`, `purpose`, `status`, `practiceDefinitionId`, `revision`, `createdAt`, and `updatedAt`. Nullable fields are `remediationOrigin`, `remediationFocus`, `startedAt`, `submittedAt`, `completedAt`, `retestOfSessionId`, `practiceVersionId`, `deliveryId`, `courseActivityId`, and `courseSubmissionId`. In particular, `courseActivityId` and `courseSubmissionId` are required response properties with nullable UUID values: both are `null` for standalone Attempts and contain their persisted IDs for course-linked Attempts. `practiceDefinitionId` is non-null because the handler returns 404 when it is absent.

Authorization remains server-side and unchanged:

- The handler requires the authenticated tenant's `schoolId` to match and requires a student role.
- The Prisma lookup includes `id`, `schoolId`, and an active `STUDENT` enrollment whose `userId` is the authenticated principal.
- A missing row, a row for another student's enrollment, or a non-practice row returns 404. A mismatched tenant returns 403.

Unit coverage verifies standalone null course scope, both persisted course-linked IDs, cross-school 403 without a query, a same-school other-student enrollment returning 404, and a non-practice row returning 404. Route guard tests verify 401 without authentication and 403 for an authenticated non-student. The database-backed startup test, including its HTTP 401 case, was skipped because `DATABASE_URL` was unset; no database runtime was started.

## Student course next activity

The accepted T075 evidence records that course completion counts each required practice using finished Attempts per activity, while list `nextActivity` uses `completedActivityIds` and detail `nextActivity` uses `activity.progress.completed`. Those activity-progress values do not identify a required practice that is still incomplete.

Resolving this requires changing the student-course read projection in `backend/api/src/modules/student-courses/student-courses.service.ts`. The T070 handoff marks that student-course path as T005-protected, and the canonical checkout currently has that same file modified. The current T005 diff was not opened. Under the Task Card's owner-conflict rule, this is `SCOPE_CONFLICT`; no course code, course contract, or course parity test was changed or claimed as passed. The conflict and ownership check are recorded in [scope-check.txt](scope-check.txt).

T049's accepted commit is already an ancestor of the requested BASE and its worktree is clean. No T049-owned file was changed. The T075 and T081 worktrees also remain unchanged. No T082 frontend integration worktree was modified.

## Verification

- Node `v24.20.0`; pnpm `10.13.1`.
- `pnpm --filter @yuzan/database generate` and `build` passed using a loopback placeholder `DATABASE_URL` for client generation only; no DB connection was made.
- `pnpm --filter @yuzan/api typecheck` passed.
- Focused API tests: 29 passed across Practice service scope, Practice controller guards, and existing question-bank security tests. The API startup suite skipped 3 tests because it requires a database URL.
- `pnpm --filter @yuzan/contracts generate` passed. `pnpm --filter @yuzan/contracts test` passed all `6/6`, including Redocly OpenAPI validation and deterministic generated types.
- Full API lint after the change: 426 source files / 0 errors and 165 test files / 327 errors, with zero warnings or parser errors. Exact T070 baseline: 426 source files / 0 errors and 164 test files / 327 errors. Diagnostic identity comparison reports 0 added and 0 removed; both touched test files have 0 lint errors. The inherited 327 findings remain unwaived.
- API test-project TypeScript has the same 184 diagnostics as T070, with 0 added and 0 removed; its existing `tsc` exit code remains `2`.
- No native API/PostgreSQL E2E was run. No Docker/Compose, SQL relation writes, raw mixed question-bank DOCX/ZIP, Level 4 source, or historical accident data was used. No shared branch was merged and no force Git operation was used.

The checkout `AGENTS.md` lacks the AA-DEV-V2.2 marker. The Task Card supplied the YZ-RD scope and frozen task rules; the checkout mismatch is recorded here. Historical L4 remains `OPEN`.

Detailed machine-readable lint and TypeScript comparisons are in [api-lint-comparison.json](api-lint-comparison.json) and [api-test-typecheck-comparison.json](api-test-typecheck-comparison.json). Targeted test output is in [api-targeted-tests.txt](api-targeted-tests.txt); typecheck and Contracts output are in their corresponding `.txt` files.
