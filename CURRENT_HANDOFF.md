# CURRENT HANDOFF

Last updated: 2026-10-19
Repository: `yuzan-workspace-main`

## YZ-RD-T045 mobile practice catalog acceptance (2026-10-19)

- COMPLETE / `NATIVE_CHROMIUM_API_POSTGRESQL17_REDIS_MINIO_VERIFIED` / NOT MERGED. Branch `feat/yz-rd-t045-mobile-practice-first-card`, start SHA `c1402145b132306adcc077555d641b2c0c4eaf83`; final SHA is the pushed branch HEAD.
- At 390×844, the first actual API result (`古诗文朗读与理解训练`, recording-required) begins at y=623; its title is fully visible at y=813–838. Mobile search and its 44px action share a row; ability facets remain in a keyboard/touch-operable native disclosure; the real recording filter is labeled `需要录音`. No promotional button wall was added.
- Frontend 96/96 PASS. Native Chrome 153 + NestJS API + PostgreSQL 17.11 + Redis 7.4.10 + MinIO E2E 1/1 PASS, zero skips. Search, MOCK/SPECIALIZED categories, actual recording filter, ability keyboard/touch, API-backed teacher-task rendering, four viewport widths, authorization negatives, simulated recording upload/read-back/retry, and PROCESSING/no-score/no-report behavior passed. Four exact viewport catalog screenshots are retained under `evidence/yz-rd-t045/e2e/`; detail and Runner responsive checks are in the E2E summary.
- Full evidence, resource usage, and resolved startup/test-attempt failures are in [`evidence/yz-rd-t045/RESULTS.md`](evidence/yz-rd-t045/RESULTS.md). Final T045 services were stopped and owned ports are free; isolated PG/MinIO data remains for audit. No Docker/Compose, T005/other task worktree edits, or L4 access. The target checkout lacks the AA-DEV-V2.2 marker; the supplied task card and root safety baseline were followed. L4 remains OPEN.
- `READY_TO_MERGE=NO`: inherited T033 API full-lint debt (1201 errors / 1 warning) remains unresolved. Physical microphone/device, calibrated speech scoring, manual review/report, school pilot, and production launch remain NOT_RUN.

## YZ-RD-T044 practice catalog UX hierarchy correction (2026-10-19)

- COMPLETE / WEB_ONLY / NATIVE_CHROMIUM_API_POSTGRESQL17_REDIS_MINIO_VERIFIED / NOT_MERGED. Branch `feat/yz-rd-t044-practice-catalog-ux-hierarchy`, exact start `ef3e5404ab43561b89b6bf863f5c7f7a250afa27`; Git HEAD is authoritative for the final SHA.
- The three large promotion cards are absent. Original server-backed MOCK/SPECIALIZED tabs remain; the compact oral filter sends the real `requiresRecording=true` catalog request. Chromium confirmed the authorized `停顿与节奏专项训练` flow and checked the small-screen filter layout after overriding the later shared CSS cascade in the T044-owned `practice.css`.
- Frontend 92/92 PASS; native Chrome 153 + API + PostgreSQL 17.11 + Redis + MinIO passed 1/1 with zero skips. Two recordings were auditioned, saved to MinIO, read back, recovered after interrupted upload, then submitted once. The Attempt remains PROCESSING with two CREATED SpeechJobs, no result, zero scored items, and no formal report. No teacher score, fake grade, or automatic score was generated. Auth 401/403/404 and four catalog/Runner viewports passed; `evidence/yz-rd-t044/RESULTS.md` and its screenshots/JSON/logs contain the evidence.
- T044 runtime ports were stopped cleanly; isolated database and MinIO objects remain for audit. No Docker/Compose, T005 or other task source edit, shared-branch merge, or L4 access. The target checkout's `AGENTS.md` lacks the AA-DEV-V2.2 marker; the supplied task card and root safety baseline were followed.
- `READY_TO_MERGE=NO`: inherited T033 full API lint debt (1201 errors / 1 warning) remains unresolved. Physical microphone/device, calibrated provider, human-reviewed formal report, pilot, and production launch remain NOT_RUN. L4 remains OPEN.

## YZ-RD-T038 checkpoint (2026-10-19)

- DONE / WEB_ONLY / NATIVE_CHROMIUM_API_POSTGRESQL17_MINIO_VERIFIED / READY_TO_MERGE. Independent branch: `feat/yz-rd-t038-speech-practice-exam-showcase`, exact start `39c01598e687f020037c82c23e3e0cfd7029ba64`; Git HEAD is authoritative for final SHA. The branch is pushed and not merged.
- Student browser proof entered `/student/practices/`, switched the server catalog to `MOCK` and `SPECIALIZED`, followed the oral `requiresRecording=true` entry to the authorized `停顿与节奏专项训练`, opened its real questions, played the sample, previewed two recordings, recovered a failed answer save and signed MinIO PUT, and submitted once. It then proved PROCESSING/no-score/no-report before manual review, the teacher PENDING queue item, and a complete server-generated formal report after an explicit teacher review.
- Native Chrome 153 + API + PostgreSQL 17.11 + Redis + MinIO passed 1/1 with zero skips. MinIO read-back confirmed two 24,446-byte WebM/Opus objects. Unauthorized, cross-school, same-school other-student, microphone-denied, and offline retry cases passed. Catalog and Runner widths 390/768/1280/1440 had no horizontal overflow; keyboard activation, dialog Tab/Escape, and Enter confirmation passed. Frontend suite: 92/92 PASS.
- `SPEECH_PROVIDER=disabled`, Worker stopped, and `SIMULATED_MIC` was explicit; no automatic speech score was generated. The formal zero came from 19 incorrect deterministic fixture choices plus one manual teacher score in dynamic `TEST_FIXTURE_ONLY` data. This is local QA evidence only. Physical microphone/device, calibrated scoring, school pilot and production launch remain NOT_RUN.
- Evidence and exact runtime outcomes are in [`evidence/yz-rd-t038/RESULTS.md`](evidence/yz-rd-t038/RESULTS.md). T038 native services were stopped and all owned ports are free; isolated DB/MinIO evidence is retained. No Docker/Compose, T005 or other task worktree edit, Tibetan subtitle publication, or L4 access occurred. The target checkout lacks the V2.2 marker; the supplied task card and root safety baseline were followed. L4 remains OPEN.
- NEXT: normal branch review/integration decision; schedule physical microphone and pilot gates separately.

## YZ-RD-T036 checkpoint (2026-10-19)

- DONE / WEB_ONLY / CHROMIUM_API_POSTGRESQL17_VERIFIED. Independent branch: `feat/yz-rd-t036-student-history-actionable-ux`; Git HEAD is the source of truth for the final checkpoint SHA. The branch has not been merged.
- Student history now uses exact server-side `IN_PROGRESS`, `PROCESSING`, and `COMPLETED` filters, cursor pagination, full cursor-backed name/Remediation search, and current-page-only ephemeral history data. Practice Attempt IDs are resolved through the authenticated API before linking to the unchanged Runner; status links open the same real Attempt. Formal report links/scores require the authorized full report, matching Attempt, `COMPLETED` Session, and `dataCompleteness=100`; numeric zero stays distinct from missing or incomplete data. Course-task `Feedback` and formal `AssessmentReview` comments use separate, source-labeled sections.
- Evidence and commands are in [`evidence/yz-rd-t036/RESULTS.md`](evidence/yz-rd-t036/RESULTS.md), with Chromium screenshots, the API/PG17 proof JSON, and native E2E log beside it. Chromium 153 + API + PostgreSQL 17.11 + Redis + MinIO passed 1/1, including cursor pagination/search, dynamic Runner/status/report/remediation clicks, 401/403/404/409, offline recovery, identity isolation, four viewports, keyboard focus, and status-announcement checks. Frontend suite: 90/90 PASS.
- T036's isolated runtime used fictional TEST_FIXTURE_ONLY rows. The zero-score report was generated by the normal API scorer/review/report path; no score or report was inserted directly. One simulated recording received an explicitly test-only manual review. Physical microphone/device testing, calibrated automatic speech scoring, pilot, and production launch remain NOT_RUN. T036 services were stopped; its isolated database and evidence remain.
- No T031 Runner, T033 API Client, backend source, teacher page, T005 original source, `local_sources/`, or L4 volume was modified or accessed. L4 remains OPEN.
- NEXT: normal branch review/integration decision; schedule physical microphone, calibrated scoring, and school-pilot gates separately.

## YZ-RD-T019 checkpoint (2026-10-18)

- DONE / WEB_ONLY / NATIVE_CHROMIUM_API_POSTGRESQL_MINIO_VERIFIED / READY_TO_MERGE. T019 is isolated on `feat/yz-rd-t019-web-rolling-integrated`, based on exact T015 `4475f418078e5800678a55b05d418d216962732e`. Ordinary merge commits preserve T014 `0596a9b8256c1d674b93eb2afd4de7306c768129` (`57c9f56`), T016 `317cb79c4d10c2b77529e8b1335b86351e3e32d3` (`8b1fcdc`), and T017 `392f02ac01cb8e766e8bd63095053b4879c78bed` (`b81f8b9`). T010–T013 already come through T015; they were not merged again. T019 is not merged into `feat/question-bank-v1`.
- Final native Chromium/API/PostgreSQL/MinIO cross-role proof passed after course-detail layout and content-field fixes. Teacher created OPEN Assignment `e6945ec1-b760-42f3-b271-83ba12d6defd` for A enrollment `33549ca3-25ec-486e-8ef3-f392bba4a530` and B `b589d374-582b-47e5-bd57-b81b95a958fa`; C `30149b3a-507f-4253-9338-1e7b601e7126` was not targeted. Both students opened Today→course→real activity, persisted progress and resumed their own Submission after refresh. Same-school other-class and cross-school identities were denied. SQL, ids, browser evidence and MinIO read-back hashes are in [`evidence/yz-rd-t019/RESULTS.md`](evidence/yz-rd-t019/RESULTS.md).
- Main student navigation now opens `/student/growth/`. Chromium used the 20-item Runner, played six audios, uploaded four `SIMULATED_MIC` recordings, dismissed submit with cancel and Escape, then confirmed once. Before manual review, the attempt remained PROCESSING with zero reports/scores. Existing T011 review completed six manual scores, after which the server generated report `7a238abf-b42c-4a1e-8a8a-aff0b74eadac`; the student saw the real report and teacher comments in Growth. History aliases returned the same lawful student record.
- Favorite add/remove now use idempotent PUT/DELETE returning `{favorited:boolean}`; legacy POST toggle remains. Concurrent repeated PUT/DELETE, 401/403/404, offline recovery, refresh, double click and authorization isolation passed. OpenAPI/generated types now match the actual catalog response (`gradeBands`, `difficulties`, totals/cursor and item fields). Catalog SQL parity, server filters, sorting, progress and 24-row/two-page pagination passed.
- PASS: API 1101 / 64 environment-gated skips, frontend 63 (rerun after the course-detail fix), contracts 6, Prisma validation, typechecks/builds, T014/T016/T017/T012/T011/T008/T013 browser suites and 15-object MinIO read-back. No final acceptance suite failed. Physical mic, calibrated automatic scoring, school pilot and production launch are NOT_RUN. T019 fixed exercise placement, `content.body` rendering and responsive layout in its isolated `exercise-controller.js`/`style.css`; Chromium verified the reading text and the four-width detail regression at 390/768/1280/1440 passes. The shared T005 worktree is untouched; review its bilingual edits against the T019 course-detail diff in a later three-way merge.
- T019's native services were stopped through its own ownership-aware runner after verification; its DB, MinIO objects, logs and screenshots remain. No Docker/Compose/P1-SIM/PowerShell or L4 volume access. T005's dirty shared worktree/resources and T018's clean review worktree were protected; T018 services were not stopped. T014–T017 source worktrees remain clean. See `evidence/yz-rd-t019/RESULTS.md` for complete ids, SQL, MinIO, test matrix, responsive screenshots, process exit and source graph.
- NEXT WEB GAP: three-way review/integration of T005's `student-courses.service.ts`, OpenAPI/generated types and `course-detail/exercise-controller.js`/`style.css` with T019; schedule real-device microphone and school-pilot gates separately. L4 remains OPEN.

## YZ-RD-T015 checkpoint (2026-10-18)

- DONE / WEB_ONLY / ROLLING_INTEGRATION / READY_TO_MERGE. T015 branch: `feat/yz-rd-t015-student-web-rollup`, based on T011 `4d971c9683664c09e533069ec001b00d0dc239af`. Cherry-picks used `-x`: T012 `67e79644e341164aaaf239ad4ebc466de1cc1c38` → `f15d1aac376adcb662d13d74ef995ba383cf2f26`; T013 `0bfd284dd8b31d95485c0be2b2993af15afef28e` → `96b0a44ab6d20e7d0f8fb27b21f3450848d21116`. T010 is already an ancestor through T011; no repeated T008/T010/T011 commits and no cherry-pick conflicts. T015 was pushed to `origin`; final remote SHA is verified after the evidence checkpoint. T015 is not merged into the shared branch.
- Chromium/API/PostgreSQL/MinIO passed the final combined native run: T008 20-item history 1/1, T012 Runner 1/1, T013 Today/Growth 1/1, and T011 assignment/review/report 2/2. The old T008 submission flow now clicks the confirmation cancel, presses Escape, reopens the dialog, and clicks Confirm; exactly one browser submit request is made. Attempt IDs, four Recording IDs per 20-item flow, SQL/S3 evidence, report/comments, screenshots, and commands are in [`evidence/yz-rd-t015/RESULTS.md`](evidence/yz-rd-t015/RESULTS.md).
- T015 used its own `yuzan_t015_native` / `yz_t015` database, bucket `yz-t015-native`, ports PG 55638 / Redis 6438 / MinIO 59202–59203 / API 4095 / Web 4295. The initial empty DB applied the existing 32 migrations. The existing Question Bank importer reused 120 question versions and 126 source media objects on final reruns. T015 services stopped with all owned ports free; database and objects remain for audit. No Worker or Docker was started.
- T011 actual review left report count 0 through the first review, then generated one COMPLETED report only after all six required reviews. After student re-login, the report and Growth showed score 55 and all six safe teacher comments. Growth renders only `teacherFeedback.comment`; reviewer IDs, rubric, answer key, and scoring configuration remain absent. T013’s separate intermediate Processing row is a database fixture and is not claimed as a completed transition.
- PASS: frontend 63; T012 frontend 12; T013 Today/Growth frontend 23; API suite 1082 / 64 skipped; OpenAPI generation/contract tests 6; contracts/API/domain typechecks; Prisma validation; runtime and diff checks. `NOT_RUN`: physical microphone/devices, calibrated automatic speech scoring, school pilot, and production launch. The worker was deliberately stopped and the browser microphone source was `SIMULATED_MIC`.
- T005's bilingual files/resource directory and root `.env` remain untouched. T010/T011/T012/T013 source worktrees remain clean. T014 completed separately at `feat/yz-rd-t014-teacher-class-remediation@0596a9b8256c1d674b93eb2afd4de7306c768129`; T015 did not modify its worktree or stop its services. Next web slice: short-cycle integration against that actual T014 final commit. L4 remains OPEN; its Docker volume was not accessed.
## YZ-RD-T014 checkpoint (2026-10-18)

- DONE / WEB_ONLY / NATIVE_CHROMIUM_API_POSTGRESQL_MINIO_VERIFIED. Exact base: `feat/yz-rd-t011-web-review-feedback@4d971c9683664c09e533069ec001b00d0dc239af`. Independent branch: `feat/yz-rd-t014-teacher-class-remediation`; implementation commit `193b59f75410233e829aaeed7b1a5c46d8ee57c8`.
- Fixed `/teacher/students/:enrollmentId` to serve the real student detail shell with `schoolId` and `classId` context. Teacher class roster, progress, assignment and assessment summaries use authorized APIs; absent progress/formal results stay null. Student detail shows actual submissions, released feedback, generated reports and recordings. Class report and student diagnostic links preserve `classId`, `enrollmentId`, and `practiceDefinitionId`; existing diagnostics had a `classes`/`practices` scope bug that is fixed.
- Supplementary practice is a real OPEN Assignment. Server checks active authorized teacher, school/class, published same-school CourseVersion, each ACTIVE STUDENT enrollment and future due date; rejects duplicate, cross-class/school, inactive and teacher targets. `Idempotency-Key` replays the existing ID/body or conflicts, and the transaction keeps audit evidence. Today now applies AssignmentTarget type/ownership and active due dates. Recording evidence is limited to the student, an assigned class teacher or that school's admin.
- T014 native E2E: 1 PASS using Chromium 153, NestJS, PostgreSQL 17 and MinIO. Teacher A opened the real class and student, played a MinIO recording, opened submission/review and authorized diagnostics, then created and reloaded Assignment `425a09ce-9ae3-4b0b-a47b-2c693203a638`. PostgreSQL confirmed OPEN and exactly these two STUDENT targets: A `26c99b1d-3401-4ac4-b8b8-078b8369211e`, B `764dee16-cf40-47d2-a604-bb1a672b9849`; C `d59060a5-8704-464f-ac5b-c370e8d78de5` is absent. A/B saw it in Today, opened the course, and recovered it after refresh; C, same-school other-class D and cross-school X could not see/read it. The run also covered API 401/403/404/400/409, expired due date, network abort with no created row/false success, and idempotent replay without a duplicate. Evidence: `runtime-local/native-web-t014/evidence/t014-t014-teacher-class-remediation-20261018T205541-4107038.log`.
- Tests: API focused 43/43 PASS; frontend 28/28 PASS plus runtime verifier; contract generation tests 6/6 PASS; API and generated-contract typechecks PASS; Redocly valid with two pre-existing ambiguous-path warnings. E2E fixture deliberately has no complete Question Bank snapshot, so the existing QB diagnostics reports “not assessed” instead of promoting a generic report score; student detail still shows the generated report score from its real report row.
- Native T014 owns `yuzan_t014_native` / `yz_t014`, bucket `yz-t014-native`, API 4091, Web 4291, PG 55631, Redis 6431, MinIO 59186–59187. API/Web/PostgreSQL/Redis/MinIO PIDs were stopped through the task-aware runtime; all six ports are closed. The isolated database, MinIO bucket and E2E evidence are retained. No Worker, Docker or Compose was used.
- T005's dirty bilingual work in `/home/tian/code/yuzan-workspace-main`, root `.env`, and `习题课程资源/` were not modified or staged. T012/T013 worktrees and owned pages were not changed. T014 is not merged into the shared branch. Notion V5 blueprint records the changed methods, DTOs, auth/status semantics and consumers. L4 remains OPEN.

## YZ-RD-T011 checkpoint (2026-10-18)

- DONE / WEB_ONLY / NATIVE_WEB_BROWSER_VERIFIED; REAL_MICROPHONE_AND_PILOT_NOT_RUN. Exact base: `feat/yz-rd-t010-native-web-integration@9b4340081e7d330007368062a898f4c11d29a14f`. T011 branch: `feat/yz-rd-t011-web-review-feedback`. No T008 cherry-pick was repeated. The T011 branch has not been merged to the shared development branch; its push state is determined by Git/remote.
- Teacher Assignment creation now consumes the POST response ID, sets `?assignmentId=<id>`, and loads/reveals that authorized ID even if the active page, search, or attention filter omits it. Refresh reopens the same Assignment. The server sort was not changed. Network failure remains unconfirmed and asks the teacher to refresh/check before retry; duplicate-click browser proof recorded exactly one POST. The review form now shows the saved result returned by the server. The student report read adds only reviewed item comments/timestamps from PostgreSQL; no reviewer IDs, answer key, rubric, or scoringSpec are projected. Report readiness remains the existing 20-item Question Bank gate.
- API 1082 passed / 64 skipped; frontend 28 passed; contract tests 6 passed; Redocly lint, generated types, API/frontend/contracts typechecks and builds passed. T011 native browser script ran the teacher dashboard (2 passed), T007 assignment (1 passed), T008 practice history/recording (1 passed), and T011 E2Es (2 passed), all with Chromium 153, NestJS API, PostgreSQL 17.11, Redis 7.4, and MinIO. No Docker, Compose, P1-SIM, or Worker was started.
- T011 Assignment evidence covers 0, 1, and 205 old tasks; direct-ID opening with nonmatching search and after refresh; UTC-naive old `createdAt`; one POST under double click; network failure with zero created rows and no success state; stale revision 409 followed by UI reload; class scope 403; and API/PG DRAFT→SCHEDULED→OPEN parity. Final transition row is test fixture Assignment `9750026c-10bf-429b-87aa-917b809312d8` (`OPEN`, revision 4; revision 1→2 was deliberately advanced to exercise stale conflict).
- E2E-2 used the existing Level 1 practice and 20-item Runner. Student submission produced four `SIMULATED_MIC` WebM/Opus recordings in MinIO, each with one SpeechJob; initial PostgreSQL state stayed `PROCESSING`, had 14 deterministic written scores, zero scored audio items, and no report. Teacher clicked six dynamic Review links, listened to a real recording, viewed the rubric/answers, and submitted every manual score/comment. The first review left report count 0; the sixth produced report `be1b7fd8-441e-4bc4-a31f-8b30f1137917`, score 55, with six PostgreSQL-backed teacher comments. Student A re-logged in, opened the report from own history, and saw all six comments. Student B, cross-class teacher, cross-school teacher, unauthenticated, invalid score, duplicate-score change, and missing-item negatives returned 403/401/400/409/404 as expected. T011 log: `runtime-local/native-web-t011/evidence/t011-t011-draft-review-feedback-20261018T190259-3817053.log`.
- T011 owns database `yuzan_t011_native` / user `yz_t011`, bucket `yz-t011-native`, ports PG 55630 / Redis 6430 / MinIO 59184–59185 / API 4090 / Web 4290. The 120-question import reused 120 versions and 126 objects from the protected `习题课程资源/` source, read only. T011 processes stopped; status reports all stopped and its ports are free. The T011 database, bucket, and fictional evidence remain retained.
- T005's dirty bilingual files remain in the original `feat/question-bank-v1` worktree and were not touched or staged. Root `.env` and `习题课程资源/` were not modified; `local_sources/` was absent in the initial workspace and was not accessed. No Docker or accident volume was used; L4 remains OPEN for its separate data owner. T011 has not been merged into the shared development branch.
- NOT_RUN: physical microphone/device and OS permission tests, calibrated automatic scoring, school pilot, production launch. No T011-required Web path remains open; physical device/pilot and production readiness are separate next scopes.

## YZ-RD-T010 checkpoint (2026-10-18)

- DONE / WEB_ONLY / REAL_DEVICE_AND_PILOT_NOT_RUN. Integration branch: `feat/yz-rd-t010-native-web-integration`, based on freshly fetched `feat/question-bank-v1@9c77c8c`. T008 `e8d8c55` was the sole source-branch commit cherry-picked from the shared `ee77c89` base; cherry-pick `927c557` had no conflicts. T007/T009 commits were already present and were not reintroduced. Final integration SHA is Git runtime truth.
- T008's student practice catalog/detail/attempt/history UI is integrated. The old `run-yz-rd-t008-student-history.sh` now exits with a DISABLED message and performs no cleanup. T007 assignment, review, and runner business implementations were retained; the empty `data-nav` review anchor now has its real dynamic destination so the Chromium test follows it.
- Native tools were reused from T009: Node 24.20, pnpm 10.13.1, PostgreSQL 17.11, Redis 7.4.10, MinIO, Chrome 153, and the existing Playwright venv. T010 owns its `runtime-local/native-web-t010` state, DB `yuzan_t010_native` / user `yz_t010`, ports PG 55629 / Redis 6429 / MinIO 59182–59183 / API 4089 / Web 4289, and bucket `yz-t010-native`. Its 32 migrations ran once on a confirmed new empty database; reruns verify all migrations are complete and skip migration/seed. Source import explicitly targets the T010 seeded school/class and reuses 120 items + 126 T010 MinIO objects. The protected question source was read-only.
- T007 Chromium + real NestJS API/PostgreSQL: 1 passed / 0 skipped. Latest dynamic records: Assignment `42917053-1c46-4e64-b8c1-37eaab69b5e0`, Submission `18ce58f1-33f4-4b47-93f1-ed3703947bfd`, Review `839cc082-e116-4bb8-a54d-630e7a7ca080`, transition Assignment `3c45db0b-10b1-4453-8b4f-009280f4bcb5`. SQL/API stats were 1/1/1; 156 authorized assignments matched SQL filters and cursor pages; clicking the dynamic Review link opened its real page. Chromium checked assignment details at 1280 and 1440, with screenshots retained. T007 log: `runtime-local/native-web-t010/evidence/t010-t007-assignment-20261018T160131-3131654.log`.
- T008 Chromium + real NestJS API/PostgreSQL/MinIO: 1 passed / 0 skipped. Latest Student A/B are fictional and dynamically created; Attempt A `08b3f461-4b21-4d78-9085-89350828a05b` is the same ID in Runner, submit response, processing state, and history. The history action opens the existing `/assessment/sessions/{id}/processing/` route for this `STANDARD` session; the practice catalog resumes through `/student/practices/attempts/{id}/processing/`. The 20-item run played 6 question clips and uploaded 4 `SIMULATED_MIC` WebM/Opus objects (23,480 bytes each), verified by MinIO HeadObject; each has one SpeechJob. Injected PUT failures were retried 4/4. PostgreSQL confirms session `PROCESSING`, 0 AssessmentReports, and 0 scored audio items. Fourteen real deterministic written-item scores were saved from the actual answers; the history correctly displayed “尚未形成报告或成绩” and no formal aggregate result. Student B could not read A's attempt/history. T008 log: `runtime-local/native-web-t010/evidence/t010-t008-student-history-20261018T155649-3109238.log`.
- The business models remain separate: T007 validates Assignment → AssignmentTarget → Submission/Review; T008 validates PracticeDelivery → AssessmentSession/Recording/SpeechJob/History. No foreign key was invented between the independent practice Attempt and Assignment Submission. Both fixtures use the same fictional school/class environment.
- Checks: API 1082 passed / 64 skipped (database/runtime integration cases); frontend 26 passed; contracts 6 passed; OpenAPI lint, generated-types test, API/frontend/contracts typechecks and builds, Prisma schema validation, Python/shell syntax, and diff checks passed. T010 services were stopped through their identity/port-checked native owner entry; latest stop returned PASS and all T010 ports are free. PostgreSQL data, MinIO bucket/objects, screenshots, and logs are retained. No worker was started.
- NOT_RUN: formal speech scoring/report completion, real microphone/device, school pilot, production launch. `SIMULATED_MIC` is not device evidence. T005 dirty work and root `.env` hashes were captured before/after and are unchanged; `习题课程资源/` remains 178 files / 1,967,035,976 bytes with unchanged metadata, and `local_sources/` is unchanged.
- The default-volume incident remains OPEN and separate. Original evidence is `evidence/yz-rd-t008/RESULTS.md`; T010 did not inspect, recreate, restore, or clean `yuzan-four-port-postgres-55432`. The environment/database data owner still needs to investigate actual loss, backups, and restore conditions.

## YZ-RD-T007 checkpoint (2026-10-18)

- **Historical checkpoint status: BLOCKED / NATIVE_POSTGRES_API_CHROMIUM_PASSED_WITH_UI_LINK_GAP; T010 closed the link blocker in the integration branch above.** Business baseline `feat/question-bank-v1@ee77c899aa36effc3b661f7ce5bde48dbdb574dc`; current runtime base was `3a5484f890f4d990382f9b49d5963769b73e05f8`. No teacher task-management or T006 source was re-developed. Canonical route remains `/teacher/assignments/`.
- Native proof used an isolated T007 PostgreSQL 17.11 database/user and T007-only ports `55627/4087/4287`; T009's native runtime was verified stopped and its database/config were not reused. Chromium 153 + real NestJS API + PostgreSQL completed 1 E2E test. Dynamic records: Assignment `740108ca-a78f-4adc-8c5c-23d35f536350`, Submission `af4c0b82-4e26-40cf-a91e-10d19c840025`, Review `67878987-6f54-4ef4-b18e-46267cb2b1fa`, transition Assignment `54123ee5-bf7e-4716-9dce-610eb5f13f55`.
- PASS: SQL/page parity for class/status/title/due filters and 283 authorized assignments; SQL-verified cursor pages 1–20 and 21–40; stats and authorized student list match PostgreSQL; real Submission/Review API details; Teacher B cross-class, Student B cross-class, and cross-school rejections; empty teacher, one-shot API failure/retry, deep-link refresh/back; DRAFT→SCHEDULED→OPEN rapid duplicate protection (one request per transition, final SQL `OPEN|3`). The review route was opened in Chromium using the dynamic href after verifying it; no mocked API response was used.
- Regression: API suite 1085 passed / 64 skipped; frontend assessment tests 17 passed; contracts Redocly lint, TypeScript, and temporary direct OpenAPI-generated-types comparison passed. Python syntax and `git diff --check` passed. Evidence screenshot is in ignored `runtime-local/native-web-t007/evidence/assignment-published.png`.
- **T007 checkpoint findings:** assignment roster anchors had empty `data-nav`, and an exploratory UI-created DRAFT sorted outside the first page because its stored `createdAt` was UTC-naive while DB-seeded rows use local DB time. T010 gave the dynamic Review link an explicit destination and verified a real click; the UTC-naive DRAFT sorting case remains a follow-up outside this integration's fixture flow.
- Runtime cleanup: T007 native stop command returned PASS; PostgreSQL/API/Web PIDs and ports exited; pytest and temporary Chromium profile processes exited. T009 remains stopped. No database or MinIO data directories were deleted; root `.env` was not written or replaced.
- T005's uncommitted bilingual files, source assets, and other task data remain outside the T007 staging/commit set. T008 was not changed. No product/schema/scoring changes were made.

## YZ-RD-T006 checkpoint (2026-10-18)

- DONE / WEB_API_BROWSER_VERIFIED; REAL_DEVICE_AND_PILOT_NOT_RUN. Scope stayed Web. Baseline was `feat/question-bank-v1` / `4d9322fc9494e284eb028e032694b0572692489f`; exact final SHA/push receipt is reported in the task return and Git.
- Canonical `/teacher/` now reads GET `teacher/dashboard` plus existing authorized Classes/student-summary APIs. Teacher name/school, own draft-course count, open task count, real task done/total, pending Submission reviews, class counts and per-student progress come from the authenticated account and API/DB. Loading, empty, 403 and recoverable network error states are explicit.
- Task entries open `/teacher/assignments/?assignmentId=<real-id>`, expand the correct task and show existing GET `assignments/:id/stats` results. Review entries open `/teacher/submissions/<real-submission-id>`; GET submission detail now validates own student or assigned teacher class and supplies real student/task names. Home class/student entries open the correct class detail and locate the selected student.
- Fixed teacher-specific dashboard count scoping, class-summary cross-teacher disclosure, class list API-client loading and static demo markup, class detail route/assets, student summary response mapping, shell fake identity/date/badges, class/task static fallback values, assignment page fake attention counts, and legacy `submission-1`/demo-student routes. OpenAPI and generated types cover teacher dashboard, Assignment stats, and Submission detail fields.
- Tests: API 21 focused unit tests PASS; dashboard model 3 PASS; contracts lint/typecheck/Prettier and direct generated-type comparison PASS; API typecheck/build PASS; isolated real PostgreSQL/API/Chromium E2E 2 passed/0 skipped. `scripts/generate-types.test.mjs` has 4 failures/2 passes because it invokes `pnpm exec`, whose automatic install check is blocked by `ERR_PNPM_IGNORED_BUILDS`; the workspace-config side effect was restored. E2E verifies fictional Teacher A/B/C across same/different schools, an empty teacher, live task/review/class/student routes, 403/404 scope negatives, retry, refresh, and 390/1440 layout.
- Isolated project `yz-rd-t006-20261018`: PostgreSQL 55606, Redis 6427, MinIO 59178–59179, API 4084, Web 4284. Only fictional `TEST_FIXTURE_ONLY` data was added in the test DB; no production identity/data was touched. Screenshots: `/tmp/yz-rd-t006-runtime/teacher-home-1440.png`, `teacher-home-390.png`. T006 API/Web and its Compose project are stopped after proof; volumes/log evidence are retained and other development services were not stopped.
- Existing T005 bilingual code and its tests remain unstaged/uncommitted and were not included in T006. The original `习题课程资源/`, `local_sources/`, and protected workspace config match their pre-task state. The contract test briefly injected `allowBuilds` into the workspace config before failing; this was immediately restored and remains clean.
- Remaining static references are recorded in [05 校准 v5](docs/11-product-delivery/05-开发路线任务图与验收门禁.md); next slices are real Assignment filters/actions and a unified authorized review-detail/decision flow. The design-only research dashboard, secondary teacher tools, real devices and pilot remain NOT_RUN / not approved by this browser checkpoint.

## YZ-RD-T004 checkpoint (2026-10-18)

- DONE / H5_MOBILE_BROWSER_VERIFIED；REAL_DEVICE_NOT_RUN。Baseline `feat/question-bank-v1` / `7f8ea126b4da4f26a0ab8f59d20207c8808c5292`，fetch confirmed remote 0/0 before checkpoint. Final SHA is Git runtime truth.
- 390×844、430×932、1440×1000：教师公共API创建课程/发布及 Assignment DRAFT→SCHEDULED→OPEN，学生UI重新登录→Today主行动→真实正文/MP4/PDF→统一Runner→原生MediaRecorder录音/试听/上传→课程返回/刷新复用同一Attempt/Submission。390完成4题提交与2项课程活动回写；430/1440为部分学习恢复。
- 修复准备页进入旧逐题路径、Runner缺课程返回/提交返回被覆盖、跟读音频题未展示朗读文本、PDF重复与媒体过时回调、空视频框。录音实际MIME、重复点击/资源释放、本机IndexedDB草稿及刷新重试；幂等init更新签名、已完成对象不重复PUT、服务端读回绑定才报成功。通用recorder不再静音演示/定时假同步。未重建业务系统，未改后端/Schema/评分。
- Final Chromium4 passed/0 skipped (53.42s)；API137、frontend15+runtime、course8、contracts6；API typecheck/build、frontend typecheck/build、JS/Python syntax/diff PASS。负向麦克风拒绝/不支持为浏览器注入；PUT失败/offline/403、完成后绑定失败、草稿刷新、双击、真实跨学生拒绝均通过；MinIO真实过期签名403。最终失败0；开发期失败与未运行项见 [05 校准 v4](docs/11-product-delivery/05-开发路线任务图与验收门禁.md)。
- 所有麦克风证据为 SIMULATED_MIC。原生 Chromium WebM/Opus、MP4/Opus（430 MIME偏好受控，不是Safari），API/DB Recording PROCESSING、AssessmentItem绑定、每条1个SpeechJob，MinIO字节/Content-Type/SHA256一致；实际音频归一16kHz mono PCM16 PASS。未启动worker/scorer，报告0，不能声称评分通过。
- 390px: Assignment `de63e1d3-cb4e-4451-8620-26a4ffddecb9` / Attempt `9f3cfadc-982e-4aee-9d72-b0e4ef87b814` / Recording `6bb4921b-814a-4738-94a3-f98484252b49`。完整Submission/Activity/Item/MIME/字节/摘要在05。
- 430px: Assignment `525334c6-9b1e-414e-ab24-bf05654a9c69` / Attempt `95139a9b-bf6a-41a8-8e18-8c5d002539d0` / Recording `c1fa1c0b-ebf1-4fdb-9962-7b1e9567d329`。完整Submission/Activity/Item/MIME/字节/摘要在05。
- 1440px: Assignment `629d90bd-db18-41e2-938f-1a92ebe149ad` / Attempt `d41eaea9-3826-4700-8bc0-697ece61b781` / Recording `f805b909-ef30-4f30-a530-5bb7bda7002e`。完整Submission/Activity/Item/MIME/字节/摘要在05。
- Isolated project `yz-rd-t004-20261018`，DB55564/Redis6399/MinIO59066–59067/API4064/frontend4264，bucket yz-t004。32迁移/虚构seed；素材为测试自有生成MP4/PDF经真实上传，授权/课程关联/投放是明确隔离夹具；Assignment/Attempt/Recording/进度均走业务API。自有服务取证后停止，卷保留；无其他任务服务启停。日志/截图/音频/DB `/tmp/yz-rd-t004-runtime/`。原始资源与所有保护文件未动。
- NOT_RUN：Android/iOS真机、真实权限/麦克风/网络切换、Safari AAC/WebKit、生产语音与正式报告、全库/六级回归。本机草稿可被浏览器清理，存储不可用时UI会提示；该故障分支未注入测试。CURRENT_TASK.md历史任务不覆盖本任务。
- NEXT：安全HTTPS入口 + Android Chrome/iOS Safari真实设备验收，再处理真实反馈与正式移动发布门禁。QB-009B保持PARKED；本任务没有批准正式评分或上线。

## YZ-RD-T003 checkpoint (2026-10-18)

- Outcome: teacher real browser login → create DRAFT1 → schedule SCHEDULED2 → open OPEN3 → student real re-login → Today → same real course → TEXT acknowledgment → refresh resumes same Submission. No SQL Assignment creation/state shortcuts. Start baseline `feat/question-bank-v1` / `388874b8251946726aed68c438a396836946f345`; fetch confirmed remote 0/0 before commit. Final SHA is Git runtime truth.
- Added POST `/schools/:schoolId/assignments/:assignmentId/schedule`; schedule/open return200 with required integer `expectedRevision>=1`. OpenAPI `/open` replaces stale `:open`; generated types and teacher generic API calls agree. No state-machine bypass/schema change. Server checks PUBLISHED course, school/class/student target scope, teacher ACTIVE class enrollment, dates and optimistic revision (read revision must match before atomic write; future revisions fail closed). Teacher reads/mutations and student CLASS-target reads now enforce scope.
- Teacher UI selects published course/authorized class and start/due times; labels DRAFT “已保存草稿”, SCHEDULED “已排期（需手动开放）”, only OPEN “已发布”. Duplicate-click guard, visible failure, reload and revision-conflict recovery included. Automatic future opening is unsupported and stated in UI.
- Notifications only after successful OPEN; assignmentId in actionUrl, student recipients deduplicated. Notification outage cannot roll back OPEN or hide Today; no outbox/retry system added.
- Evidence: API Assignment/Submission/Learning138 + Today/StudentCourses46 passed; contracts6; frontend12 + runtime verify; API typecheck/build, contract generation, JS/Python syntax and diff checks PASS. Chromium/PostgreSQL3 passed/0 skipped (13.08s): full UI flow, negative401/403/404/409/400, non-target student, unauthorized teacher/class/real foreign school, stale revision, network failure/reload, concurrent open200/409 with one notification, assignment-scoped DB notification failure still OPEN/Today visible. Exact commands and evidence matrix in [05 校准 v3](docs/11-product-delivery/05-开发路线任务图与验收门禁.md).
- Main Assignment `27b18e8c-03f5-400e-93ba-79982c38a11f`; class `54788a55-29ef-4ef0-9aeb-8e1f393e20e0`; Submission `1f0708d7-15e8-464e-b8b9-97b0b51064f1`; activity `51eb0ad2-dd61-43ba-9baf-7448ef85973e` completed. Notification1 targets the same student/Assignment. Outage task `2717e25d-13a7-4857-95b2-73d1864f9f05` OPEN4/notification0/Today visible. Concurrent task `c6f6f8f0-8be7-4905-8531-812ad5c87517` OPEN3/notification1.
- Isolated project `yz-rd-t003-20261017`, DB55563/Redis6398/MinIO59064–59065/API4063/frontend4263. Fresh migrations/fictional seed, dynamic tested business objects. No foreign service used/stopped. Own services stopped after proof; volumes retained; logs/screenshots `/tmp/yz-rd-t003-runtime/`. Temporary notification-failure trigger removed (0 remaining). Original `习题课程资源/` and `local_sources/` untouched/unstaged.
- NOT_RUN: recording, SpeechJob, formal reports, six-level full flow, full suites, real devices/pilot. DB Recording/SpeechJob/AssessmentReport0. QB-009B stays PARKED. CURRENT_TASK.md historical scope does not supersede this task.
- NEXT: 390/430 H5 Today→course→Runner→return and real-device recording validation. Automatic timed opening and reliable notification retries are separate follow-ups; no automatic publishing claim. DEVELOPMENT_STATUS updated for this publication milestone.

## YZ-RD-T002 checkpoint (2026-10-17)

- Task outcome: Today 主推荐、真实课程卡、legacyTasks 在第一/第二有效班级均能打开动态课程，正文/阅读确认/刷新/返回闭环通过。旧 `spring-2` 是有效兼容跳转，保留。任务起点 `feat/question-bank-v1` / `0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8`；实际 fetch 后与该远端功能分支 `0/0`；比 `origin/main` 多 16 commits（起点事实，不是最终 SHA）。最终分支/SHA 以 Git 为准。
- Fixed actual seams: course list failure no longer becomes empty; Today loading/empty/error/processing/ready stay distinct, slow catalog does not block main CTA, failures retain recoverable UI. ExerciseController now renders the already-loaded initial activity. API adapters map practice creation and course list/detail/writes/notes to the authenticated student's active school enrollments and actual resource scope; no client enrollment/identity parameter added. Optional missing course theme no longer hides a valid course. No Prisma/DTO/scoring/provider change.
- Evidence: API focused 68 passed / 0 skipped; frontend 12 + course adapter/sync/shell 8 passed; API typecheck/build, contracts validate, JS/Python syntax, diff check PASS. Chromium real API/DB 4 passed in 8.68s, 0 skipped: both class scenarios × three sources, body/ack persisted, one Submission each, refresh/back, real cross-student404 and missing404, injected network/403/404 recovery, second-class canonical Level 1 Runner refresh/back with 20 persisted items. Detail IDs, full commands and evidence-level matrix are in [05 校准 v2](docs/11-product-delivery/05-开发路线任务图与验收门禁.md).
- Real proof: second-class assignment `bc6235dc-78af-4ab7-a312-933dc2c39b5c`, submission `46e89abc-fe5e-4b36-a5c3-b10401ec16cb`, completed ActivityProgress; canonical attempt `5eacd303-aae7-4dcb-ab6a-401efa4d0849` IN_PROGRESS / 20 items. Source input was read only for isolated Level 1 import; generated output is in task `/tmp`. No original resources staged/changed; all identities are fictional fixtures. Already-OPEN course delivery is explicitly a DB fixture, not a successful teacher publishing claim.
- Runtime: own project `yz-rd-t002-20261017`, DB55562/Redis6397/MinIO59062–59063/API4062/frontend4262. No foreign services used or stopped. Task processes/containers stopped after proof, own volumes retained. No worker/speech provider was started. Logs/screenshots: `/tmp/yz-rd-t002-runtime/`; database has 0 reports/recordings/SpeechJobs. Full suites, six-level completion, current speech/review/report/remediation, mobile device and real-user pilot are NOT_RUN; historical evidence below remains historical.
- Remaining concrete gap / NEXT: ordinary teacher Assignment create returns DRAFT, direct open returns 409 `ASSIGNMENT_STATUS_INVALID`; state machine expects DRAFT→SCHEDULED→OPEN but no schedule API found. Next slice: teacher creates→schedules→opens→student Today sees task, under one backend API/OpenAPI owner; do not SQL-open to claim acceptance. Next after that: mobile H5 Today→course→Runner→return at 390/430 + real-device recording. Daily short learning feedback and bilingual support follow actual feedback/content authorization. Review/remediation-assignment OpenAPI omissions are recorded in 05. QB-009B stays PARKED / EXTERNAL_INPUT.
- Initial tracked tree was clean; only protected untracked `习题课程资源/` existed. Old paragraphs mentioning pre-existing dirty workspace config describe history, not this task's Git state. `CURRENT_TASK.md` is historical DONE; this explicit T002 supersedes its default continuation. No broad milestone was reopened, so DEVELOPMENT_STATUS.md was not changed. Notion URL was inaccessible; local 05 is the versioned authority for this calibration.

## COMP-DEMO-05 checkpoint (2026-09-08)

- Final baseline was verified on `feat/question-bank-v1` at remote HEAD
  `5619bdf48638a455692389d352ba1dad1a62658b`. No backend, schema, speech
  provider, calibration, assessment scoring, or completed runtime record was
  changed.
- Added the normal `MIND 结构` tab and deep link
  `/teacher/courses/spring/studio/?courseVersionId=18d87c9c-b52b-414a-851e-c17b2defd6e0&tab=mind`.
  The view is a deterministic, CourseVersion-data-backed structure view, not
  an AI semantic-inference claim. The verified graph used the real course
  title, 2 `CourseVersion.objectives`, unit `核心学习路径`, lesson
  `《春》生字认读与易错音纠正`, 4 real activities, 2 real resource kinds
  (`VIDEO/video/mp4`, `DOCUMENT/application/pdf`), and the real practice
  reference exposed by `Activity.content.practiceLabel`.
- Video-facing visual debt was limited to hiding absent teacher/activity-count
  fields instead of showing `待定教师` or `0课时`, labeling real
  `estimatedMinutes` as minutes, hiding empty teacher/AI summary content, and
  falling back from the missing imported cover path to the checked-in local
  course cover. No content or score was fabricated.
- Chrome 1920×1080 verification: student today PASS; student courses PASS;
  real course detail PASS; actual course runner `8e2d60a4-9ecf-4789-bc04-604c4c4256f6`
  PASS with the real read-aloud item at 2/5; completed report
  `b8e8492c-8dc7-4163-b326-52c883b14aea` PASS; remediation runner
  `22b6a0ba-f4f0-42ff-9dc3-a5b2fe40835d` PASS at 1/15; MIND PASS with 12
  visible nodes and clickable source details. The exact teacher-review deep
  link reached the real guard “当前测评已经结束，不能打开待复核题目”; the
  queue truthfully showed 0 pending items, so it was not bypassed or repaired.
- Targeted frontend tests passed: 15 tests. `node --check` passed for all
  touched JavaScript and `git diff --check` passed. The protected untracked
  `习题课程资源/` input remains untouched.

## COMP-DEMO-04 checkpoint (2026-09-07)

- Completed the runtime closure on `feat/question-bank-v1`: worker now passes
  `PROVIDER_TASK_UNSUPPORTED` as a stable failure code; the API keeps the
  uploaded Recording `READY` for that code and still fails genuine audio or
  storage errors closed. No review/remediation domain, schema, provider
  adapter, calibration policy, or fake provider result was added.
- The unified Runner exposes a normal re-record path only for a historical
  `Recording=FAILED` item, using a fresh idempotency key while preserving the
  old Recording/SpeechJob. Teacher detail says `自动语义分析未启用 · 请依据
  原始录音人工复核` and does not construct diagnostic metrics.
- Targeted evidence: worker 11 passed; API 71 passed; frontend 7 passed; API
  and worker typechecks plus diff checks passed. The broader Prettier check
  retains baseline warnings in the existing compressed/long-line files.
- Browser evidence used the seeded student and teacher accounts. The canonical
  20-item STANDARD session
  `b8e8492c-8dc7-4163-b326-52c883b14aea` reached `COMPLETED`; report
  `5deb4acf-b3bd-4cf6-bc93-53571441c0e7` is `100%` complete with overall
  formal score `17` and 15 real `retryCandidates`. Reviewed item IDs are
  `9ca28f7d-8dce-4353-b06e-8b1d85e2ab67`,
  `fdb4a0fe-08da-4156-a529-bb79ea45d82b`,
  `36b73b88-aff4-4638-b0c3-30c812459090`,
  `53c961ab-33db-4028-83c8-0b748a104bc9`,
  `2a9f5f61-7b68-4656-b113-f061edda9503`, and
  `23c9448a-2b12-4773-ab4e-d595818f9d28`; all have formal score/comment.
- The old open-response Recording/SpeechJob remains historical
  `FAILED/PROCESSING_FAILED`. A new Recording
  `2b5824b4-2d8d-40a1-8f30-aab83cae37ae` is `READY`, bound to the same item;
  its new SpeechJob is `FAILED/PROVIDER_TASK_UNSUPPORTED`, with no autoResult.
  The teacher UI showed the original recording evidence and the unsupported
  analysis message. Because this Chrome host had no physical microphone, the
  re-record UI was exercised with the repository's temporary valid-WAV browser
  harness; the final Runner page has no harness installed.
- Student report → `开始巩固练习` created real remediation attempt
  `22b6a0ba-f4f0-42ff-9dc3-a5b2fe40835d` (`REMEDIATION`, 15 items), and the
  unified Runner visibly opened its first question. No database shortcut was
  used.
- The protected untracked `习题课程资源/` input was not modified or staged.

## COMP-DEMO-03 checkpoint (2026-09-07)

- Selected exactly one demonstration lesson: `《春》生字认读与易错音纠正`
  (七年级, 王雨晴). The source MP4 is 450.182 s / about 7:30; the source
  teaching-design and exercise DOCX were read without modification. The other
  four lesson folders were not imported.
- `PrismaCourseVersionRepository.save()` now round-trips
  `capabilityTheme`, `difficulty`, `estimatedMinutes`, `coverAsset`,
  `deviceRequirements`, `taskGroups`, and `culturalElements`; the targeted
  repository integration suite has 15 passing tests.
- Added a trusted local importer at `tools/course-importer/` plus the compiled
  apply script. It extracts only the selected teaching title/objectives and two
  short choice questions, converts the selected PPTX to a runtime PDF artifact,
  uploads only the MP4/PDF to MinIO, and sets `APPROVED` with
  `rightsNote=团队自有课程素材`. Stable source checksums/object keys make the
  second apply reuse the same records.
- Runtime IDs: `courseVersionId=18d87c9c-b52b-414a-851e-c17b2defd6e0`,
  `assignmentId=6f4d6052-5469-404f-a41f-aea568b3a82c`,
  `practiceDefinitionId=70000000-0000-4000-8000-000000000001`.
  Imported resources: 2 (`VIDEO/video/mp4`, `DOCUMENT/application/pdf`), both
  `APPROVED`; assignment is `OPEN` and targets the seeded active student class.
- Browser verification with real student `student.test` covered
  `/student/courses` → the real course card → course detail → real MP4 loaded
  and played for 3.1 seconds → PDF first page visible in the course page →
  real DOCX-derived choice submitted and still `已完成` after refresh →
  `朗读训练 / 本课能力练习` → existing unified runner → actual read-aloud
  item. The runner attempt was intentionally left in progress; no fake score
  was created.
- Runtime migration drift discovered during the real run was limited to schema
  already present in `schema.prisma`: CourseVersion metadata JSON columns,
  CourseFavorite, and StudentActivityNote.videoTimestamp. Three small alignment
  migrations were added; no Prisma model/schema redesign was made.
- Known issues: the seeded course catalog still labels its activity count as
  `0课时` and shows `待定教师`; this is pre-existing presentation debt and did
  not block the requested path. The original `习题课程资源/` directory remains
  untracked and protected; no raw MP4/PPTX/DOCX is in Git.

## COMP-DEMO-01+02 checkpoint (2026-09-07)

- The existing `IflytekSpeechReadingProvider` made a real ISE WebSocket call
  with local-only credentials and received real dimensions. The result stayed
  `UNCALIBRATED`, `requiresReview: true`, and `finalizable: false`.
- A concrete timing compatibility fix changed the ISE default end-to-end
  deadline from 30 to 60 seconds: ISE sends 40 ms real-time frames, so a
  30-second recording otherwise reaches its final frame after the old timeout.
  No adapter architecture or scoring policy was changed.
- `frontend/assessment/assets/app.js` and `app.css` now compose the existing
  reading route as a 1920×1080 text/recording stage and render the safe
  student-facing ISE diagnostic only from existing item `autoResult` data.
  The report shows null dimensions as “本次未提供”, a review status, source
  evidence drawer, and a user-authorized recording player; it never reads
  provider audit/raw XML or promotes a diagnostic to a formal score.
- The user-provided `习题课程资源/` folder is now available as a read-only
  authoring source. Its question DOCX, answer/rubric DOCX, and media ZIP passed
  the canonical preflight: 6 levels, 120 items, 600 points, 120/120 bound,
  90 images, 36 audio, zero errors and zero warnings. The runtime apply was
  executed with `--source-dir 习题课程资源 --all --apply`; it created 126
  checksum-addressed Resources/MinIO objects, 120 immutable Question Bank
  item versions, six published level practices, 24 sections, and six open
  class deliveries. The six old seed-authored practice deliveries were closed
  while their historical definitions/attempts remain intact.
- Each of the five folders in `示范课.zip` passed archive integrity and contains
  one MP4, one PPTX, and two DOCX files (teaching design plus post-class
  exercise). The course archive is verified as a complete source pack, but its
  course-unit import remains the next COMP-DEMO-03 task; raw archives are not
  committed to Git.
- A canonical Question Bank READ_ALOUD attempt was created and a real source
  audio file was uploaded to MinIO. Worker consumed the SpeechJob and the ISE
  callback reached `NEEDS_REVIEW` with `provider=iflytek`; student-safe payloads
  keep raw result data out of the browser and leave `scoredScore` null.

## Git truth

Run `git branch --show-current` and `git log -1 --oneline`; live Git results
are authoritative. Expected active branch: `feat/question-bank-v1`.

Do not infer a commit SHA from this document. The task-start dirty change in
`pnpm-workspace.yaml` is pre-existing and protected; do not stage or modify it.

## Current outcome

QB-008R and the Levels 1–6 rollout are implemented on the current feature
branch. QB-009A, QB-010, QB-011, QB-012, QB-013, and QB-014 are complete.
QB-015F release evidence closure is **DONE / READY_FOR_PILOT**. QB-016 pilot
observability and the feedback loop are **DONE / PILOT_OBSERVABLE / BROWSER
VERIFIED**. QB-009B
remains `PARKED / EXTERNAL_INPUT`; see [`CURRENT_TASK.md`](CURRENT_TASK.md),
[`RELEASE_READINESS.md`](RELEASE_READINESS.md), and
[`PILOT_RUNBOOK.md`](PILOT_RUNBOOK.md).

## QB-015F closure evidence (2026-08-24)

- Isolated runtime: Compose project `qb015f-release-20260824d`, database
  `qb015f_fresh`, API `4019`, frontend `4180`, MinIO `59028`, Redis `6393`;
  shared `p0-integration` was not used. The runtime was torn down after the
  final run.
- Real PostgreSQL: QB-015F integration `2 passed`; two teacher-assigned
  students, exact question-version snapshots, duplicate `RESUMED`, different
  focus coexistence, self-remediation separation, scope denial, and assigned
  READ_ALOUD review closure all passed.
- Chromium: teacher assignment `1 passed`; Level 1 release loop `1 passed`;
  QB011/QB012/QB013 each `1 passed`; parameterized Levels 1–6 `6 passed in
  786.09s`. The controlled mock scorer was enabled only in the isolated speech
  process and was unset in the production shell.
- Final functional evidence was executed from the checkpoint commit recorded
  by Git after `test(release): verify teacher assigned remediation runtime`;
  this handoff intentionally does not infer or embed a commit SHA.

QB-015 did prove clean frozen install, 28 isolated migrations, fresh 120-item
runtime apply, zero-duplicate re-apply, 126/126 MinIO object HTTP integrity,
and full non-browser quality gates. It fixed three release issues: Prisma now
accepts a supplied `DATABASE_URL` without a root `.env`; fresh bootstrap creates
or verifies its configured MinIO bucket; legacy self-remediation uses an
explicit null-safe origin filter compatible with Prisma/PostgreSQL. The
remaining limitations are documented in `RELEASE_READINESS.md`; none block a
controlled pilot.

The original DOCX/ZIP files under `local_sources/` were inspected as read-only
inputs and were not modified, moved, deleted, or staged.

## Recovery and provenance

The importer now executes:

`raw source → parser → structural recovery → explicit repair ledger → canonical
validation → immutable runtime apply`.

Structural recovery is generic and structure-driven. An unlabeled candidate
followed by `B/C/D` becomes `A/B/C/D`; two unlabeled candidates followed by
`C/D` become `A/B/C/D`. Ambiguous or unsafe patterns fail closed. Existing
`A/B/C/D` input is unchanged. Recovered values carry server-side provenance and
are never included in student payloads.

Authorized repairs are recorded in
[`content-repairs.json`](tools/question-bank-importer/content-repairs.json):

- `L1-READ-WORD_RECOGNITION-003`: structural recovery restored option `A`.
  The old published v1 remains immutable; the corrected item is published as
  v2 and the Level 1 practice as a new immutable version.
- `L2-SPEAK-READ_ALOUD-003`: exactly one reproducible
  `AI_AUTHORED_GAP_FILL` item, family `READ_ALOUD`, scoring mode
  `SPEECH_READING`, max score 4. Its trace is explicitly derived and has no
  fabricated Word paragraph range.
- An isolated Level 4 two-label omission was recovered structurally using the
  same generic rule; it is represented as `STRUCTURAL_RECOVERY` provenance.

## QB-009A speech provider boundary

- iFlytek uses the official ISE streaming WebSocket adapter with backend-only
  AppID/APIKey/APISecret configuration and HMAC request signing.
- Tencent uses the official new SOE WebSocket adapter with backend-only
  AppID/SecretID/SecretKey configuration, signed query parameters, 16 kHz
  40 ms binary frames, and an explicit end frame.
- Both adapters accept only server-prepared 16 kHz / 16-bit / mono WAV bytes,
  preserve nullable vendor dimensions, and keep raw vendor responses in
  server-side audit data only. Auth, malformed response, timeout, and provider
  configuration failures fail closed; non-transient failures are not retried.
- Cloud providers handle `SPEECH_READING` only. Open response/picture speaking
  remains on the local diagnostic route.
- Every provider result is `experimental: true`, `calibrationStatus:
  UNCALIBRATED`, `finalizable: false`, and `requiresReview: true`. The API
  policy rejects calibrated/finalizable cloud evidence and never writes a
  formal `scoredScore` from it.

## QB-009A benchmark and privacy status

- `pnpm speech:benchmark` supports manifest-driven synthetic or explicitly
  approved live runs and reports validity/failure, MAE/RMSE, Pearson/Spearman,
  tolerance bands, p50/p95 latency, and review-required rate.
- The checked-in example is synthetic only: 2 samples, 0 real samples. Cloud
  smoke was skipped as `SKIPPED_NOT_CONFIGURED`; no credentials were printed,
  committed, or used to call a provider.
- With fewer than 30 real labelled samples the report is
  `INSUFFICIENT_CALIBRATION_DATA`; formal runtime activation remains
  `DISABLED` and teacher review remains the authority.

## QB-010 deterministic diagnosis

- Only a completed standard Question Bank session with all 20 formal scores
  can persist `summary.diagnosis` with version `qb-diagnosis-v1`; partial,
  missing-metadata, or zero-max-score sessions fail closed without a diagnosis.
- The builder uses only formal `scoredScore`, `maxScore`, and immutable
  Question Bank domain, family, and level. It aggregates actual points into
  `LISTEN`, `SPEAK`, `READ`, and `WRITE`, plus the eight canonical families;
  no denominator, level rule, or provider candidate point is hard-coded.
- Bands are `STRONG` (>=85), `DEVELOPING` (>=70), and `PRIORITY`; priorities
  are deterministic (percentage asc, lost points desc, canonical family order)
  and strengths use the inverse deterministic ordering. Display names and
  guidance are fixed Chinese mappings in the backend.
- The student report DTO projects an explicit allowlist and never returns
  answers, scoring specs, rubrics, source traces, provider raw/audit data,
  transcripts, or candidate points. Existing/legacy reports return
  `diagnosis: null`.
- The student report shows domain capability cards, strengths, priorities, next
  steps, and a safe Practice Center handoff. It does not create remediation
  content; that is QB-011.

## QB-014 teacher targeted remediation assignment

- `AssessmentSession` now records nullable `remediationOrigin` and safe JSON
  `remediationFocus`; legacy nullable remediation rows are treated as
  `SELF_INITIATED`. New sessions are explicitly `SELF_INITIATED` or
  `TEACHER_ASSIGNED`, while STANDARD remains null.
- Teacher assignment is `POST /schools/:schoolId/teacher/question-bank-diagnostics/classes/:classId/remediation-assignments` and reuses `AssessmentReviewService.assertAuthorizedClass`. Every selected enrollment must be an ACTIVE STUDENT in the authorized class or the request fails closed.
- The server—not the client—selects each target's latest completed STANDARD
  session for the chosen `practiceDefinitionId`, validates its persisted
  `qb-diagnosis-v1` retry candidates against the immutable source item
  snapshot, and applies an ALL_RETRY or canonical FAMILY filter. No source or
  matching candidates yields a safe per-target skip; no empty attempt is
  created.
- The shared remediation builder makes clean subset snapshots with the exact
  source question versions. It preserves no answers, scores, recordings,
  reviewer data, speech jobs, or provider evidence. Exact active duplicates
  resume under a PostgreSQL transaction-scoped advisory lock; different focus
  values may coexist. Self-remediation searches only SELF_INITIATED/legacy
  rows, so it cannot be redirected to a teacher assignment.
- Students discover only their own teacher-assigned remediation tasks through
  `GET /schools/:schoolId/assessments/sessions/assigned-remediations`; the
  Practice Center links active tasks to the existing Runner. The dashboard
  projects only safe latest assignment state/count/focus metadata.
- Migration: `20260824110000_add_assessment_remediation_origin`.

## Runtime state

- Canonical validation: 120 items / 600 points, six levels, zero errors and
  zero warnings.
- Every level: 20 items / 100 points; `LISTEN 6/24`, `SPEAK 4/26`,
  `READ 6/24`, `WRITE 4/26`; 15 image and 6 audio bindings.
- Published practices: six canonical 20-item practices, four sections each,
  20 references each, one open delivery each. Catalog total is 12 including
  the six legacy practices.
- Media: 90 unique images and 36 unique audio resources.
- Repeated `--apply --all` runs were fully reused: resources, question items,
  question versions, practices, practice versions, sections, refs, and
  deliveries all reported zero new records on the verification reruns.
  Existing Level 1 v1 remains present and the corrected v2 is the active
  published version.
- Security audit of active canonical deliveries: 20 refs per practice, four
  sections, zero student-visible source-trace leaks.
- Completed QB reports persist the diagnosis snapshot in their existing JSON
  summary and reuse it for repeated finalization/report reads.
- QB-011 adds `AssessmentSessionPurpose` with `STANDARD` as the migration-safe
  default. A `REMEDIATION` session is created only from the student's completed
  20-item standard session and its persisted, revalidated diagnosis retry
  candidates. It reuses source practice IDs and question versions but snapshots
  only fresh, safe delivery data. Active attempts resume; a completed attempt
  allows a new round.
- Remediation uses existing response, deterministic scoring, and teacher-review
  paths. Once its subset is scored it completes without an `AssessmentReport`
  or diagnosis and keeps the source formal result immutable. Its dedicated
  result projection contains only completion and score aggregates, never
  answers, rubrics, delivery/scoring specs, or provider audit data.

## QB-012 student progress tracking

- `qb-progress-v1` is a deterministic, read-only derived view. It does not add
  a `ProgressSnapshot` table, migration, cache, or any mutation to historical
  reports, diagnoses, or item scores.
- The student endpoint is
  `GET /schools/:schoolId/students/me/question-bank-progress`. Its identity is
  derived exclusively from the active student auth context and school scope;
  no client-supplied student or session identifier can select another student.
- Formal trend includes only `STANDARD` + `COMPLETED` Question Bank sessions
  with a formal report and persisted `qb-diagnosis-v1`. It reuses the stored
  `overallScore` and diagnosis percentages; it never regenerates diagnosis or
  reads provider candidate points. Trends are grouped strictly by
  `practiceDefinitionId`. A practice-version change remains comparable within
  the level and is flagged, while cross-level results are chronological
  milestones only and never have a score delta.
- Baseline-only levels return null deltas and student wording that a second
  same-level assessment is needed. Latest same-level comparisons expose
  deterministic domain/family percentage changes (improved, stable, attention)
  from the two persisted diagnosis snapshots.
- Completed `REMEDIATION` history is grouped by its original
  `retestOfSessionId`, then sorted by `createdAt`/id into rounds. Every item is
  matched only by identical `questionVersionId`; ambiguous/missing versions,
  full-score source items, invalid scores, and max-score mismatches fail
  closed with `PROGRESS_COMPARISON_INVALID`. `MASTERED`, `IMPROVED`,
  `UNCHANGED`, and `LOWER` are scoped to that original question only.
- The student payload allowlists aggregate scores, percentages, item version
  IDs, and safe comparison states only. It never includes answers, scoring
  specs, rubrics, source traces, transcripts, provider raw/audit output, or
  provider candidate points.
- The student “学习进步” page presents separate same-level formal cards,
  listening/speaking/reading/writing and family changes, scoped remediation
  rounds, and a milestone timeline. Formal reports and remediation results now
  include a “查看学习进步” entry; existing repeat/back actions remain intact.

## QB-013 teacher diagnostic dashboard

- The read-only teacher dashboard reuses `AssessmentReviewService`'s exact
  review scope: an ordinary teacher sees only classes with an ACTIVE TEACHER
  enrollment; school/platform admins retain the existing in-school admin scope.
  Cross-class and cross-school requests are denied server-side.
- It lists only formal Question Bank practices identified from published
  `PracticeDefinition → PracticeVersion → PracticeItemRef → QuestionBankItemVersion`
  runtime relations. The selection authority is `classId + practiceDefinitionId`.
- The cohort denominator is every ACTIVE STUDENT enrollment in the selected
  class. Each student contributes at most their latest completed STANDARD
  report with a persisted `qb-diagnosis-v1`; invalid history is excluded safely
  and counted as a data-quality issue, never treated as zero.
- Domain/family cards aggregate persisted percentages only. Common difficulties
  use average percentage ascending, priority-student count descending, then the
  canonical family order; strengths use the inverse score order. Remediation is
  projected only as “专项巩固” and is never included in the formal class average.
- Student rows are display-name ordered, never score ordered. They expose only
  same-practice self deltas, safe priority/remediation summaries, and pending
  review counts. There is no rank, position, percentile, cross-level delta,
  answer, rubric, transcript, provider result, or candidate-point projection.
- `GET /schools/:schoolId/teacher/question-bank-diagnostics` returns the
  authorized selection catalog. Class and detail endpoints use batched Prisma
  reads and QB-012's `deriveQuestionBankProgress` helper; the teacher UI is
  `/teacher/diagnostics/` and links to the existing review queue.

## QB-016 pilot observability and feedback loop

- `GET /health/live` remains process liveness only. `GET /health/ready` now
  checks PostgreSQL with `SELECT 1`, Redis with `PING`, and the configured S3 /
  MinIO bucket with a read-only `HEAD`; any failed core check returns public
  `503` without configuration, credentials, stack traces, or internal endpoints.
  Readiness never calls the bootstrap bucket-creation path.
- Worker writes `WORKER_HEARTBEAT_KEY` every 15 seconds with a 60-second TTL by
  default. API pilot overview reports `UP`, `STALE`, or `UNKNOWN`; heartbeat is
  process liveness evidence only and is not speech calibration or formal-score
  authority.
- `GET /schools/:schoolId/pilot/overview?window=24h|7d` is school/platform-admin
  scoped and derives formal Question Bank funnel, stale processing, existing
  reviewable backlog, remediation origin split, speech/recording status counts,
  open feedback, dependency state, deterministic warnings, and overall state.
  It does not rank students or return student score rows.
- `PilotFeedback` is a new domain, separate from course-submission `Feedback`.
  Students, teachers, and school admins submit plain text; server authorization
  validates session/item ownership or teacher class scope and derives the
  question version. Answers, rubrics, transcripts, recordings, provider raw
  output, IPs, and device fingerprints are not stored. Admins acknowledge or
  resolve, and reporters can read status/resolution through `feedback/mine`.
- The Student Question Bank Runner has the prioritized feedback entry and
  history; Teacher 学情诊断 has a page-level feedback modal/history; School
  Admin `/admin/pilot` shows system state, 24h/7d metrics, warnings, and recent
  feedback actions. API paths are documented in the OpenAPI contract.
- Added migration `20260824130000_add_pilot_feedback` and `PILOT_RUNBOOK.md`.
  QB-009B remains parked; no cloud speech APIs or calibration were started.

## QB-016 verification

- Isolated runtime: Compose project `qb016f-pilot-20260824a`, database
  `qb016f_pilot`, API `4020`, frontend `4181`, Redis `6394`, MinIO `59022`,
  and the fresh runtime was torn down after verification. Shared
  `p0-integration` and the old `qb015-release` project were not used or
  modified.
- Latest migration `20260824130000_add_pilot_feedback` was applied to the
  empty isolated database; Prisma generate/validate, seed, API/Worker build,
  and the existing six-level Question Bank bootstrap passed.
- Real PostgreSQL integration
  `backend/api/test/pilot/pilot.runtime.integration.spec.ts`: `1 passed`,
  `0 skipped`. It exercised real STANDARD/REMEDIATION aggregation, feedback
  create/mine/admin resolution, speech failure warning, and scoped service
  behavior.
- Real Chromium `tests/e2e/assessment/test_qb016_pilot_feedback.py`: `1
  passed`, `0 skipped`, with `QB_RELEASE_BASE_URL=http://127.0.0.1:4181`.
  The browser created the Level 1 attempt, submitted feedback, acknowledged
  and resolved it in `/admin/pilot`, then reloaded the student Runner and saw
  `已解决` plus `已核实并安排修正`.
- Runtime smoke: `/health/live` and `/health/ready` returned `200`; admin
  overview returned `200` with worker `UP`; admin page returned `200`;
  anonymous, student, and cross-school overview requests were denied. The
  real PilotFeedback row had only the allowlisted business fields; no answer,
  rubric, source/provider, transcript/audio, IP, or device-fingerprint fields
  were present.
- Pilot module tests: `10 passed`; existing Course Submission Feedback
  regression: `20 passed`. API full Vitest: `1021 passed, 63 skipped` (the
  separate runtime integration above was the only QB-016 runtime proof and
  was not skipped). API typecheck/build and frontend test/build passed.
- Worker full Vitest: `54 passed`; heartbeat unit coverage included.
- Contracts validation/test/typecheck, database validate/migration contract,
  frontend test/build, API/Worker typecheck, and Python E2E collection passed.
- Concise non-secret evidence is recorded in
  [`evidence/qb016f-pilot/RESULTS.md`](evidence/qb016f-pilot/RESULTS.md).

## Verification snapshot

- Final QB-015F release runner (`tests/e2e/assessment/run-qb015f-release-gates.sh`)
  passed in isolated project `qb015f-release-20260824d`: PostgreSQL `2 passed`,
  assignment Chromium `1 passed`, Level 1 `1 passed`, QB011/QB012/QB013 each
  `1 passed`, Levels 1–6 `6 passed in 786.09s`, contracts/frontend smoke PASS.
  See `evidence/qb015f-release/RESULTS.md`.
- Final API full suite: `1011 passed, 62 skipped`; Worker full suite: `51
  passed`; Contracts: `6 passed`; Python release suite: `11 passed` plus
  `py_compile` and shell syntax checks. Course-assignment and student-course
  regressions are included in the API full suite.

- QB-014: Prisma generate/validate, database build, API typecheck/build, and
  full API Vitest pass (`1011 passed`, `62 skipped`). The focused remediation
  coverage proves clean subset snapshots, exact duplicate resume, different
  focus coexistence, and explicit teacher-assigned origin. Frontend runtime
  build and contracts validate/test/typecheck pass.

- Importer tests: `16 passed`.
- API verification: final full Vitest run `995 passed`, `58 skipped`, no
  failures; the real-DB deterministic/runtime integration run passed `3/3`
  tests.
- Worker tests: `51 passed`; provider contract, audio preparation, benchmark,
  routing-safety, and existing worker tests pass. Worker typecheck/build pass.
- Frontend tests passed.
- Speech-scoring tests: `9 passed`.
- API typecheck/build passed.
- API speech policy/service tests: `30 passed`.
- Contracts validation/test/typecheck and frontend test/build passed.
- Benchmark CLI completed with synthetic data and safe cloud skips.
- Source validation passed for `--level 1` and `--all`.
- Dry-run apply passed for `--level 1` and `--all`.
- Parameterized browser coverage exercises Levels 1–6 end to end and passed
  `6 passed in 786.09s`, including media loading, answer persistence,
  submission, teacher review, and the point-based report gate. The run used
  the repository's explicit mock speech scorer for diagnostics only.
- The Level 1 browser regression now passes through
  `tests/e2e/assessment/run-level-one-mock.sh`: four ready recordings, three
  `SPEECH_READING` and one `SPEECH_OPEN_RESPONSE` local `NEEDS_REVIEW` jobs,
  four bounded student-safe diagnostics, 14 deterministic scores, six formal
  scores pending, `PROCESSING`, and no premature report. The runner starts an
  explicit test-only mock scorer and restores a default scorer with mock unset.
- QB-007's Level 1 student-to-teacher review flow passed: `1 passed, 5
  deselected in 141.82s`.
- QB-010 Level 1 student-to-teacher completed-report flow passed: `1 passed in
  133.81s`. It verified 20/20 items, 100 max points, four domains/eight
  families, no diagnosis leakage, a formal 84/100 result, `READ_ALOUD` then
  `PICTURE_SPEAKING` priorities, and the rendered student capability cards.
- QB-010 diagnosis unit/security/scoring coverage passed, including perfect and
  weak cases, tie ordering, zero score, zero max/missing metadata rejection,
  teacher-final speech authority, deep deterministic equality, levels 1/3/6,
  partial and 19-of-20 sessions.
- QB-011 remediation unit/security coverage, real-DB runtime integration, and
  a Chromium browser journey passed. The browser proof creates the retry from
  the source report, runs exactly four selected questions, persists that subset
  across refresh, and verifies the “本次巩固” result does not expose answer or
  scoring configuration fields.
- QB-012 progress unit/service coverage passed (`6` tests), including baseline
  handling, same-level delta, version change, domain/family changes, processing
  exclusion, provider-data exclusion, exact-match remediation states, multiple
  rounds, ownership, and fail-closed mismatches.
- QB-012 real PostgreSQL integration passed: Level 1 `84 → 91`, one four-item
  remediation with three mastered items, and an independent Level 2 baseline.
  The source formal item scores remained unchanged.
- QB-012 Chromium E2E passed through
  `tests/e2e/assessment/test_qb012_progress.py`: the real student page showed
  Level 1 `比上次提高 7 分`, domain changes, `4 道题，3 道已掌握`, scoped
  recovered points, a separate Level 2 baseline, and links back to both the
  formal report and remediation result.
- Final API regression without broad integration-DB opt-in: `1011 passed`,
  `62 skipped`; API typecheck/build, contracts validation/test/typecheck, and
  frontend test/build passed.
- QB-013 service/security coverage passed (`4` focused cases): own versus other
  class and cross-school scope, catalog admin scope, five-student cohort
  denominator (`3` assessed / `1` processing / `1` unassessed), latest-only
  `84 → 91` self delta, remediation isolation, mixed versions, four domains,
  eight families, deterministic ordering, review counts, no ranking, no
  sensitive-field leakage, and no dashboard N+1 loops.
- QB-013 Chromium E2E passed through
  `tests/e2e/assessment/test_qb013_teacher_diagnostics.py`: isolated Class A
  showed 5 eligible, 3 assessed, 1 processing, 1 unassessed, 60% coverage,
  81-point average, four domains/eight families, one pending review, Student 1
  `+7`, remediation summary, detail view, and a 403 request for Class B.
- QB-012 student-progress Chromium regression passed again (`1 passed in
  8.20s`). The QB-007 browser fixture now self-provisions missing active
  student/teacher membership rows for an isolated local test database.
- QB-007 Level 1 browser regression passed again (`1 passed, 5 deselected in
  134.49s`) through the explicit mock-scorer runner. A processing-page scope
  error for `isRemediation` was corrected; the runner restored the default
  local scorer with `MOCK_SPEECH_SCORING` unset.

## Existing platform limitations

Local and cloud speech diagnostics remain experimental and uncalibrated; they
do not produce formal automatic rubric scores. The former stale Level 1 browser
assertions have been replaced with the current `SPEECH_READING` plus
`SPEECH_OPEN_RESPONSE` semantics and pass under the explicit controlled mock
runtime. The default scorer is restored with `MOCK_SPEECH_SCORING` unset.

QB-009B remains `PARKED / EXTERNAL_INPUT`: it needs approved consented
recordings, teacher labels, credentials if live smoke is approved, and a
separate product decision.

## QB-017A Student Today — Next Best Learning Action MVP (2026-08-24)

- `GET /schools/{schoolId}/student/today` is now a server-authoritative
  `student-today-v1` derived view. It adds no persistence table, accepts no
  client student/session identity, and reads only the authenticated student's
  school-scoped enrollments, published practice deliveries, assessment
  sessions/reports, and real legacy assignments.
- Priority is deterministic: actionable teacher remediation, actionable self
  remediation, active standard session, diagnosis retry candidate, formal
  continue-practice, published Level 1 baseline, then legacy course task.
  Teacher-submitted/processing remediation is shown as waiting for review and
  is never promoted to the primary CTA. The response contains one primary
  action plus safe waiting/secondary/legacy projections.
- `/student/today/` no longer contains demo course state, hardcoded progress,
  fake feedback, or a `/learning/tasks` fallback. Its primary actions call the
  existing remediation/practice creation paths or navigate to the existing
  assessment/remediation Runner; no new runner or scoring path was added.
- OpenAPI and generated contracts document the new route and safe response
  schemas. Decision tests cover the eight required priority/security cases;
  the recursive response audit rejects answer keys, scoring/rubric rules,
  provider evidence, transcripts, and candidate points.
- Browser proof in isolated Compose project `qb017a-release` passed all four
  real states in `tests/e2e/assessment/test_qb017a_student_today.py`: fresh
  baseline, diagnosis-to-remediation Runner, resume of the same attempt, and
  teacher-assigned remediation Runner. The existing release gates also passed:
  six-level Chromium `6 passed`, QB-015F runtime integration `2 passed`, and
  the QB011/QB012/QB013 browser regressions each passed. The isolated runtime
  was torn down after verification.
- Final local checks: API Vitest `104 passed, 7 skipped`; API typecheck;
  contracts `6 passed`; frontend typecheck, test, and build; release runner
  source/API smoke all passed. The pre-existing dirty `pnpm-workspace.yaml`
  remains untouched and unstaged.
- Design principles recorded for pilot validation: Duolingo's mistakes-to-
  targeted-practice loop, Microsoft Reading Coach's difficult-item-to-
  immediate-next-practice handoff, and IXL's diagnostic-to-actionable-next-step
  plan. QB-017A uses these as interaction principles only; it does not copy
  their UI or add recommendation/gamification infrastructure.

## QB-017A-F multi-enrollment & wording pre-pilot fix (2026-08-24)

- Student Today now aggregates every `ACTIVE` `STUDENT` enrollment for the
  authenticated user in the current school. Assessment sessions, class
  deliveries, assignment targets, and legacy progress use the complete stable
  enrollment/class sets; no client enrollment choice, schema migration, or
  first-row authority remains in Today.
- Decision ordering remains deterministic and unchanged: teacher remediation,
  self remediation, standard session, diagnosis retry, continue practice,
  baseline, then legacy task. Teacher remediation in a later class is primary;
  the latest completed formal assessment is selected across enrollments with a
  stable timestamp/session tie-breaker; a baseline delivered only to the later
  class is discoverable.
- Current-school and authenticated-student scope remains enforced. The existing
  Runner attempt read now authorizes the attempt's own ACTIVE student
  enrollment, which lets the second-class CTA open the existing Runner without
  weakening school/student ownership checks.
- Waiting copy is family-neutral: `这项练习正在等待老师复核。`; valid focus
  names remain in titles, while unknown focus values fall back to `专项巩固`.
- Coverage added: 17 focused Today decision/service tests and the isolated
  Chromium proof in `tests/e2e/assessment/test_qb017a_student_today.py` passed
  `2 passed`, including the second-class teacher assignment and existing Runner
  render. The six-level suite was not rerun for this narrow fix.
- Status: `QB-017A DONE / BROWSER VERIFIED / PILOT READY`.
- Next task remains `QB-017B — Pilot learning validation` (`CURRENT_TASK.md` is
  intentionally unchanged and still TODO).

### Known limitations and next task

Legacy Course Assignment tasks remain visible as secondary/reachable course
tasks. The baseline fallback is intentionally limited to an actually published
Level 1 delivery, and speech scoring remains experimental/teacher-review-only
under the existing QB-009A boundary. The next implementation task is
`QB-017B — Pilot learning validation`.

## Protected paths

Do not modify or stage `pnpm-workspace.yaml`, `infra/database/prisma/seed.ts`,
`tests/e2e/assessment/question-bank-runner.spec.py`, or
`frontend/assessment/assets/question-bank/`. Never modify original files under
`local_sources/`.
