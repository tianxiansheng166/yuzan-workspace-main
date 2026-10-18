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
- SQL excerpts and rows: [`sql-results.txt`](sql-results.txt). MinIO GetObject/read-back checks with byte lengths, ETags, content types and SHA-256: [`minio-object-verification.json`](minio-object-verification.json), reproducible with [`verify-minio-recordings.mjs`](verify-minio-recordings.mjs). There are 15 verified recording objects in the bucket.
- Browser logs and response summaries: [`browser-logs/`](browser-logs/). Responsive screenshots: [`screenshots/`](screenshots/) (51 files). Quality-gate output and command exit codes: [`test-results/`](test-results/) and [`quality-gates.json`](quality-gates.json).

## Teacher assignment → student course

Final Chromium run: `browser-logs/t014-cross-role.log`; SQL proof: `sql-results.txt`.

- Final content/layout recheck school `9b0ebfd4-b9d4-4b6e-ba4c-8ffb711e4610`, class `8ccd6c5f-a9bf-4e84-9665-63e45ddbafb7`.
- Student A enrollment `33549ca3-25ec-486e-8ef3-f392bba4a530`; B `b589d374-582b-47e5-bd57-b81b95a958fa`; C `30149b3a-507f-4253-9338-1e7b601e7126`.
- Assignment `e6945ec1-b760-42f3-b271-83ba12d6defd` is `OPEN`. PostgreSQL has exactly two STUDENT targets, A and B; C is absent. A's Submission is `854fc0c5-d045-45e7-8021-6aeaf3eef316`; B's is `a0c87ee0-5fc2-4cb9-bc8a-7358d96f1271`.
- Teacher login → real class → student details → select A/B → create assignment was clicked in Chromium. Both students separately logged in, opened Today, clicked the task into the same assigned course, opened the actual activity, saved progress and refreshed. Each refresh resumed its own Submission. Activity `db38ed05-34a8-4964-8b01-e4e40ddeb463` has completed progress rows for A and B. The actual server payload had reading text in `content.body`; Chromium verified “真实测试内容” is rendered before confirmation. T014 recording `4d8222f0-a1bd-4c00-b8c4-2ebe88f278db` is `READY` and has a verified MinIO object.
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

Chromium 153 ran at 390, 768, 1280 and 1440 widths. T016/T017 evidence records document width equal to viewport width at all four sizes; the course center changes from one to two to three columns without horizontal overflow. The T014 course detail was also exercised at each of those widths. The E2E asserts `documentElement.scrollWidth <= innerWidth`, desktop columns fit beside one another, mobile sidebar stacks below the main column, and the completed control stays inside the exercise card with its success style. Screenshots cover all four detail widths plus Today, navigation/menu open and closed, course cards and details, the twenty-item runner, History, processing Growth and reviewed Growth.

The audit found and fixed two real course-detail defects on the isolated T019 branch: exercise content used a stale `exerciseSection` ID and fell back to appending outside the player card; desktop columns each reserved a percentage before adding their gap. The controller now renders into `#cpExercisesList`, and the flex columns share available width around the gap. Submit/success states have visible styles and focus treatment. Regression evidence is `browser-logs/t014-cross-role.log` and `screenshots/t014/t014-course-responsive-{390,768,1280,1440}-A.png`. The T005 shared worktree remains untouched. T005 has its own uncommitted edits in this directory, so the exercise-controller and style changes need a deliberate three-way review when the branches are later integrated.

## Verification matrix

| Area | Result | Evidence / detail |
| --- | --- | --- |
| PostgreSQL Prisma validation and 32 isolated migrations | PASS | `test-results/prisma-validate.log`; T019 database only |
| API full suite | PASS | `1101 passed`, `64 skipped`, exit 0; `test-results/api-full.log` |
| API typecheck and build | PASS | `test-results/api-typecheck.log`, `api-build.log` |
| StudentCourses service tests | PASS | 32 passed within the full API run; includes favorite concurrency and authorization |
| Frontend full suite | PASS | 63 passed, 0 skipped; `test-results/frontend-full.log` |
| Frontend typecheck and build | PASS | `test-results/frontend-typecheck.log`, `frontend-build.log` |
| Frontend rerun after course-detail fix | PASS | 63 passed / 0 skipped; runtime verify, typecheck and build logs under `test-results/frontend-course-detail-*` |
| OpenAPI generation, lint and contract tests | PASS | 6 passed; generation, Redocly, TypeScript pass; `test-results/contracts-*` |
| T014 teacher→targeted students→Today→course→activity text + four-width detail regression E2E | PASS | 1 passed; `browser-logs/t014-cross-role.log` |
| T016 navigation/Growth responsive and keyboard E2E | PASS | 1 passed; `browser-logs/t016-navigation.log` |
| T017 catalog/favorite/contract/security Chromium E2E after detail fix | PASS | 1 passed; `browser-logs/course-catalog-api-events.json` |
| T012 twenty-item audio/recording/submit E2E | PASS | 1 passed; `browser-logs/t012-e2e-summary.json` |
| T011 teacher review/formal report/student feedback E2E | PASS | 2 passed; `browser-logs/t011-teacher-review-growth.log` |
| T008 History alias/recording E2E | PASS | 1 passed; `browser-logs/t008-history-alias.log` |
| T013 Today/Growth E2E | PASS | 1 passed; `browser-logs/t013-today-growth.log` |
| MinIO object upload/read-back | PASS | 15 objects; `minio-object-verification.json` |
| Docker / Compose / P1-SIM / legacy PowerShell | NOT_RUN | Not used |
| Physical microphone, calibrated automatic speech scoring, school pilot, production launch | NOT_RUN | Outside this task; see limitations above |

No final acceptance suite failed. The 64 skipped API tests are existing environment-gated integration/runtime cases; the native cross-role E2Es cover the requested real-stack paths separately. A final full API rerun after documentation/evidence preparation also passed (1101 passed / 64 skipped) and is saved as `test-results/api-rerun.log`. One initial ad-hoc read-only psql invocation exited 127 before executing SQL because it lacked the task-local native library environment; all six queries passed on retry through the T019 runner environment. The isolated PostgreSQL role password was rotated and verified afterward, and its value is not recorded. Earlier exploratory reruns are retained only in the ignored T019 runtime evidence directory and are not counted as final acceptance runs.

## Protected worktrees and scope

- T019 changes and evidence are confined to `/home/tian/code/yuzan-workspace-t019` and this branch.
- T005 shared worktree remains on `feat/question-bank-v1` at `9c77c8cd35ffd45d6a164cc7a4ec616c3345fd15` with its existing bilingual DTO, service, OpenAPI/generated-type, `course-detail/`, test and source-resource modifications still present. T019 did not edit or stage that worktree, root `.env`, `local_sources/` or `习题课程资源/`. T019 has isolated branch changes in `exercise-controller.js` and `style.css`; review these alongside T005's same-path bilingual edits at the future merge.
- T018 remains at `73bb949b22f38b66f92edaa741aa042e504d2d7f`, with a clean status; no `frontend/teacher/reviews/**` file was edited, and no T018 service was stopped.
- T014/T015/T016/T017 source worktrees remained clean at their source commits. No Docker command or L4 historical volume access/rebuild/cleanup was performed; L4 remains OPEN.
- At final cleanup, only services whose ownership records belong to T019 were stopped. The T019 database, MinIO objects, logs and screenshots were retained. Final ports and process exits are recorded in `process-exit.txt`.

## Delivery state

T019 has its own pushed branch and is **READY_TO_MERGE**. It has **not** been merged into the shared `feat/question-bank-v1` branch. The final local/remote tip equality is verified from Git at delivery; the exact delivery SHA is in the task return and remote ref, since a commit cannot contain its own SHA.

Next web gaps: run a three-way T005/T019 review for `student-courses.service.ts`, OpenAPI/generated types, and `course-detail/exercise-controller.js` plus `style.css`; then run real-device microphone and the school pilot as separately authorized gates. Do not treat simulated recordings as physical-device evidence.
