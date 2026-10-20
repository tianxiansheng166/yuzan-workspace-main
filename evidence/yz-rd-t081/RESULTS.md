# YZ-RD-T081 Results

| Field | Result |
|---|---|
| TASK_ID | `YZ-RD-T081` |
| STATUS | `FRONTEND_SCOPE_FIX_VERIFIED / NATIVE_API_PG_E2E_NOT_RUN / FORMAL_GATES_OPEN` |
| BASE | `ecbd0069642de7a15eef4102d516363bbd118208` |
| BRANCH | `feat/yz-rd-t081-practice-standalone-attempt-scope-fix` |
| WORKTREE | `/home/tian/code/work/yuzan-workspace-t081` |
| FINAL_SHA | Reported from the final remote branch ref in the task return. |
| READY_TO_MERGE | `NO` |
| HISTORICAL_L4_OPEN | `OPEN` |

## Scope result

- **STANDALONE_VS_COURSE_SCOPE:** `PASS`. The standalone practice catalog resumes only an Attempt whose server response has explicit `courseSubmissionId: null` and `courseActivityId: null`. Course-linked Attempts remain available to their existing course continuation path; this change does not touch course resume behavior.
- **MIXED_ATTEMPT_CASE:** `PASS`. With an older standalone Attempt and a newer course-linked Attempt for one definition, the catalog selects the standalone Attempt. `updatedAt` is considered only after school, student, definition, enrollment, and standalone scope have been checked.
- **ONLY_COURSE_ATTEMPT_CASE:** `PASS`. A course-linked-only result does not appear as a standalone resume target. Catalog loading makes no create request.
- **SAME_ATTEMPT_RESUME:** `PASS`. A valid standalone Attempt continues through its original Attempt ID; the catalog makes no create request.
- **IDENTITY_AND_DEFINITION_SCOPE:** `PASS`. Mismatched school, initiating student, or definition is ignored. A school identity change while reads are in flight discards the stale result.
- Missing `courseSubmissionId` is treated as unknown scope and is not resumed.

## API scope field and contract boundary

The `listAssessmentSessions` response is projected by `toAssessmentSessionResponse`; that list DTO does not include `courseSubmissionId` or `courseActivityId`. The practice catalog already hydrates session IDs through `Api.getPracticeAttempt`. Its current API implementation routes to `PracticeService.getAttempt`, which checks the requested school and an ACTIVE student enrollment for the authenticated user, then returns the persisted session row. That runtime response contains `schoolId`, `enrollmentId`, `initiatorUserId`, `practiceDefinitionId`, `courseSubmissionId`, and `courseActivityId`. Standalone rows created by `PracticeService.createOrResume` persist both course fields as null.

No API, Prisma, or Contracts files were changed. **API_CONTRACT_REQUEST for the API/Contracts owner:** document a typed 200 response for `GET /schools/{schoolId}/practices/attempts/{attemptId}` that includes the existing scope and identity fields (`schoolId`, `enrollmentId`, `initiatorUserId`, `practiceDefinitionId`, nullable `courseSubmissionId`, nullable `courseActivityId`) with their actual nullability. The current OpenAPI operation has a description-only 200 response. The frontend uses fields verified in the current handler implementation and fails closed when scope is absent.

Formal QuestionVersion approval/eligibility remains outside this task and unverified. No T065 synthetic `PUBLISHED` fixture is treated as approved educational content.

## Reproduction before source change

Added the T081 regression file and ran it against unchanged BASE source before editing `practice.js`:

- Result: **3 failed / 1 passed**.
- The mixed case linked the newer course Attempt; the course-only case displayed a standalone resume; and the identity case selected another student's Attempt.
- The original standalone-only case already linked its same Attempt ID.

All fixture content in `t081-practice-attempt-scope.test.mjs` is `TEST_FIXTURE_ONLY`; no browser screenshot or static browser data was produced.

## Verification

- Runtime: Node `v24.20.0`; repository-pinned pnpm `10.13.1` via Corepack.
- Focused tests: **33/33 PASS** across T076 safety/recovery, T081 scope regressions, and existing practice continuation tests. T076's empty-practice, 409/save-loss, locked unknown-submit, and 401/403/404 tests remain present and passing.
- T081 regressions: **6/6 PASS**.
- Full frontend: **155/155 PASS**; the package test command also ran the runtime verifier successfully.
- Explicit runtime verifier: **PASS**.
- `git diff --check`: `PASS` (final check before commit).
- Native API/PostgreSQL E2E: **NOT_RUN**. No T081-authorized isolated API/PG runtime was configured; `psql`, `pg_isready`, `redis-cli`, and `minio` are unavailable, and no listener was present on the checked project ports (4000/4175/55432/6380/59000/59001). Docker/Compose was not used.
- API lint: not rerun. T076's accepted capsule records the inherited T068 API test-lint baseline as 733 unwaived findings; this gate remains unmet, so `READY_TO_MERGE=NO`.

## Safety and policy

- `NOTION_POLICY_READ=READ_OK` for the supplied YZ-RD policy and Lane references (both read on 2026-10-20). The target checkout has no AA-DEV-V2.2 marker; Notion states that marker is AutoAim-only and not required for YZ-RD.
- No T005 protected source/media, mixed raw question-bank DOCX/ZIP, `local_sources/`, Level 4 source, importer, Docker/Compose, or other task runtime was accessed.
- This task did not approve or infer formal QuestionVersion eligibility. Historical L4 incident remains `OPEN`.

## Changed files

- `frontend/assessment/assets/practice.js`
- `frontend/tests/assessment/t081-practice-attempt-scope.test.mjs`
- `frontend/tests/assessment/student-practice-state.test.mjs` and `frontend/tests/assessment/student-practice-runner-t012.test.mjs`: updated existing mock Attempt responses to match the verified API identity and null course-scope fields; assertions and coverage remain intact.
- `CURRENT_HANDOFF.md` (required by the target repository's AGENTS.md completion checklist).
- This evidence file.
