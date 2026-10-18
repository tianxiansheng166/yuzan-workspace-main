# YZ-RD-T019 integration evidence

**Task:** YZ-RD-T019 — 四线功能滚动集成、成长导航与课程收藏合同修复

**Result:** DONE / WEB_ONLY

**Branch state:** `READY_TO_MERGE`; not merged into `feat/question-bank-v1`

**Base:** T015 `4475f418078e5800678a55b05d418d216962732e`
**Integrated source graph head before T019 implementation/evidence:** `b81f8b95d97cf6cddd3371e7615974d8c04cffe2`

## Git source graph and conflict review

T019 was created as a separate worktree from the exact T015 commit. Normal `--no-ff` merges preserve the source commits:

| Source | Exact source SHA | T019 merge commit |
| --- | --- | --- |
| T015 base (already contains T010–T013) | `4475f418078e5800678a55b05d418d216962732e` | base |
| T014 teacher class/remediation | `0596a9b8256c1d674b93eb2afd4de7306c768129` | `57c9f56` |
| T016 student navigation | `317cb79c4d10c2b77529e8b1335b86351e3e32d3` | `8b1fcdc` |
| T017 student course center | `392f02ac01cb8e766e8bd63095053b4879c78bed` | `b81f8b9` |

The T019 ancestry graph is:

```text
4475f41 (T015)
  └─ 57c9f56 merge T014 (0596a9b)
      └─ 8b1fcdc merge T016 (317cb79; retains its T016 ancestry)
          └─ b81f8b9 merge T017 (392f02a)
              └─ T019 implementation/evidence checkpoint
```

T010–T013 were already in T015; they were not cherry-picked or merged again. The overlapping `CURRENT_HANDOFF.md` and `scripts/dev-native-web.py` hunks were reviewed manually. The handoff retains both T014 and T015 checkpoints. The runner retains T014 class/remediation execution and T015's twenty-item/review suites, then adds T019-owned runtime and T016/T017 entry points. No unconditional `--ours`/`--theirs` resolution was used.

## Native runtime and retained evidence

- Native stack: Node 24.20.0, pnpm 10.13.1, PostgreSQL 17.11, Redis 7.4.10, MinIO `RELEASE.2025-10-15`, Chromium 153, Playwright 1.64.0.
- T019-only resources: database `yuzan_t019_native`, role `yz_t019`, bucket `yz-t019-native`; API 4119, Web 4319, PostgreSQL 55649, Redis 6449, MinIO 59222/59223.
- 32 existing migrations were applied only to the T019 database. The read-only Question Bank source import produced 120 items, 126 assets (90 images and 36 audio files), six practice definitions, 24 sections and six deliveries.
- Browser, API, PostgreSQL and MinIO were exercised together. Speech worker was stopped for the student recording/review flows, and `SPEECH_PROVIDER=disabled`; pending recordings remained pending manual review.
- SQL excerpts and rows: [`sql-results.txt`](sql-results.txt). MinIO GetObject/read-back checks with byte lengths, ETags, content types and SHA-256: [`minio-object-verification.json`](minio-object-verification.json), reproducible with [`verify-minio-recordings.mjs`](verify-minio-recordings.mjs). There are 13 verified recording objects in the bucket.
- Browser logs and response summaries: [`browser-logs/`](browser-logs/). Responsive screenshots: [`screenshots/`](screenshots/) (47 files). Quality-gate output and command exit codes: [`test-results/`](test-results/) and [`quality-gates.json`](quality-gates.json).

## Teacher assignment → student course

Final Chromium run: `browser-logs/t014-cross-role.log`; SQL proof: `sql-results.txt`.

- School `d2e0ee7a-0d43-4088-934a-8c4e3ddd13b8`, class `10583cfb-a4f6-4d5f-9aad-8a6df2cc0d3c`.
- Student A enrollment `a1cdac5b-8e3b-4f41-855c-eab1093918b6`; B `7f96f52a-203a-4749-ae6e-cf065e2a74ed`; C `0dfa92ab-a9cf-403c-94e7-a66103ed51ad`.
- Assignment `1881d6cf-2e18-4fdb-9ce8-f51fadd4c90f` is `OPEN`. PostgreSQL has exactly two STUDENT targets, A and B; C is absent. A's Submission is `596af160-4bc3-4355-a337-613371f5ab3b`; B's is `e6f175f1-3c08-4d9c-8093-6211b90e9144`.
- Teacher login → real class → student details → select A/B → create assignment was clicked in Chromium. Both students separately logged in, opened Today, clicked the task into the same assigned course, opened the actual activity, saved progress and refreshed. Each refresh resumed its own Submission. Activity `d3c83bcd-ffe3-4a4a-bcdb-362e748cd05a` has completed progress rows for A and B. T014 recording `452d3bd2-833b-41f9-a556-126feb15dc3a` is `READY` and has a verified MinIO object.
- C, a different class student D, and cross-school student X did not see the targeted task. API/browser coverage includes unauthenticated 401, wrong scope/role 403, missing resource 404, invalid target, duplicate assignment, idempotency replay, interrupted request, refresh and expired due date. The test restores the due date after the expiry check so retained data remains a live OPEN assignment.

## Student navigation, practice, history, review and growth

- Main navigation `我的成长` opens `/student/growth/`. Chromium exercised the menu by keyboard and on mobile, checked reduced-motion behavior, and visited Growth, History and practice routes. History aliases return the same lawful record set for the same authenticated student; both showed Processing attempt `3d47b7f5-4353-4fd7-a697-061aa949e37e` with 20 items and no formal report.
- T012 attempt `dd3dc230-04c0-42e9-a67e-87d87539fa22` has 20 items and remains `PROCESSING`, with zero reports and zero scored speech items before review. The browser played six question-bank audios, made four `SIMULATED_MIC` recordings, retried uploads, saved answers, cancelled the submit dialog and dismissed it with Escape, then confirmed once. Exactly one submit POST was observed. Four SpeechJobs reference four recordings.
- T011 review attempt `ea1f8994-519a-4c96-bf37-77334bf08a19` belongs to enrollment `dee8a9d8-e97a-48cd-9b7a-e9fa2bc60923`; before review it was Processing with no report. The teacher used the existing T011 review flow to score all six required items. The server then created formal report `7a238abf-b42c-4a1e-8a8a-aff0b74eadac` with test-fixture score 55 and completeness 100. The student re-logged in and saw the real report and six real `TEST_FIXTURE_ONLY` teacher comments in Growth. The UI does not hardcode 55.
- Recording IDs and object verification for the T011, T008, T012 and T014 flows are enumerated in `minio-object-verification.json`; the corresponding SQL rows/statuses are in `sql-results.txt`. `SIMULATED_MIC` is test media, not a physical-microphone pass. No automatic speech scoring or calibration is claimed.

## Favorite API and course catalog contract

- `PUT /schools/{schoolId}/student/courses/{assignmentId}/favorite` sets the state to true; `DELETE` sets it false; both return `{ "favorited": boolean }`. Repeated concurrent PUT requests return true and leave one row; repeated concurrent DELETE requests return false and leave zero rows. The legacy POST toggle remains and returns its actual state.
- Authorization is server-side: current active school and student enrollment are resolved from auth context, then the assignment is checked with `visibleAssignment`. Tests cover same-student access, another student's inaccessible assignment 404, another school 403, wrong role 403, unauthenticated 401 and missing assignment 404. Browser offline failure retains the prior server state, displays a retryable message, and succeeds after reconnection. Double-click produces one UI request; API idempotency is independently verified under concurrency.
- The DELETE 404→POST fallback was removed. Frontend add uses PUT; remove uses DELETE.
- The catalog contract matches the returned DTO: `categories`, `gradeBands`, `difficulties`, `sources`, `statuses`, `courses`, `total`, `hasMore`, `nextCursor`, plus the actual item fields. Chromium verified 24 rows against PostgreSQL, two 12-item cursor pages without duplicates, server filtering, sort order, 50% progress from one of two activities, real course details, keyboard detail/return, persisted favorite state and refreshed state. The generated types were regenerated from OpenAPI and contract tests pass.

## User interaction and responsive evidence

Chromium 153 ran at 390, 768, 1280 and 1440 widths. T016/T017 evidence records document width equal to viewport width at all four sizes; the course center changes from one to two to three columns without horizontal overflow. Screenshots cover Today, navigation/menu open and closed, course cards and details, the twenty-item runner, History, processing Growth and reviewed Growth. Keyboard focus, dialog cancel, Escape, retry, reload, actual dynamic course links and refreshed progress/favorites were exercised.

One visual defect remains on the existing T014 course-detail activity path: after completion, the “已确认” control is visibly unstyled and sits at the card edge. Its source is under the explicitly protected `frontend/student/courses/course-detail/` T005 working-tree changes, so this T019 branch did not edit those files. Functionality and persisted progress pass; repair should be reviewed together with T005's bilingual diff. This is a known visual follow-up, not a claim of a fully polished course-detail screenshot.

## Verification matrix

| Area | Result | Evidence / detail |
| --- | --- | --- |
| PostgreSQL Prisma validation and 32 isolated migrations | PASS | `test-results/prisma-validate.log`; T019 database only |
| API full suite | PASS | `1101 passed`, `64 skipped`, exit 0; `test-results/api-full.log` |
| API typecheck and build | PASS | `test-results/api-typecheck.log`, `api-build.log` |
| StudentCourses service tests | PASS | 32 passed within the full API run; includes favorite concurrency and authorization |
| Frontend full suite | PASS | 63 passed, 0 skipped; `test-results/frontend-full.log` |
| Frontend typecheck and build | PASS | `test-results/frontend-typecheck.log`, `frontend-build.log` |
| OpenAPI generation, lint and contract tests | PASS | 6 passed; generation, Redocly, TypeScript pass; `test-results/contracts-*` |
| T014 teacher→targeted students→Today→course→activity E2E | PASS | 1 passed; `browser-logs/t014-cross-role.log` |
| T016 navigation/Growth responsive and keyboard E2E | PASS | 1 passed; `browser-logs/t016-navigation.log` |
| T017 catalog/favorite/contract/security Chromium E2E | PASS | 1 passed; `browser-logs/course-catalog-api-events.json` |
| T012 twenty-item audio/recording/submit E2E | PASS | 1 passed; `browser-logs/t012-e2e-summary.json` |
| T011 teacher review/formal report/student feedback E2E | PASS | 2 passed; `browser-logs/t011-teacher-review-growth.log` |
| T008 History alias/recording E2E | PASS | 1 passed; `browser-logs/t008-history-alias.log` |
| T013 Today/Growth E2E | PASS | 1 passed; `browser-logs/t013-today-growth.log` |
| MinIO object upload/read-back | PASS | 13 objects; `minio-object-verification.json` |
| Docker / Compose / P1-SIM / legacy PowerShell | NOT_RUN | Not used |
| Physical microphone, calibrated automatic speech scoring, school pilot, production launch | NOT_RUN | Outside this task; see limitations above |

No final acceptance suite failed. The 64 skipped API tests are existing environment-gated integration/runtime cases; the native cross-role E2Es cover the requested real-stack paths separately. A final full API rerun after documentation/evidence preparation also passed (1101 passed / 64 skipped) and is saved as `test-results/api-rerun.log`. Earlier exploratory reruns are retained only in the ignored T019 runtime evidence directory and are not counted as final acceptance runs.

## Protected worktrees and scope

- T019 changes and evidence are confined to `/home/tian/code/yuzan-workspace-t019` and this branch.
- T005 shared worktree remains on `feat/question-bank-v1` at `9c77c8cd35ffd45d6a164cc7a4ec616c3345fd15` with its existing bilingual DTO, service, OpenAPI/generated-type, `course-detail/`, test and source-resource modifications still present. T019 did not edit or stage that worktree, root `.env`, `local_sources/` or `习题课程资源/`.
- T018 remains at `73bb949b22f38b66f92edaa741aa042e504d2d7f`, with a clean status; no `frontend/teacher/reviews/**` file was edited, and no T018 service was stopped.
- T014/T015/T016/T017 source worktrees remained clean at their source commits. No Docker command or L4 historical volume access/rebuild/cleanup was performed; L4 remains OPEN.
- At final cleanup, only services whose ownership records belong to T019 were stopped. The T019 database, MinIO objects, logs and screenshots were retained. Final ports and process exits are recorded in `process-exit.txt`.

## Delivery state

T019 has its own pushed branch and is **READY_TO_MERGE**. It has **not** been merged into the shared `feat/question-bank-v1` branch. The final local/remote tip equality is verified from Git at delivery; the exact delivery SHA is in the task return and remote ref, since a commit cannot contain its own SHA.

Next web gaps: review the course-detail completion-control style together with T005's protected bilingual work; run a three-way T005/T019 integration for `student-courses.service.ts`, OpenAPI and generated types; then run real-device microphone and the school pilot as separately authorized gates. Do not treat simulated recordings as physical-device evidence.
