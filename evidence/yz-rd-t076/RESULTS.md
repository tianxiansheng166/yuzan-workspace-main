# YZ-RD-T076 Results

| Field | Result |
|---|---|
| TASK_ID | `YZ-RD-T076` |
| STATUS | `PARTIAL_FRONTEND_VERIFIED / API_RUNTIME_NOT_RUN / QUESTIONVERSION_GATE_OPEN` |
| BASE | `d6fbf670bb6997cae0e841d8f9a397f0da785a42` (accepted T068) |
| BRANCH | `feat/yz-rd-t076-student-practice-web-completion` |
| WORKTREE | `/home/tian/code/work/yuzan-workspace-t076` |
| READY_TO_MERGE | `NO` |
| FINAL_SHA | Recorded in the task return after commit |
| HISTORICAL_L4 | `OPEN` per Task Card |
| L4_OPEN | `NO` — no Level 4 source/resource was opened |

## Scope and policy

Changes are limited to `frontend/assessment/**`, its directly corresponding frontend tests, and this T076 evidence. The checkout `AGENTS.md` lacks the `AA-DEV-V2.2` marker; the Task Card and project record supply no Lane-policy path. The user-provided `/home/tian/code/AGENTS.md` baseline and the explicit T076 runtime/content limits therefore govern. No shared branch, protected T005 source/media, mixed raw corpus, Docker/Compose, Worker, or other task runtime is authorized by this card.

The accepted T068 capsule records a clean visual integration checkpoint at this exact task base. It does not establish a real practice API E2E. The T076 Task Card itself is the implementation source for this work.

## Reproducible web gaps recorded before edits

1. **FIXED — a zero-item published practice still looked startable.** Reproduce by returning a catalog item with `itemTypes: []`, opening its detail with all `sections[].itemCount` equal to zero, then inspecting the detail action: the BASE rendered `data-start`. The existing create endpoint rejects this snapshot as “已发布练习没有可执行题目”. The catalog now labels the entry unavailable, and the detail shows an unavailable reason with no start action.
2. **DEFERRED — the catalog can resume a course-linked Attempt as a standalone practice.** Reproduce with two `listAssessmentSessions` rows for the same definition: a standalone Attempt and a newer Attempt with non-null `courseSubmissionId`; the client selects the newer Attempt by `updatedAt`. The practice service's own catalog query excludes `courseSubmissionId` rows. Expected: the catalog's resume target matches the standalone practice scope. This remains open within the Task Card's two-breakpoint repair limit.
3. **FIXED — a lost save or submit response was not reconciled with the same server Attempt.** Reproduce by making a save/submit request persist server-side and then reject locally with a network error or 409. BASE `runner.js` kept a generic error and pending local answer; after submit it remained in the runner without first reading the Attempt state. The Runner now rereads that exact Attempt and its answers; it routes to that ID's processing/report state when the server advanced, confirms a matching server-saved answer after 409/network loss, and leaves a status-check retry with submit locked while the server cannot be reached.

## Content-authority API boundary

The T068 `PracticeService` catalog DTO returns `itemTypes` but not QuestionVersion identifiers or approval state. Its attempt-item DTO also omits those fields, and `createOrResume` uses the authored item config when an item has no QuestionVersion relation. A frontend-only check cannot distinguish an authorized published QuestionVersion from that fallback. T072 is the current formal QuestionBank authoring task; this task does not change its API or fabricate a frontend eligibility signal. Formal source eligibility remains unverified until T072 provides a consumable contract and an authorized runtime source.

**T072 consumer contract handoff:** the student list/detail response needs a server-derived availability state and reason that distinguishes an authorized released QuestionVersion from a missing/unapproved source; Attempt readback needs a stable source-version mapping or equivalent server evidence for the exact item snapshot. A missing or unapproved source must remain unavailable and create/resume must reject it. This is a T072/API-owner change, not a T076 frontend inference. See [T072](https://app.notion.com/p/3ff909d673d281afaaa1c4be3c453b34) for its current authoring/API scope.

## Implementation

- `frontend/assessment/assets/practice.js`: explicit unavailable state for catalog entries with an empty `itemTypes` list and detail entries whose sections contain zero items. Active persisted Attempt links remain usable.
- `frontend/assessment/assets/runner.js`: reread Attempt/items after 409 or unknown/network answer-save outcomes; acknowledge only an exact server answer match. After an uncertain submit, reread the same Attempt, route terminal states by its ID, permit resubmit only after the server confirms it is still open, and provide a retry-check action while verification is unavailable. Deep-link 401/403/404 messages remain distinct.
- Direct attempts to reconcile source eligibility through frontend data were rejected: the current DTO has no QuestionVersion status to inspect. No backend or QuestionBank authoring files were changed.

## Verification

- Before implementation, the new T076 regression test reproduced the zero-item, 409/lost-submit, and indistinguishable deep-link error states on BASE.
- Focused T076 tests: **8/8 PASS** at final state, including preservation of valid non-empty practices and a locked submit state while server verification is unavailable with GET-only status retry.
- Full frontend suite: **149/149 PASS**; `pnpm --filter @yuzan/frontend test` also completed `frontend/scripts/verify-runtime.mjs` successfully using Node 24.20.0 and pnpm 10.13.1.
- Visual-only Chrome captures cover catalog and Runner at 1280×900 and 1440×1000. All four carry a visible `TEST_FIXTURE_ONLY` banner. These are layout evidence only; their API is an in-process browser stub and they prove no NestAPI/PG behavior. Files: [`catalog-1280-fixture.png`](screenshots/catalog-1280-fixture.png), [`catalog-1440-fixture.png`](screenshots/catalog-1440-fixture.png), [`runner-1280-fixture.png`](screenshots/runner-1280-fixture.png), [`runner-1440-fixture.png`](screenshots/runner-1440-fixture.png). Reproduce with [`visual-fixture-server.mjs`](visual-fixture-server.mjs) and [`capture-visual-fixture.mjs`](capture-visual-fixture.mjs).
- Real NestJS/PostgreSQL/Chrome practice E2E: **NOT_RUN**. No `psql`, `pg_isready`, `redis-cli`, or `minio` executable was available, and no listener was present on the project API/Web/PostgreSQL/Redis/MinIO ports checked (4000/4175/55432/6380/59000/59001). No Docker or another lane's runtime was used.
- Speech/MinIO flow: **NOT_RUN**; a written visual fixture is not a substitute. API lint was not rerun; T068's accepted capsule records 733 inherited API test-lint findings, unwaived.
- `git diff --check`: PASS. No protected T005 source/media, mixed raw content, Level 4 resource, teacher authoring API, Docker, or Worker was opened or changed.

## Remaining acceptance gaps

- Official QuestionVersion eligibility cannot be enforced by the current frontend API shape; coordinate the consumable approval/version fields with T072 before claiming formal-source catalog safety.
- The course-linked Attempt/catalog mismatch remains deferred. The real NestJS/PostgreSQL Attempt lifecycle, 401/403/404/409 service behavior, same-ID history readback, and full API lint remain unverified in this environment.
- `READY_TO_MERGE=NO` until the API/QuestionVersion boundary and the required native runtime acceptance are closed.

## Return fields

`SHA= RECORDED_IN_TASK_RETURN`; `CATALOG_STATE=UNIT_TESTED_EMPTY_CONTENT_UNAVAILABLE; FORMAL_QUESTIONVERSION_ELIGIBILITY=UNVERIFIED`; `START_RESUME_SAME_ATTEMPT=UNIT_TEST_ONLY`; `SAVE_AND_SUBMIT=UNIT_TESTED_409_AND_LOST_RESPONSE_RECONCILIATION`; `REPORT_PENDING_VS_FORMAL=NOT_RUN_AGAINST_API`; `DEEP_LINK_AUTH=UNIT_TESTED_401_403_404`; `DESKTOP_WEB=1280_1440_TEST_FIXTURE_ONLY`; `E2E=NOT_RUN_NATIVE_API_PG`; `READY_TO_MERGE=NO`.
