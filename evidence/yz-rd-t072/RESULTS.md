# YZ-RD-T072 Results

| Field | Result |
|---|---|
| `TASK_ID` | `YZ-RD-T072` |
| `STATUS` | `DRAFT_IMPLEMENTATION_COMPLETE / NATIVE_API_PG_E2E_NOT_RUN / PUBLISH_AUTHORITY_OPEN` |
| `BASE` | `5422af364c32c1feffe1e995884f71a4271488d3` |
| `BRANCH` | `feat/yz-rd-t072-teacher-question-authoring-web-first-slice` |
| `WORKTREE` | `/home/tian/code/work/yuzan-workspace-t072` |
| `NODE_VERSION` | `v24.20.0` |
| `PNPM_VERSION` | `10.13.1` |
| `FINAL_SHA` | Reported from the verified remote branch in the task return; omitted here because this evidence is part of that commit. |
| `TEACHER_WEB_DRAFT_CREATE_EDIT` | `PASS_FRONTEND_UNIT_SEQUENCE; REAL_BROWSER_API_PG_NOT_RUN` |
| `API_PG_PERSISTENCE` | `IMPLEMENTED_ON_EXISTING_QUESTIONBANK_TABLES; PG_RUNTIME_NOT_RUN` |
| `DRAFT_REOPEN` | `PASS_API_SERVICE_AND_FRONTEND_UNIT; PG_RUNTIME_NOT_RUN` |
| `SCHOOL_AUTHOR_AUTHORIZATION` | `PASS_CODE_AND_UNIT_TESTS` |
| `PUBLISH_AUTHORITY_GATE` | `NEEDS_OWNER_DECISION_PUBLISH_AUTHORITY` |
| `STUDENT_QUESTIONVERSION_CONTRACT` | `API_REQUEST_RECORDED; NO_STUDENT_OR_T083_FILES_CHANGED` |
| `CHROMIUM_API_PG_E2E_OR_NOT_RUN` | `NOT_RUN — no isolated PostgreSQL server/client or database listener was available; no Docker/Compose or local API/PG visual fixture was used.` |
| `API_CONTRACTS_FRONTEND_TESTS` | `API 13/13; API source typecheck PASS; Contracts validate/typecheck PASS; Database schema/migration checks 7/7; Frontend 141/141 plus runtime verifier PASS; T072 authoring files targeted ESLint PASS.` |
| `NO_RAW_SOURCE_READ` | `YES` |
| `READY_TO_MERGE` | `NO — repository-wide lint remains at 733 API lint errors; the full lint command fails. The authoring files lint cleanly.` |
| `HISTORICAL_L4_OPEN` | `OPEN — historical status carried forward; no current Level 4 source or runtime was opened.` |

## Implementation

- Added a teacher-only authoring API under `/schools/:schoolId/teacher/question-bank/items` for teacher-owned list, DRAFT create, version read, and DRAFT update. It reuses `QuestionBankItem` and `QuestionBankItemVersion`; it does not introduce a second content store.
- Added nullable `authorUserId` and integer `revision` to `QuestionBankItemVersion`. The migration preserves imported versions with `authorUserId = NULL` and initializes their revision to 1. Teacher-created versions are associated with the authenticated user, and their parent items are scoped to the active school.
- DRAFT updates run in a database transaction, require the current revision, compare it atomically, update the item metadata, and increment the revision. Stale/concurrent writes and edits outside DRAFT return 409. Same-school non-owner or missing versions return 404; a tenant mismatch returns 403; inactive membership returns 401; students are rejected by both the route role guard and service policy.
- The authoring input supports CHOICE and TEXT formats with validated prompt, type, domain, grade band, level, difficulty, choices/answer, and score. Correct answers are kept in `scoringSpec`; the delivery payload contains no answer key.
- Added `/teacher/question-bank/` to the teacher navigation. The 1280/1440-oriented page reads, creates, reopens, and edits through the authenticated API client. Save errors for 401/403/404/409 are distinct. It shows `DRAFT` and “审核：未提交”; there is no submit-review or publish endpoint/button.
- The page states that review and publishing are unavailable pending owner authority. No T065 test-fixture PUBLISHED version is treated as approved school content.

## Student QuestionVersion API request

T076/T081 established that the student catalog cannot infer formal source eligibility from `itemTypes`, and that a frontend-only gate cannot distinguish an authorized published QuestionVersion from a missing or unapproved source. T072 did not change student practice or Attempt contracts. The API/Contracts owner should add:

1. A server-derived availability result to the student practice list and detail responses, including `available` and a stable `unavailableReason`. Derive it from the persisted `PracticeItemRef` and the exact `QuestionBankItemVersion`: the reference must resolve, the version must be `PUBLISHED` with `publishedAt`, the practice delivery/version must be published, and the version/item must be eligible for the current school and authorized course. Treat a null school-scoped item as unavailable unless an approved global-source rule explicitly permits it.
2. Enforce the same eligibility check in practice create/resume. Unavailable items must not be silently substituted from legacy `config`; return a stable reason-coded error.
3. For the T083-owned Attempt read contract, document a typed 200 response for `GET /schools/{schoolId}/practices/attempts/{attemptId}` with `schoolId`, `enrollmentId`, `initiatorUserId`, `practiceDefinitionId`, nullable `courseSubmissionId`, nullable `courseActivityId`, and the stable `questionVersionId` associated with each persisted item snapshot. Keep this work with T083; T072 did not edit its files.

Suggested reason codes for the consumer contract: `PRACTICE_VERSION_UNAVAILABLE`, `PRACTICE_ITEM_REF_INVALID`, `QUESTION_VERSION_MISSING`, `QUESTION_VERSION_NOT_PUBLISHED`, `QUESTION_VERSION_SCOPE_MISMATCH`, and `COURSE_ACCESS_DENIED`.

## Verification evidence

- API targeted tests: `corepack pnpm --filter @yuzan/api exec vitest run test/assessment/question-bank-authoring.service.spec.ts test/assessment/question-bank-authoring.dto.spec.ts` — **13 passed**. Covers persistence inputs, read/list ownership, choice/text validation, revision increments, stale/racing saves, non-DRAFT conflict, and 401/403/404/409 behaviors.
- API source typecheck: `corepack pnpm --filter @yuzan/api typecheck` — **PASS**.
- Database schema and migration contract: `DATABASE_URL=<task-local non-connectable URL> corepack pnpm --filter @yuzan/database test` — Prisma schema valid; **7 migration contract checks passed**. This did not connect to PostgreSQL or apply the migration.
- Contracts: `corepack pnpm --filter @yuzan/contracts validate` and `corepack pnpm --filter @yuzan/contracts typecheck` — **PASS**. Generated Typescript was regenerated from the OpenAPI additions.
- Frontend: `corepack pnpm --filter @yuzan/frontend test` — **141 passed**; runtime verifier passed. T072 tests exercise the API route methods and an in-memory UI create → save → reopen → edit → save sequence with revision 1 → 2. This is a unit sequence, not a real API or database run.
- JavaScript syntax checks for `frontend/server.mjs`, `frontend/assets/api-client.js`, `frontend/shared/teacher-shell.js`, `frontend/teacher/question-bank/app.js`, and the T072 frontend test passed. `git diff --check` passed.
- Targeted ESLint over the new authoring API/controller/DTO/tests passed. `DATABASE_URL=<task-local non-connectable URL> corepack pnpm lint` failed at the API lint gate with **733 errors**. T064's accepted BASE evidence also records 733 API test lint findings; T072-owned authoring files have zero findings. Therefore `READY_TO_MERGE=NO`.
- Native browser/API/PostgreSQL E2E is **NOT_RUN**. `psql`, `pg_isready`, `postgres`, `initdb`, and `pg_ctl` were absent, and there was no isolated database listener. Chromium was installed but no authorized isolated PG runtime existed. No Docker/Compose was used, and no visual fixture was used to imply real API persistence.

## Policy and source boundary

The target checkout's `AGENTS.md` lacks the `AA-DEV-V2.2` marker. The Task Card supplied explicit YZ-RD task limits but no separate Lane-policy path; the mismatch is recorded here. No `local_sources/`, mixed raw DOCX/ZIP, T005 protected media, Level 4 raw source, or historical Level 4 runtime was opened. The working directory and output branch were task-isolated from the unrelated dirty main checkout.
