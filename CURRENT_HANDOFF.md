# CURRENT HANDOFF

Last updated: 2026-10-21
Repository: `yuzan-workspace-main`

## Owner UAT Level 1/2 assessment content and iFlytek check (2026-10-22)

- The September 8 assessment recovery baseline is commit
  `0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8`; canonical Question Bank
  activation originated in `7b28b19599cb0915629dfa44a0eec5b76ccde524`.
  The active `/assessment/` and `/student/practices/` routes use the API-backed
  practice catalog and runner. The prior UAT database had six seeded
  placeholder practices and no published Level 1/2 Question Bank content.
- Read-only preflight of the owner-provided `习题课程资源` source passed for
  Levels 1 and 2: 20 items / 100 points per level, 20/20 answer bindings, six
  audio and 15 image files per level, zero validation errors or warnings.
  Both levels were applied only to the isolated Owner UAT PostgreSQL database
  and MinIO bucket. Runtime verification found 20 published scored questions
  per level, two published practices with 20 item references each, and 42/42
  referenced media objects matching stored size and SHA-256; all 12 MP3 files
  decoded successfully. No source document or archive was modified.
- The legacy importer now keeps any delivery with an unfinished assessment
  open. Five unused placeholder deliveries were closed. The remaining old
  assignment stays open because it has one in-progress attempt; its data was
  not changed or removed.
- One direct iFlytek ISE request using a Level 2 source dictation sample and no
  student recording returned overall 91.97 with valid dimensions. It remains
  `IFLYTEK_UNCALIBRATED` / `PROVIDER_REQUIRES_REVIEW`; this is not a formal
  score or calibration result. The running UAT Worker still has
  `SPEECH_PROVIDER=disabled`, so live student speech jobs are not routed to
  iFlytek. Credentials and response payloads were not logged or committed.
- Verification: importer safety test 3/3, Question Bank security 2/2, practice
  service 25/25, API typecheck, source preflight, local MinIO checks, API ready
  200, and `/assessment/` plus `/student/practices/` route HTTP 200. An
  authenticated browser playback session remains for Owner sign-in and review.

## Owner UAT courses, tasks, and growth pages (2026-10-22)

- Removed the large banner under the student navigation on `/student/courses/`.
  The catalog now contains five real demonstration courses. The existing
  spring course, its progress, and its blank submissions were preserved; four
  other courses were built from the supplied teaching materials and stored in
  the isolated UAT MinIO bucket. Video object size/hash and byte-range reads
  were verified.
- `/student/assignments/` now reads the current student's real course list,
  exposes status/search filters, and opens the matching course detail. It does
  not use fixed task cards. Growth reads the same current-school course data
  and shows assigned course progress when there are no completed assessment
  records; it does not create completed activities or scores.
- Recommendations and community pages use a shared centered 1480px maximum
  content width with the exercise page, with no iframe scale transform.
- Verification: focused task/growth frontend tests 7/7, changed frontend JS
  syntax checks, API typecheck/build, and `git diff --check`. Page routes and
  API readiness return HTTP 200. Authenticated Owner browser review remains
  outstanding.

## Owner UAT student invitation (2026-10-21)

- Owner UAT branch `uat/owner-platform-preview-20261021` uses the local fictional school/class fixture only. Teacher invitation `TC-43B17-BAD91` belongs to the seeded teacher and `七年级真实流程班`; it is a UAT-wide student class-binding code, currently provisioned for 1,000,000 uses and one year.
- Student registration and student login automatically redeem the default invitation and select its school. The profile invitation field is prefilled for retry/manual use. Binding failures are visible but do not block login. The invitation does not change teacher, volunteer, or administrator roles.
- The development/test seed creates this invitation on a fresh database and reactivates the fixture if it is expired, revoked, or exhausted. No production/default deployment path uses it.
- Verification: frontend tests 199/199; teacher-invitation service tests 11/11; database build and seed syntax check pass. Chromium registration and repeat-login flow both bound the student to the test class, selected the test school, and loaded Student Courses with HTTP 200. `git diff --check` passes.

## Owner UAT T102 September 8 student experience (2026-10-21)

- Adopted the student-page and selected workflow source from T102 checkpoint `f28a1461930642bf33010beeedd67b3d88f28851`, based on exact September 8 commit `0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8`. The Today/Courses/Growth page hierarchy, course catalog/player and student navigation now use the recovered source; the T098 Today/Courses/Growth visual redesign stylesheet/template is not active. The branch history remains intact.
- Kept the Owner UAT invitation binding and the existing Today identity/BFCache protections. Carried T099 partial/all-blank submission behavior and the T102 Growth API/feedback-scope changes. No whole-branch merge or history rewrite was used.
- Frontend suite: 218/218; T102/T099 and page-specific focused frontend tests: 99/99; API typecheck/build and `git diff --check`: PASS. Full API suite: 1,161 passed / 64 skipped / 13 failed; all 13 failures are the known Nest `SpeechJobModule` fixture missing `ConfigService`.
- Native Owner UAT browser: login 200, default student invitation bind 201, select-school 200. Today/Courses/Growth/course detail load with API 200 and no browser/page errors or horizontal overflow. The student course catalog returned 5 courses; Growth returned its real empty state.
- The catalog currently contains no `VIDEO` activities or resource records. The first opened activity is `AUDIO`; its detail page has no video source, so real video playback remains `NOT_RUN`. Opening the first course created one isolated UAT Submission (HTTP 201), retained for Owner testing; no fixture data was cleared.
- Current screenshots: `runtime-local/owner-uat-20261021/evidence/t102-owner-preview/`. T102 remains `READY_TO_MERGE=NO` for release: authenticated video playback and broader native browser/API/database acceptance are not established. The historical full-format and ESLint gaps remain separate.

## YZ-RD-T082 unified student web integration (2026-10-20)

- Integrated T074 Today → T075 Course → T081 Practice (including T076 by ancestry) → T077 Growth on isolated branch `feat/yz-rd-t082-student-web-core-unified-integration`, from exact BASE `d6fbf670bb6997cae0e841d8f9a397f0da785a42`. Four real No-FF merges have exact dual parents; the fourth merge checkpoint is `48cc7587072e28e9c9e9d6f1edea71132ef21849`. No merge conflicts occurred.
- Complete frontend suite passes 190/190 with runtime verification. New T082 Chromium route/navigation smoke passes at 1280×900 and 1440×1000 with visible `TEST_FIXTURE_ONLY` watermarks; API proxy was deliberately unreachable. Native Chrome + NestJS + PostgreSQL E2E is `NOT_RUN` because no isolated PostgreSQL runtime was available; Docker/Compose was not used.
- Changed T082 JS/MJS syntax checks pass. A broader frontend syntax scan finds an unchanged BASE parse error at `frontend/teacher/assessments/create/app.js:86`; this teacher file was not changed. Full API lint was not run or waived. `READY_TO_MERGE=NO`.
- API contract follow-ups: T075 `nextActivity` versus required-practice completion and T081 Practice Attempt GET 200 scope types go to T083; T076 formal QuestionVersion learning authorization goes to the T072 question-bank Owner. The client does not guess these rules. Historical L4 incident remains `OPEN`.
- Full results, merge parents, logs, new screenshots, and safety notes: [`evidence/yz-rd-t082/RESULTS.md`](evidence/yz-rd-t082/RESULTS.md).

## YZ-RD-T081 standalone practice Attempt scope fix (2026-10-20)

- Fixed practice catalog resume selection to require a current school/student identity, matching definition and enrollment, and explicit null `courseSubmissionId` plus `courseActivityId`. Recency ranks eligible standalone Attempts only; course continuation rules are unchanged.
- Baseline regression reproduced the issue before the source edit: 3 failing scope cases and 1 passing standalone-only case. Final T081 regressions pass 6/6, focused practice tests pass 33/33, and the full frontend suite passes 155/155 with runtime verification.
- Native API/PostgreSQL E2E is `NOT_RUN`; no T081-authorized isolated runtime was available and Docker/Compose was not used. The formal QuestionVersion gate remains open. API lint was not rerun; the T076 capsule records 733 inherited unwaived API test-lint findings, so `READY_TO_MERGE=NO`.
- The current `getPracticeAttempt` handler returns the persisted Attempt row with course scope fields, while its OpenAPI 200 response has no schema. Exact API/Contracts documentation request and detailed evidence: [`evidence/yz-rd-t081/RESULTS.md`](evidence/yz-rd-t081/RESULTS.md). Historical L4 incident remains `OPEN`.

## YZ-RD-T068 unified teacher studio mobile UX integration (2026-10-20)

- INTEGRATED / FRONTEND_VERIFIED on independent branch `feat/yz-rd-t068-unified-teacher-studio-mobile-ux-integration`, from exact T064 BASE `5422af364c32c1feffe1e995884f71a4271488d3`. No-FF merge `579b2178e251c1afaac02422f01d98a6869887ef` has T064 as first parent and T067 `e4cf946b107e2fe30b57f7e6200b4ed7f45112d1` as second parent.
- Fresh Node 24.20.0 / pnpm 10.13.1 frontend suite passed 141/141 with runtime verification. Fresh isolated Chromium fixture captures at 390×844, 768×1024, 1280×900 and 1440×1000 passed: native-scale mobile flow, readable text, 44px controls, visible keyboard focus, polite status announcement, and save-before-review ordering. The visual run is `VISUAL_FIXTURE_ONLY`, not a real API E2E.
- T064 course/practice, student Today/course, recording and manual review paths remain intact. No API source, Contracts, score rules, or student route changed relative to BASE. Full API lint was not rerun; T064's 733 API test lint findings remain inherited and unwaived, so `READY_TO_MERGE=NO`. Real API E2E remains assigned to the T065 business acceptance line. No Docker, T005, or Level 4 resources were used; `L4_OPEN=NO`.
- Full evidence and new T068 screenshots: [`evidence/yz-rd-t068/RESULTS.md`](evidence/yz-rd-t068/RESULTS.md).


## YZ-RD-T064 — T063 fourth API test lint slice integration (2026-10-20)

- COMPLETE_WITH_UNWAIVED_LINT_DEBT on independent branch `feat/yz-rd-t064-unified-product-lint-fourth-slice-integration`. No-FF merge `d4e7190b1e5cc2b50e095963ad6dc208b18dd7d4` has exact BASE `d3d2623747eda173aeea71d8bdb2cf52630e98c0` first and T063 `213946cca16adb22acd09ae43ea05c19c31dc4e6` second.
- Unified API lint measured `src 0 / test 733 / total 733`, down from exact-BASE `0 / 916 / 916`; zero warnings/parser errors. Test TypeScript is 230 diagnostics versus 248 at BASE, with zero new identities and 18 removed. Safe targeted API regressions passed 319 with 21 database-gated skips; Contracts passed 6/6.
- Application API, ESLint configuration, frontend, Contracts, and database source are byte-for-byte unchanged from BASE. Curriculum publishing, recordings, manual review, and reporting regressions passed. `READY_TO_MERGE=NO` while 733 test lint findings remain unwaived.
- Node 24.20.0 and pnpm 10.13.1 were used. No T005 or Level 4 source, importer, raw question-bank corpus, Docker, or database runtime was opened or used; `L4_OPEN=NO`.
- Full logs and merge evidence: [`evidence/yz-rd-t064/RESULTS.md`](evidence/yz-rd-t064/RESULTS.md).

## YZ-RD-T067 studio mobile visual verification (2026-10-20)

- Verified accepted T061 BASE `9a1a8b741d0eacfc304dfd72006558848b8bf6e4` on independent branch `feat/yz-rd-t067-studio-mobile-visual-verification`. Fresh Chromium captures cover 390×844, 768×1024, 1280×900 and 1440×1000. The studio uses an unscaled flow layout, stacks through 960px, keeps three desktop panels, and gives rendered controls at least 44px touch height.
- Save Draft, dirty-state announcement, failed-save blocking review, and save-before-review passed with `VISUAL_FIXTURE_ONLY` synthetic data. This was not a real API E2E. Frontend tests passed 141/141; full details are in [`evidence/yz-rd-t067/RESULTS.md`](evidence/yz-rd-t067/RESULTS.md).

## YZ-RD-T063 API test lint fourth slice (2026-10-20)

- `PARTIAL_WITH_DEBT` on `feat/yz-rd-t063-api-test-lint-fourth-slice`, from exact T059 BASE `f147138b570971d44815eebf769215a6ade5a08e`, in an independent worktree. Six unremediated API test files were selected from the T059 remaining-debt snapshot; 183 lint findings were fixed. No API source changed.
- Full API lint changed from 926 errors (1 source / 925 test) to 743 (1 source / 742 test), with zero warnings/parser errors. The sole source finding is unchanged and T049-owned. All six owned files pass targeted ESLint. Safe targeted Vitest passed 143/143 runnable tests; the 21 PostgreSQL integration tests were environment-gated skips.
- Test-project TypeScript changed from 248 to 230 diagnostics, with zero new diagnostic identities. Evidence: [`evidence/yz-rd-t063/RESULTS.md`](evidence/yz-rd-t063/RESULTS.md). `READY_TO_MERGE=NO` while full lint debt remains; `L4_OPEN=OPEN`.
- T051/T055/T059 repaired paths, T053 active `curriculum`/`modules/admin`, T005 `student-courses`, and T060 protected acceptance paths were excluded. No mixed raw question-bank content, `local_sources/`, database runtime, Docker, or L4 path was opened or changed.

## YZ-RD-T062 — T059 third API test lint slice integration (2026-10-20)

- COMPLETE on independent branch `feat/yz-rd-t062-unified-product-lint-third-slice-integration`. No-FF merge `860c740394183e275853b3598ce4cf63655a80b7` has exact T058 BASE `736cb9bdc98866f15be586a7410749182ace0d29` as first parent and T059 `f147138b570971d44815eebf769215a6ade5a08e` as second parent.
- T059's original lint JSON confirms 287 errors removed: `src 1 / test 1,212 / total 1,213` before and `src 1 / test 925 / total 926` after, with zero warnings/parser errors. Corrected the T059 report's inconsistent 901/900 counts to 926 total (925 test + 1 source).
- Unified API lint after integration: `src 0 / test 916 / total 916`, zero warnings/parser errors. Test-project TypeScript remains at 248 diagnostics with zero new identities. T059's eight API tests pass 94/94; 14 existing course/student-course/review/recording/SpeechJob/report tests pass 208/208; Contracts pass 6/6.
- Application, Contracts, database, frontend, and ESLint configuration source remain unchanged from T058 BASE. `READY_TO_MERGE=NO` while 916 test lint errors and the separate T056 owner source gate remain. No raw question-bank source, importer, L4, E2E, Docker, or runtime was used; `L4_OPEN=NO` for this task.
- Target `AGENTS.md` lacks the `AA-DEV-V2.2` marker and this task card supplied no separate Lane policy reference; the root `/home/tian/code/AGENTS.md` baseline and explicit task limits governed. Full evidence: [`evidence/yz-rd-t062/RESULTS.md`](evidence/yz-rd-t062/RESULTS.md).

## YZ-RD-T058 — unified product and test-quality integration (2026-10-20)

- COMPLETE on independent branch `feat/yz-rd-t058-unified-product-test-quality-integration`, based on exact T057 `6f0eaa37daf03ddb7fcbb2f8846688ae1e60cac5`. No-FF merge `ee2bb39e8bf7d1a44cd926f96bdd0f56cfdff22b` has T057 as first parent and T055 `04eda78af4e8230d0b26d054c13f7f6781a2bf20` as second parent. The merge adds only the nine T055 API test repairs and T055 evidence; no app, contract, or ESLint config changes.
- Actual API lint counts with the unified config: `src 0 / test 1,203 / total 1,203` after merge, down from `0 / 1,771 / 1,771`; no warnings or parser errors. Test TypeScript diagnostics fell from 268 to 248, with zero new and 20 resolved. Focused API tests passed 208/208 across 14 files; Contracts passed 6/6.
- T049 course-practice write contract and T057 teaching platform remain intact. `READY_TO_MERGE=NO` because 1,203 API test lint errors remain and T056 still awaits the Owner-approved isolated Level 1 source package. `E2E_NOT_RUN_SAFETY_GATE`; this task ran no E2E, importer, corpus scan, Level 4 read, or runtime flow. No T005 protected path changed.
- Full evidence: [`evidence/yz-rd-t058/RESULTS.md`](evidence/yz-rd-t058/RESULTS.md), including the actual merge graph and zero-conflict inspection.

## YZ-RD-T053 unified course authoring + student/teacher speech loop (2026-10-20)

- COMPLETE on independent branch `feat/yz-rd-t053-course-authoring-unified-student-teacher`, based on T050 `69eff46965b5c0bdd418a490319275aa7acfc4ab`. No-FF merge `3de27d667c65b8f3d9dafb98ce2c53aa001b5162` preserves T049 `0d9dca9765b37c8817c0a2bbebfa918fdbd64494` as second parent; T050 Today/mobile remains first-parent history.
- Two new native cross-role E2Es passed. Teacher created a course and activities in the real studio, bound the formal practice through the T049 API, published the version and opened an authorized class assignment. Student entered from personalized Today, recorded/previewed/uploaded course and assessment audio to MinIO, submitted once, and returned to the same course. Teacher manually listened/replayed and reviewed six items; the same student opened the resulting official report from History.
- Permission/identity assertions cover 401/403/404/409. 390/768/1280/1440 screenshots and page width measurements cover Today, course, practice, studio, assignment, review, and report. API focused 158 passed / 15 environment-gated skipped; frontend 137/137; Contracts 6/6; API typecheck pass.
- Full API lint was run: `src` 1,037 errors / 1 warning, `test` 164 errors, total 1,201 errors / 1 warning (exit 1), no rule suppression or waiver. `READY_TO_MERGE=NO`. Results and raw evidence: [evidence/yz-rd-t053/RESULTS.md](evidence/yz-rd-t053/RESULTS.md). Native owned services are stopped. No Docker/Compose, SQL relation insertion, Worker, fake speech scoring, or shared-branch merge.
- Level 1 importer selected/applied 20 Level 1 items only. Its source preflight reports 120 parsed items before selection, so it scanned the source corpus; no Level 4 row was applied or opened in a browser. This parser-read scope is disclosed in T053 RESULTS. T005 source hashes match before/after; no T005 files were edited.
- Target `AGENTS.md` lacks the AA-DEV-V2.2 marker; root `/home/tian/code/AGENTS.md` governed. `L4_OPEN` remains a source-preflight caveat; see T053 RESULTS.

## YZ-RD-T050 integrated teacher speech review (2026-10-20)

- COMPLETE on independent branch `feat/yz-rd-t050-integrated-teacher-speech-review`, created from formally accepted T047 `598fd18db3ae8d7dc4feaabdd8bc7425c1be6389`. No-FF merge `383f2923e551c239acc9a79d2dc279a7a98485a4` preserves accepted T048 `23ea9e3f550672b7deb36f690c9c0adb436ebe80` as its second parent; branch was pushed and remains unmerged to the shared branch.
- Fresh T050 native Chrome/Web/API/PostgreSQL 17/Redis/MinIO run passed 3/3. It covered personalized Today → opened course activity → simulated-mic recording upload → six-item teacher review → one formal API report → same report from student History. Four WebM/Opus objects were read back from T050's isolated MinIO clone. Physical student microphone audio was NOT_RUN.
- Empty score stayed NULL without a PUT; explicit 0 saved as a legal teacher-reviewed value. Play/pause/replay, expired signed URL refresh, multiline feedback, report-after-final-review gating, 35-row CSV parity, and student/class/school isolation passed. Four viewport widths (390/768/1280/1440) had no horizontal overflow; at 390×844 the first oral title ends at y=817.5. Frontend 137/137 and runtime verification pass.
- Focused affected API tests pass 82/82 across six files. Full API lint remains FAIL at 1201 errors / 1 warning, not waived; `READY_TO_MERGE=NO`. Raw output and final screenshots/proofs: [evidence/yz-rd-t050/RESULTS.md](evidence/yz-rd-t050/RESULTS.md). All task-owned runtime services stopped. No Docker, T005 edits, shared-branch merge, force Git operation, or L4 access; `L4_OPEN=OPEN`.
- Target checkout `AGENTS.md` lacks the AA-DEV-V2.2 marker; no Lane policy path was supplied. Root `/home/tian/code/AGENTS.md` applied.

## YZ-RD-T047 mobile-first unified product integration (2026-10-20)

- COMPLETE on independent branch `feat/yz-rd-t047-mobile-first-unified-product`. No-FF merge `b5a57430d03d8f92b1419c08b871abc19a415d5d` preserves BASE T046 `0f6ea3710797612aa08f37944a9ab9d92f033da1` and accepted T045 `e3a3c544bb990904212f5ad518a6dc46ae68916c` as its exact parents.
- T047 native Chromium/API/PostgreSQL/Redis/MinIO E2E verified the server-backed first oral practice at 390×844: card y=624, title y=813.8–838.8, fully visible; 390/768/1280/1440 have zero horizontal overflow. T045 task rendering, T046 personalized Today, teacher assignment, real speech upload/PROCESSING state, review isolation, six manual reviews and student formal 0/100 + 55/100 reports passed. The first full suite had two legacy-selector failures; the existing integrated route was enabled and both affected cases replayed PASS. Detailed evidence: [evidence/yz-rd-t047/RESULTS.md](evidence/yz-rd-t047/RESULTS.md).
- Frontend 137/137 and runtime verification pass. Full API lint remains FAIL at 1201 errors / 1 warning (exit 1), unchanged from T046/T033 and not waived; `READY_TO_MERGE=NO`. Raw output is in `evidence/yz-rd-t047/api-lint.txt`.
- All T047-owned services exited and ports are free. Data and MinIO objects are retained in the task-owned runtime. No Docker/Compose, Worker, T005 modification, shared-branch merge, or L4 access; `L4_OPEN=OPEN`. Target `AGENTS.md` lacks the V2.2 marker and the card supplied no Lane-policy path; root `/home/tian/code/AGENTS.md` governed.

## YZ-RD-T048 teacher speech review and feedback UX (2026-10-19)

- Verified on isolated branch `feat/yz-rd-t048-teacher-speech-review-feedback-ux`, starting from exact accepted base `0f6ea3710797612aa08f37944a9ab9d92f033da1`; not merged to the shared branch. Existing review queue, manual score/comment contract, API, and formal-report generation were reused without contract or backend changes.
- Native Chromium 153 + NestJS API + PostgreSQL 17.11 + Redis + MinIO E2E passed 1/1, 0 failed / 0 skipped. The teacher opened the authorized Attempt item, saw the actual prompt/rubric, retried a failed recording URL, played/paused/replayed the stored audio, wrote multiline teaching feedback, and saved an explicit 0. Empty input sent no score request; a separate PROCESSING Attempt had no score/report until review. The final required review generated one formal report, which the same student opened from History with feedback line breaks intact.
- Cross-class and cross-school teacher detail access, student review access, other-student report/history access, invalid scores, duplicate save and report gating passed. Four simulated-microphone recordings were uploaded to and read back from the T048-owned MinIO bucket; physical microphone and calibrated automatic scoring remain NOT_RUN. Worker stayed stopped and `SPEECH_PROVIDER=disabled`.
- Frontend suite: 133/133. Database client generation/build, migrations, and API build passed. Full API Vitest and lint were not rerun; inherited T033/T046 lint baseline remains 1201 errors / 1 warning and is not waived, so `READY_TO_MERGE=NO`.
- T048 services exited and ports 4148/4348/55648/6448/59248/59249 are free. Test database, MinIO objects, proof, and screenshots remain under the T048 worktree. No Docker/Compose, shared-branch merge, T005 edit, or L4 access occurred. `L4_OPEN=OPEN`.
- Target checkout `AGENTS.md` lacks the AA-DEV-V2.2 marker; the Task Card supplied no separate Lane policy reference. The user-provided `/home/tian/code/AGENTS.md` safety baseline governed. Full evidence: [`evidence/yz-rd-t048/RESULTS.md`](evidence/yz-rd-t048/RESULTS.md).

## YZ-RD-T049 teacher course practice authoring checkpoint (2026-10-20)

- ACCEPTANCE VERIFIED on independent branch `feat/yz-rd-t049-teacher-course-practice-authoring-contract`, based on exact T040 `cd17360e67356dcdd04062b69b94e253ef5a7468`; not merged. Added teacher practice-option discovery and an optimistic, school-scoped PUT writer for `CourseActivityPractice`. Course-version reads now round-trip the link. The teacher studio replaces its free-text Practice ID with a published-practice selector, writes through the API, and reopens the same link. Existing course-version create/edit/publish APIs remain the course authoring contract.
- Native Chrome 153/API/PostgreSQL 17.11/Redis/MinIO passed 1/1 E2E, 0 failed / 0 skipped. Real teacher UI → writer API → PostgreSQL relation → published class course → student course activity → unified practice Runner → completion/return. 401/403/404/409, repeated link write, repeated Attempt submit, stale/published immutability, one relation row, version 1 and unchanged prior Attempt were verified. Course audio and speech recording/upload retry remained intact; the WebM/Opus object read back from MinIO. The SpeechJob remained CREATED with no result, and the practice Attempt remained PROCESSING without an automatic score/report.
- PASS: frontend 133/133 + runtime verification; curriculum API 55, API contract 38, Contracts 6, OpenAPI validation/type generation, API typecheck/build, E2E/Python/JS syntax and `git diff --check`. Full API lint remains 1201 errors / 1 warning, matching inherited T033 debt and unwaived; `READY_TO_MERGE=NO`.
- All five T049 services exited and owned ports are free. Full evidence: [evidence/yz-rd-t049/RESULTS.md](evidence/yz-rd-t049/RESULTS.md), including native proof, runtime shutdown record and screenshots. No relation SQL insert was used to set up the flow. No schema change, T005 edit, Tibetan subtitle publication, Worker, Docker/Compose, shared-branch merge or L4 access. Target `AGENTS.md` lacks the V2.2 marker and Task Card supplied no Lane policy reference; supplied local safety baseline governed. `L4_OPEN=OPEN`.

## YZ-RD-T040 course-to-speech player checkpoint (2026-10-19)

- ACCEPTANCE VERIFIED on `feat/yz-rd-t040-course-to-speech-player`, starting at accepted T046 SHA `0f6ea3710797612aa08f37944a9ab9d92f033da1`. The Today authorized course link opens Course Detail; the course directory now routes each server-authorized activity into the focused player with the real assignment, Submission, and activity IDs.
- Native Chrome 153/API/PostgreSQL 17.11/Redis/MinIO E2E passed 1/1, 0 failed / 0 skipped. The browser played the checked-in course MP3, recovered a deliberately failed course-progress save, captured a `SIMULATED_MIC` speech take, previewed it before upload, recovered a failed MinIO PUT with the same Recording ID, and verified the Recording, ActivityAttempt, ActivityProgress, and SpeechJob from PostgreSQL/MinIO. A formal course practice Attempt submitted once, synchronized course progress, and returned to the same course Submission.
- The course Recording remained a real WebM/Opus object (32,931 bytes); the linked SpeechJob stayed CREATED with `result=null`, and the formal practice Attempt stayed PROCESSING. No Worker, automatic speech score, transcription, or report was generated. Bilingual renderer gates passed; no Tibetan subtitle or unreviewed translation was published. The 390px speech screenshot has no horizontal overflow or title/progress overlap.
- Frontend 133/133 passed; runtime verification, API build, JS/Python syntax, and `git diff --check` passed. All five T040 services stopped; isolated DB/MinIO data is retained. Full API lint was not rerun; the accepted T046 checkpoint records the inherited T033 baseline at 1201 errors / 1 warning, unwaived, so `READY_TO_MERGE=NO`.
- The generic Question Bank importer is not required for this flow. Its read-only preflight passed, but an exploratory apply encountered `PracticeSection_versionId_fkey`; the final T040 E2E used the task-seeded practice version and checked-in audio instead. No original source was modified.
- The target checkout lacks the AA-DEV-V2.2 marker and the Task Card supplied no Lane policy reference; the user-provided `/home/tian/code/AGENTS.md` baseline governed. No T005 source, shared API contract, schema, shared branch, Worker, Docker/Compose, or L4 access. `L4_OPEN=OPEN`. Full evidence: [evidence/yz-rd-t040/RESULTS.md](evidence/yz-rd-t040/RESULTS.md).

## YZ-RD-T046 integrated student experience checkpoint (2026-10-19)

- Independent integration from accepted T042 + T043 personalized Today + exact T044 `7f9288521a2f4e486ccf2ea2f49e1d78e9ce7865`; T045 is not an ancestor. No-FF commits preserve T043 (`d6e0328522817be08ab496c5b294b8eaae903afc`) and T044 (`7a2ec1fb3ee7e9b4ea39273b86f0580277a3428f`) with their exact parents recorded in `evidence/yz-rd-t046/RESULTS.md`.
- T046 native Chromium 153 + NestJS + PostgreSQL 17.11 + Redis + MinIO passed 5/5 E2Es, 0 failed / 0 skipped. Student Today keeps the authorized server-selected primary action/progress first, omits the four old cards, and starts SYSTEM BASELINE from its Today-issued definition ID. Two teacher-assignment flows reached the same authorized Student Today/Runner path. A teacher reviewed the real assessment flow and the API generated a legal 0/100 report; a separate speech submission stayed PROCESSING with no score/report.
- T044 browser journey retained server-backed MOCK and SPECIALIZED modes and the `requiresRecording=true` filter. It recorded two `SIMULATED_MIC` WebM/Opus takes, read them back from T046 MinIO, recovered an interrupted answer save and upload, then submitted once. Both Today, practice catalog and Runner passed 390/768/1280/1440 with no horizontal overflow; Today primary stayed above the fold. T044's first mobile catalog card starts around y=1017px and requires a short scroll.
- PASS: frontend 133/133, full API tests 1109 passed / 64 environment-gated skips, Contracts 6/6, workspace TypeScript and builds. Full API lint was run and recorded: 1201 errors / 1 warning, matching the inherited T033 baseline; it is not waived, so `READY_TO_MERGE=NO`.
- T046 native services exited and all six owned ports are free. PostgreSQL/MinIO evidence remains in the task-owned runtime. The accepted Question Bank source was read-only and its pre/post hashes match. No Docker/Compose, Worker, T005 modification, shared-branch merge or L4 access; `L4_OPEN=OPEN`. Physical microphone/calibrated speech scoring remain NOT_RUN. Full evidence: [evidence/yz-rd-t046/RESULTS.md](evidence/yz-rd-t046/RESULTS.md).

## YZ-RD-T042 isolated showcase integration (2026-10-19)

- ACCEPTANCE VERIFIED on independent branch `feat/yz-rd-t042-student-showcase-roster-history-integration`, starting at `a676c99f81400b950b3de00f98e83dea05622485`; no shared-branch merge. The existing no-fast-forward T039 + T037 integration graph is preserved.
- A fresh T042-owned Chromium 153/NestJS/PostgreSQL 17.11/Redis/MinIO runtime passed 5/5 cross-module E2Es, 0 failed, 0 skipped. Student login → Today four entries → authorized course, recording practice and Level 1 detail; actual submission remained PROCESSING with no report/score until teacher review, then generated a complete legal 0/100 report. Today → History → continued the exact same persisted Attempt ID. Student A/B/cross-school isolation passed.
- Teacher browser flow verified an authorized 35-student roster, search/filter/sort/detail/return state, 401/403/404 cases, and 3 visible of 35 exporting all 35 rows. CSV rows match the independent PostgreSQL Enrollment query, preserving score 0 separately from NULL.
- PASS: frontend 130/130; full API tests 1109 passed / 64 environment-gated skips; Contracts 6/6; workspace TypeScript and build. Full API lint rerun reports 1201 errors / 1 warning, matching the inherited T033 baseline; `READY_TO_MERGE=NO` pending API-owner resolution or waiver. `@eslint/js@9.39.4` was added as the API lint config's direct development dependency so the command runs in a clean checkout.
- All task users, class rows, course activity, Attempts and recordings are `TEST_FIXTURE_ONLY`; browser recordings use `SIMULATED_MIC`. Physical microphone, calibrated speech scoring, school pilot and production launch are NOT_RUN. The accepted Question Bank source hashes are unchanged. T005's original worktree status hash was unchanged; Worker, Docker/Compose, shared-branch merge and L4 were not used. The T042 services exited and all six owned ports are free.
- Target checkout `AGENTS.md` has no AA-DEV-V2.2 marker and the Task Card supplied no Lane policy reference; the user-provided `/home/tian/code/AGENTS.md` baseline governed. Full evidence: [evidence/yz-rd-t042/RESULTS.md](evidence/yz-rd-t042/RESULTS.md). The final pushed SHA is returned with the task result.

## YZ-RD-T039 rolling integration checkpoint (2026-10-19)

- Own isolated branch integrates accepted T034 and T036 atop T033; preserve both original checkpoint notes below. Native cross-role E2E and full API lint remain unverified on T039 until recorded separately.
- The preexisting T033 full API lint debt (1201 errors/1 warning) is not a waiver, and no shared-branch merge is authorized.

## YZ-RD-T043 personalized Today UX correction (2026-10-19)

- ACCEPTANCE_VERIFIED on independent branch `feat/yz-rd-t043-personalized-today-ux-restoration`, starting from `752a6b9ec42e6903635ea6cc45d757eb5aa592aa`; not merged to the shared branch.
- The personalized server-selected primary task and progress remain first. The equal-weight four-card grid is absent. One optional activity appears only when it is authorized, distinct from the primary/resumed Attempt, and the attempt-to-practice link can be resolved; empty or failed catalogs add no recommendation.
- Final frontend suite: 120 passed / 0 failed / 0 skipped. Native Chromium + NestJS API + PostgreSQL 17.11 + Redis + MinIO E2E: 4 passed / 0 failed / 0 skipped. Evidence includes real login, teacher remediation assignment, dynamic course and activity, authorized `requiresRecording` practice, formal 0-point report and teacher feedback, pending no-score state, isolation, retry, empty/offline behavior, keyboard/ARIA, touch, and 390/768/1280/1440 screenshots with zero horizontal overflow.
- Current screenshots confirm the main card is fully within the first fold at all four heights; the optional discovery is below the overview. A real active assessment resumed after the first attempt; its Level 1 practice is not repeated as the optional suggestion. Full evidence: [evidence/yz-rd-t043/RESULTS.md](evidence/yz-rd-t043/RESULTS.md).
- All runtime identities/content are `TEST_FIXTURE_ONLY`. The accepted Question Bank source was imported read-only; source hashes match. T005 protected source files, T042/T044 and other lanes were not modified or stopped. No Docker/Compose, Worker, shared-branch merge, or L4 access. T043 services exited and all owned ports are free; isolated PostgreSQL/MinIO data remains under `/tmp/yz-rd-t043-runtime`.
- The target checkout `AGENTS.md` has no AA-DEV-V2.2 marker; the user-supplied local safety baseline governed. Full API lint was not rerun; inherited T033 baseline is 1201 errors / 1 warning and is not waived. `READY_TO_MERGE=NO`; `L4_OPEN=OPEN`.

## YZ-RD-T044 practice catalog UX hierarchy correction (2026-10-19)

- COMPLETE / WEB_ONLY / NATIVE_CHROMIUM_API_POSTGRESQL17_REDIS_MINIO_VERIFIED / NOT_MERGED. Branch `feat/yz-rd-t044-practice-catalog-ux-hierarchy`, exact start `ef3e5404ab43561b89b6bf863f5c7f7a250afa27`; Git HEAD is authoritative for the final SHA.
- The three large promotion cards are absent. Original server-backed MOCK/SPECIALIZED tabs remain; the compact oral filter sends the real `requiresRecording=true` catalog request. Chromium confirmed the authorized `停顿与节奏专项训练` flow and checked the small-screen filter layout after overriding the later shared CSS cascade in the T044-owned `practice.css`.
- Frontend 92/92 PASS; native Chrome 153 + API + PostgreSQL 17.11 + Redis + MinIO passed 1/1 with zero skips. Two recordings were auditioned, saved to MinIO, read back, recovered after interrupted upload, then submitted once. The Attempt remains PROCESSING with two CREATED SpeechJobs, no result, zero scored items, and no formal report. No teacher score, fake grade, or automatic score was generated. Auth 401/403/404 and four catalog/Runner viewports passed; `evidence/yz-rd-t044/RESULTS.md` and its screenshots/JSON/logs contain the evidence.
- Follow-up on 2026-10-19: frontend rerun passed 92/92 and the four-width screenshots were visually reviewed. The catalog keeps the oral control near the top, with its first mobile practice card about 174px below an 844px viewport; Runner screenshots also retain faint shared-header context text. A fresh native replay did not reach browser E2E because the isolated API build stalled on local file reads after PostgreSQL identity/migration checks; the task-owned PostgreSQL was stopped through the owner-aware runner and all ports are free. The earlier complete native pass remains the acceptance evidence; this replay is documented as NOT_RUN in `evidence/yz-rd-t044/RESULTS.md`.
- T044 runtime ports were stopped cleanly; isolated database and MinIO objects remain for audit. No Docker/Compose, T005 or other task source edit, shared-branch merge, or L4 access. The target checkout's `AGENTS.md` lacks the AA-DEV-V2.2 marker; the supplied task card and root safety baseline were followed.
- `READY_TO_MERGE=NO`: inherited T033 full API lint debt (1201 errors / 1 warning) remains unresolved. Physical microphone/device, calibrated provider, human-reviewed formal report, pilot, and production launch remain NOT_RUN. L4 remains OPEN.

## YZ-RD-T038 checkpoint (2026-10-19)

- DONE / WEB_ONLY / NATIVE_CHROMIUM_API_POSTGRESQL17_MINIO_VERIFIED / READY_TO_MERGE. Independent branch: `feat/yz-rd-t038-speech-practice-exam-showcase`, exact start `39c01598e687f020037c82c23e3e0cfd7029ba64`; Git HEAD is authoritative for final SHA. The branch is pushed and not merged.
- Student browser proof entered `/student/practices/`, switched the server catalog to `MOCK` and `SPECIALIZED`, followed the oral `requiresRecording=true` entry to the authorized `停顿与节奏专项训练`, opened its real questions, played the sample, previewed two recordings, recovered a failed answer save and signed MinIO PUT, and submitted once. It then proved PROCESSING/no-score/no-report before manual review, the teacher PENDING queue item, and a complete server-generated formal report after an explicit teacher review.
- Native Chrome 153 + API + PostgreSQL 17.11 + Redis + MinIO passed 1/1 with zero skips. MinIO read-back confirmed two 24,446-byte WebM/Opus objects. Unauthorized, cross-school, same-school other-student, microphone-denied, and offline retry cases passed. Catalog and Runner widths 390/768/1280/1440 had no horizontal overflow; keyboard activation, dialog Tab/Escape, and Enter confirmation passed. Frontend suite: 92/92 PASS.
- `SPEECH_PROVIDER=disabled`, Worker stopped, and `SIMULATED_MIC` was explicit; no automatic speech score was generated. The formal zero came from 19 incorrect deterministic fixture choices plus one manual teacher score in dynamic `TEST_FIXTURE_ONLY` data. This is local QA evidence only. Physical microphone/device, calibrated scoring, school pilot and production launch remain NOT_RUN.
- Evidence and exact runtime outcomes are in [`evidence/yz-rd-t038/RESULTS.md`](evidence/yz-rd-t038/RESULTS.md). T038 native services were stopped and all owned ports are free; isolated DB/MinIO evidence is retained. No Docker/Compose, T005 or other task worktree edit, Tibetan subtitle publication, or L4 access occurred. The target checkout lacks the V2.2 marker; the supplied task card and root safety baseline were followed. L4 remains OPEN.
- NEXT: normal branch review/integration decision; schedule physical microphone and pilot gates separately.

## YZ-RD-T037 checkpoint (2026-10-19)

- ACCEPTANCE VERIFIED on independent branch `feat/yz-rd-t037-listen-speak-practice-exam-home`, starting at `724d873a09e195c9e598ffd8d8714e481cebedaf`; no shared-branch merge. Final pushed SHA is in the task return.
- Native Chromium 153 + NestJS API + PostgreSQL 17.11 + Redis + MinIO passed 2/2 E2Es, 0 failures and 0 skips. Student Today showed four dynamic entries; real authorized test Assignment opened Course Detail; recording-practice and Level 1 BASELINE entries opened their actual published PracticeDefinitions. Screenshots at 390/768/1280/1440 have no horizontal overflow.
- The app/API generated a `COMPLETED` `STANDARD` report with 0/100 after authorized teacher review; Today preserved the legal `0 分` and linked to Growth. A separate submitted `PROCESSING` attempt had no report and no score; Today stayed on the history route. Network abort→retry and refresh passed. Same-school other-student and cross-school access to course, practice and report were denied.
- All browser identities, the authored course activity, assignments and recordings are `TEST_FIXTURE_ONLY`. Accepted Question Bank material was imported read-only (120 items, 600 points, 126 media objects, zero validation errors/warnings); source hashes matched before/after. T005's protected main worktree was not modified. Worker, automatic scoring, Docker/Compose and L4 were not used. T037 services exited; all owned ports are free; DB/MinIO evidence remains retained.
- The T037 checkout's `AGENTS.md` has no AA-DEV-V2.2 marker; the user-supplied local safety baseline governed. The 119 frontend tests from the starting checkpoint were not rerun. Full API lint remains the inherited T033 baseline (1201 errors/1 warning); `READY_TO_MERGE=NO` pending API-owner resolution or waiver. Full evidence: [evidence/yz-rd-t037/RESULTS.md](evidence/yz-rd-t037/RESULTS.md).

## YZ-RD-T059 API test lint third slice (2026-10-20)

- `PARTIAL_WITH_DEBT` on `feat/yz-rd-t059-api-test-lint-third-slice`, from exact T055 BASE `04eda78af4e8230d0b26d054c13f7f6781a2bf20`, in an isolated worktree. Eight unremediated test files were cleaned; none overlap T051/T055. T053's active `curriculum` and `modules/admin` test paths were excluded. T058 was checked at its current T057 commit and had no tracked code changes.
- Full API lint changed from 1,213 errors (1 source / 1,212 test) to 926 (1 source / 925 test), with zero warnings and parser errors. The only source finding remains the unchanged T049 `no-empty-object-type` in `curriculum/ports/prisma-course-version.repository.ts`. All eight owned files pass targeted ESLint; API Vitest passed 94/94 with no skips.
- Test-project TypeScript remains at 248 diagnostics with 0 new diagnostic identities. Evidence: [`evidence/yz-rd-t059/RESULTS.md`](evidence/yz-rd-t059/RESULTS.md). `READY_TO_MERGE=NO` while full API lint debt remains; `L4_OPEN=OPEN`.
- No API source, T005, raw mixed question-bank source, `local_sources/`, database runtime, Docker, or L4 path was changed or accessed.

## YZ-RD-T054 API lint slice integration (2026-10-20)

- `PARTIAL_WITH_DEBT` on `feat/yz-rd-t054-api-lint-slices-rolling-integration`, from exact BASE `987e7321157033001b8548e0c0b4318d9f14e503`. Dedicated worktree. T051 `7a0ed80dc94ccd0932cf5026a262db5856b48eea` was merged no-FF first (`a934926c945ddce6a8a4a3465738fa388478a3da`); T052 `1a1706d765cbd5b67c0e2f18ed58a6a84e06b0ec` was merged no-FF second (`2fdf04d48ca1b64b7595ef11e9ee859fabeff93a`).
- Full API lint: 1,781 errors (1 source / 1,780 test), 0 warnings, 0 parser errors; BASE was 1,960 (60 source / 1,900 test). API Vitest 1,109 passed / 64 environment-gated skipped; Contracts 6/6; API source typecheck PASS. Test-project TypeScript baseline 269, final 268, 0 new unique diagnostics. Evidence: [`evidence/yz-rd-t054/RESULTS.md`](evidence/yz-rd-t054/RESULTS.md).
- The only source finding is T049-owned in `curriculum/ports/prisma-course-version.repository.ts`; the file is unchanged from BASE. T054 did not include T049/T053 commits or alter formal course-write logic. Remaining test lint debt is not waived; `READY_TO_MERGE=NO`, `L4_OPEN=OPEN`.
- Target `AGENTS.md` lacks `AA-DEV-V2.2` and the card supplied no separate Lane policy reference. The user-provided local safety baseline and task constraints governed. No L4 or runtime services were accessed.

## YZ-RD-T051 API test lint first slice (2026-10-20)

- PARTIAL_WITH_DEBT on feat/yz-rd-t051-api-test-lint-first-slice, based on exact 987e7321157033001b8548e0c0b4318d9f14e503. The bounded assessment-module slice owns 10 test files and removes 120 findings.
- Full API lint changed from 1,960 errors / 0 warnings to 1,840 errors / 0 warnings. Exact after counts: 60 source errors, 1,780 test errors, 0 parser errors. All 10 selected files now pass targeted ESLint; no rule was disabled and no any annotation was added.
- Selected tests: 20 passed, 0 failed, 7 database-gated skips. Full raw lint, targeted lint and test logs are in evidence/yz-rd-t051/RESULTS.md. READY_TO_MERGE=NO; L4_OPEN=OPEN.
- The checkout AGENTS.md has no AA-DEV-V2.2 marker and the task card supplied no Lane policy reference. The user-provided /home/tian/code/AGENTS.md safety baseline governed. No API source, database service or L4 runtime was accessed.

## YZ-RD-T052 API source lint remainder (2026-10-20)

- `PARTIAL_WITH_DEBT` on `feat/yz-rd-t052-api-source-lint-remaining-60`, based on exact `987e7321157033001b8548e0c0b4318d9f14e503`. Independent worktree; the dirty shared checkout was not edited.
- Full API lint moved from 1,960 errors (60 source / 1,900 test) to 1,901 (1 source / 1,900 test), with zero warnings. Fifty-nine source findings were fixed. The sole remaining source finding is in `curriculum/ports/prisma-course-version.repository.ts`, which T049 is actively editing; T052 has zero changed-path overlap with T049.
- PASS: API source typecheck; API Vitest 1,109 passed / 64 environment-gated skips; `git diff --check`. Test-project typecheck retains the same 269 baseline diagnostics with no new errors. Full evidence: [`evidence/yz-rd-t052/RESULTS.md`](evidence/yz-rd-t052/RESULTS.md).
- `READY_TO_MERGE=NO`; the 1,900 test lint findings and T049-owned source finding remain. `L4_OPEN=OPEN`. Target checkout has no `AA-DEV-V2.2` marker and the card supplied no Lane policy reference; user-provided safety baseline governed. No runtime or L4 access.

## YZ-RD-T041 API lint debt slice (2026-10-20)

- `PARTIAL_WITH_DEBT` on `feat/yz-rd-t041-api-lint-debt-first-slice`, based on exact `b3a731bb32f404f4a55f4d4f56d265514d324d40`. The T046 baseline was verified at `0f6ea3710797612aa08f37944a9ab9d92f033da1`: full API lint 1,201 errors / 1 warning (1,037 source findings plus 164 test TypeScript project-service parsing errors).
- T041 fixes TypeScript project membership for API tests and the separate `.mjs` default-project case, declares `@eslint/js@9.39.4`, types assessment/practice queries with Prisma payloads, validates Prisma JSON boundaries, and removes a broad group of unused/unsafe source findings. Final full lint is 1,960 errors / 0 warnings with no parser errors: 60 source errors and 1,900 now-visible test errors. The overall count is higher because typed lint exposed test debt; it is not waived.
- PASS: API typecheck; API Vitest 1,109 passed / 64 environment-gated skipped; Contracts 6/6. Full evidence and raw logs are in [`evidence/yz-rd-t041/RESULTS.md`](evidence/yz-rd-t041/RESULTS.md). `READY_TO_MERGE=NO`; `L4_OPEN=OPEN`.
- Target checkout `AGENTS.md` lacks the `AA-DEV-V2.2` marker, and the task card supplied no Lane policy reference. The user-provided `/home/tian/code/AGENTS.md` baseline governed. No L4/runtime services were accessed.

## YZ-RD-T033 checkpoint (2026-10-19)

- ACCEPTANCE VERIFIED on feat/yz-rd-t033-multirole-web-rolling-integration. Starting accepted HEAD was 38d36c7255568a5bcc7af3200ce2b23b9de758bc. Three first-parent no-fast-forward merges preserve T029→T030→T031→T032; exact parents and merge bases are in [evidence/yz-rd-t033/RESULTS.md](evidence/yz-rd-t033/RESULTS.md).
- One isolated native T033 Chromium/NestJS/PostgreSQL 17/MinIO runtime passed four cross-role E2Es with 0 failures and 0 skips: teacher invitation→student join→revoke→live roster; authorized roster CSV; Growth→formal report→15-item Remediation Runner; course activity→Runner submit 201→course completion 201→single course return.
- API contract audit corrected two OpenAPI/generated-type mismatches against observed runtime: assessment-session submit returns 201, and class student summaries return an unpaginated array. Contracts 6/6, frontend 115/115, API 1109 passed/64 environment-gated skips, workspace typechecks/builds, and Prisma validation pass.
- Full API lint still reports 1201 errors/1 warning, identical to the prior T029 baseline. No backend/api files changed after T029; the invitation controller/service targeted lint passes. READY_TO_MERGE remains NO until the API owner resolves or explicitly waives that baseline.
- T033 services exited and all six T033 ports are free; database and MinIO objects are retained. No Docker/Compose, Worker, shared-branch merge, T005 worktree change, other task runtime, or L4 access. The target checkout has no V2.2 marker; the supplied task/safety instructions were followed.
- The branch was committed and pushed without rewriting history; the final SHA is in the task return.

## YZ-RD-T026 checkpoint (2026-10-19)

- DONE / WEB_ONLY / NATIVE_CHROMIUM_API_POSTGRESQL_MINIO_VERIFIED / READY_TO_MERGE on `feat/yz-rd-t026-onboarding-rolling-web`; not merged to shared `feat/question-bank-v1`.
- Exact T024 `ea1a048966d3eb5e17d9ba1c24d565e4616499de`, T021 `6445dca34c19fea89c885a3e4085cf47f9d7e5ed`, and T023 `34af873837c9cfb74a7be33e94617b94668b4f4d` are preserved by two no-fast-forward merges. True bases are T015 `4475f418078e5800678a55b05d418d216962732e` and T020 `e6b8e8aa0b2f8cfe9a3bed894f264c73f64e1f3c`; zero changed-path overlaps/conflicts.
- Native T026 Chromium/API/PostgreSQL 17/MinIO: 1 passed, 0 failed, 0 skipped. Teacher Class Detail → server invite → clipboard copy/paste → Student Profile bind → PostgreSQL Membership/Enrollment/AuditLog/usedCount → refreshed roster/detail → Student Today is evidenced with dynamic IDs and SQL. Separate T021 Profile verification covers two schools/three classes, retry recovery, and cross-identity isolation.
- Final suite results, screenshots at 390/768/1280/1440, SQL, API/FE/contract checks, native PIDs/ports, sibling noninterference and known NOT_RUN items are in [`evidence/yz-rd-t026/RESULTS.md`](evidence/yz-rd-t026/RESULTS.md). T026's six ports were stopped; database/MinIO/evidence remain. No Docker/Compose/P1-SIM; L4 remains OPEN.
- The T005 `feat/question-bank-v1` worktree and original course resource/root environment, plus T022/T025/T027 and all sibling worktrees, were not edited or stopped. Continue integration only from this pushed T026 branch under Commander ownership; do not merge it directly into the dirty shared branch.

## YZ-RD-T024 checkpoint (2026-10-19)

- DONE / WEB_ONLY / NATIVE_CHROMIUM_API_POSTGRESQL_MINIO_VERIFIED / READY_TO_MERGE. Isolated branch `feat/yz-rd-t024-teacher-student-rolling-web`; no merge into shared `feat/question-bank-v1`. Merge commit `ce709b4539ae0502e4f1a7de216a8d7ba66adb0f` joins T019 `1ebc1923d44dcf238f3441552b7eda946b6c0b44` and T020 `e6b8e8aa0b2f8cfe9a3bed894f264c73f64e1f3c`; T020 already contains T018 `73bb949b22f38b66f92edaa741aa042e504d2d7f`. Merge base is T014 `0596a9b8256c1d674b93eb2afd4de7306c768129`; changed-file counts 201/45 with zero overlap and no conflicts. T014/T018 were not re-integrated.
- The task was routed to one dedicated worktree at `/home/tian/code/yuzan-workspace-t024` from the exact T019 accepted SHA. Published Notion YZ-RD-T024 and the V5.9 historical/current V5.10 lane rules were read before work.
- Final same-environment Chromium + NestJS + PostgreSQL 17 + MinIO run: 9 passed, 0 failed, 0 skipped. Teacher Home Submission and Assessment Review queue counts remain separate; dynamic Assignment/Submission/Review IDs and SQL are recorded in [`evidence/yz-rd-t024/RESULTS.md`](evidence/yz-rd-t024/RESULTS.md). A/B targeted OPEN course Assignment excludes C; Today/course progress and 20-item practice flow are exercised. Six manual Review Items are required before the server creates the AssessmentReport; the student sees saved comments in History and Growth.
- T024 owns `yuzan_t024_native` / `yz_t024`, bucket `yz-t024-native`, ports 55674/6474/59274–59275/4134/4334. Fresh DB applied 32 migrations; read-only import found 120 Question Bank items and 126 assets. Worker and automatic speech scoring stayed disabled. All microphone evidence is `SIMULATED_MIC`. T024 process exit is verified, its database/objects are retained, no Docker/Compose/P1-SIM was used, and L4 remains OPEN.
- Final checks: frontend 67/67; API 1101 passed / 64 environment-gated skips; Contracts 6/6; Prisma, OpenAPI generation, typechecks and builds PASS; native E2E 9/9, 0 skipped. Browser screenshots cover 390/768/1280/1440. The 390px Teacher Home action now flows below the greeting.
- T005's original 20 dirty paths, root `.env`, and resource directory were not modified or staged. T019/T020 source checkouts remain clean and unchanged. T021/T022/T023 remained outside the T024 diff; T022/T023 progressed on their own branches and their own handoffs record their service exits. Exact final pushed branch SHA is returned with this task result.
- Next: future owner-led integration of T005 bilingual course work and the T021/T022/T023 branches; physical microphone, calibrated scoring, pilot and production launch remain NOT_RUN.## YZ-RD-T036 checkpoint (2026-10-19)

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

## YZ-RD-T098 student learning visual redesign (2026-10-21)

- Implemented in isolated worktree `/home/tian/.devspace/worktrees/yuzan-workspace-t098`, branch `feat/yz-rd-t098-student-learning-visual-redesign`, from exact BASE `03371f7287433dac7f09c99ff95729fb4c071652`. Product writes are limited to Today/Courses/Growth HTML and their three page stylesheets; this is the only appended T098 checkpoint.
- Today now uses an ink/indigo primary action, decorative sound contours, a vertical state rail, and distinct result/pending/course/history treatments. Courses has a 164px desktop/tablet and 172px phone masthead, existing covers in an editorial grid, and retained controls. Growth gives the persisted chart first visual position, varied metric hierarchy, a stronger chronology, and distinct feedback/remediation accents. No business JS, API/data, route, course-detail, media, progress persistence, shared navigation, asset, dependency, backend, contract, or protected T005 source changed.
- Full existing frontend command: 199 PASS / 0 FAIL / 0 SKIP, business-JS syntax gate 100 files PASS, runtime verifier PASS. Focused course adapter/player/media tests: 19 PASS / 0 FAIL / 0 SKIP. Target syntax and `git diff --check` PASS. Owned-path guard verifies unchanged business JS and one append-only handoff checkpoint.
- New before/after screenshots cover all three pages at 390×844, 768×1024, 1280×900 and 1440×1000. `VISUAL_FIXTURE_ONLY` synthetic responses drive unchanged production renderers; fixture browser checks preserve rendered routes/covers, all 13 returned course destinations through load-more, grid/list/search/filter/sort/favorite behavior, formal zero vs null, keyboard focus, reduced motion, and zero horizontal overflow. Review gallery and raw logs: `evidence/yz-rd-t098/review.html` and `evidence/yz-rd-t098/RESULTS.md`.
- Native authenticated browser/API/PostgreSQL/MinIO E2E = NOT_RUN; no services or imports started. No shared UAT/main merge. `READY_TO_MERGE=NO` pending Owner screenshot approval. `HISTORICAL_L4_INCIDENT_OPEN=YES`; no L4 source/import/runtime work occurred. This task does not waive inherited integration/quality gates.

## Owner UAT Today page stylesheet compatibility (2026-10-22)

- Fixed the restored T102 Today page stylesheet to support the current server-driven Today renderer. Inline SVGs now have bounded sizes, the header school/eyebrow rows stay compact, and the live overview/content sections use responsive card grids in the T102 red/gold palette. No Today data, API, route, or action logic changed.
- Visual-only Chromium capture with synthetic data passed at 1440×1000 and 390×844: no horizontal overflow, icons stayed within 30px, desktop header was 214px, and the primary card returned from 651px to its 330px minimum. This is not authenticated API E2E.
- Focused Today logic tests: 3 passed. The `pnpm` invocation aborted before touching `node_modules` because it required an interactive modules purge confirmation; the same test file passed with the repository's existing Node 24 runtime.
