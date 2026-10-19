# YZ-RD-T037｜听·说·练·测特色首页｜真实浏览器与数据库验收

## Return fields

| Field | Result |
|---|---|
| TASK_ID | YZ-RD-T037 |
| STATUS | ACCEPTANCE_VERIFIED / independent branch pushed; not merged |
| BRANCH | `feat/yz-rd-t037-listen-speak-practice-exam-home` |
| START_SHA | `724d873a09e195c9e598ffd8d8714e481cebedaf` |
| FINAL_SHA | Reported in the task return; this evidence commit does not self-reference its SHA. |
| REAL_COURSE_CLICK | PASS — authorized OPEN Assignment `e3b1da77-d6fe-4401-b005-fbec5a426b83` loaded Course Detail and its database-backed lesson/activity. |
| REAL_RECORDING_PRACTICE | PASS — authorized recording definition `fc3e1ecd-84e4-4efd-87ce-0ec4017fea89`, `requiresRecording=true`, detail API 200 and browser route loaded. |
| ASSESSMENT_ENTRY | PASS — Today `BASELINE` linked to authorized Level 1 definition `e5344e01-13d9-41ca-b3c1-52a4f8d1c16e`; detail API 200 and browser route loaded. |
| FORMAL_REPORT | PASS — generated `COMPLETED` / `STANDARD` report `c3d0fd07-d696-44e7-8850-8df02ac696b2`, score `0`; Today preserved zero and Growth showed the same report. |
| CHROMIUM_API_PG_E2E | PASS — 2 passed / 0 failed / 0 skipped on native Chromium 153, NestJS API and PostgreSQL 17.11, with Redis and MinIO. |
| FOUR_VIEWPORTS | PASS — 390 / 768 / 1280 / 1440 px; no horizontal overflow. Nine route and viewport screenshots are committed. |
| PASS_FAIL_SKIP_NOTRUN | Final native E2E: 2 / 0 / 0. Frontend: 119 / 0 / 0 from the accepted starting checkpoint, not rerun per task instructions. Full API suite/lint: NOT_RUN. Live speech scoring, physical microphone and pilot: NOT_RUN. |
| READY_TO_MERGE | NO — inherited T033 full API lint baseline remains unresolved (1201 errors / 1 warning); needs API-owner resolution or waiver. T037 adds no backend/API changes. |
| L4_OPEN | OPEN / untouched. |

## Runtime and source boundary

The final run used its own native runtime: database `yuzan_t037_native`, role `yz_t037`, bucket `yz-t037-native`, PostgreSQL 17.11, API port 4187, Web port 4387, Redis port 6487, and MinIO ports 59487–59488. Chromium was Google Chrome 153.0.8010.52, Node 24.20.0, pnpm 10.13.1. The Worker and automatic speech scorer were not started. Docker and Compose were not used.

The Question Bank was imported from the accepted source files at `/home/tian/code/yuzan-workspace-main/习题课程资源`. Preflight: 120 items, 600 points, 120/120 answer bindings, 126 media files, 0 errors and 0 warnings. SHA-256 and before/after immutability proof are in [`question-bank-source-proof.json`](question-bank-source-proof.json); the original source remained unchanged.

All test accounts, the test course/activity, assignments and recordings are explicitly `TEST_FIXTURE_ONLY`. These are isolated integration fixtures; they do not represent real school/pilot student records. The imported Question Bank source is the accepted authored content. Chromium recording used a fake device (`SIMULATED_MIC`); no physical microphone or speech-scoring result is claimed.

## Acceptance evidence

- **Student login and four entries:** the browser logged in through the student login form, confirmed the active school, and rendered all four dynamic Today cards from API responses.
- **Course:** Today used the OPEN Assignment ID returned by the authorized course list. The click reached `/student/courses/course-detail/?id=e3b1da77-d6fe-4401-b005-fbec5a426b83`; the detail API returned 200 and the page rendered the authorized CourseVersion and its linked test lesson/activity.
- **Recording practice:** the “说” card selected a catalog result with `requiresRecording=true`, used its live definition ID, then rendered that definition from the browser route and API.
- **Assessment:** for a student with no prior report, the authorized Level 1 `BASELINE` action supplied the definition ID used by the “测” card. The click opened that definition. A second real 20-item attempt was submitted through the Runner and remained `PROCESSING` while the Worker was disabled.
- **Formal result and zero:** the existing application path submitted the assessment, received six teacher reviews through authorized APIs, and generated the formal report. PostgreSQL confirmed 20/20 item scores were 0, `AssessmentSession` was `COMPLETED` / `STANDARD`, and `AssessmentReport.overallScore` was 0. The Today card displayed `0 分`; its link opened Growth, which displayed the same report with 0 points.
- **Empty score and pending review:** before review, the submitted assessment had no `AssessmentReport`. A separate fresh student’s submitted attempt was `PROCESSING`, report count 0 and `latestFormalAssessment=null`. Today showed the history route and did not display `0 分` or treat the missing report as a score.
- **Identity isolation:** another student in the same school received 404 for the course and practice and 403 for the report. A cross-school student received 403 for all three. The existing report-flow negatives also returned 403 for same-school and cross-school report access.
- **Network failure, retry and refresh:** the first Today API request was aborted once; the page showed the network error and retry control. Retry rendered all four cards. Refresh retained the pending state and absent formal report.
- **Responsive screenshots:** 390, 768, 1280 and 1440 px had zero horizontal overflow. Browser console page errors: 0.

Detailed database IDs, API statuses, response states and viewport metrics are in [`report-state-proof.json`](report-state-proof.json) and [`today-showcase-proof.json`](today-showcase-proof.json). The final browser log is [`native-e2e.log`](native-e2e.log). Screenshots:

- Today at [390 px](screenshots/today-showcase-390.png), [768 px](screenshots/today-showcase-768.png), [1280 px](screenshots/today-showcase-1280.png), and [1440 px](screenshots/today-showcase-1440.png)
- [Authorized Course Detail](screenshots/authorized-course-detail-1440.png), [recording practice](screenshots/recording-practice-definition-1440.png), and [assessment definition](screenshots/authorized-assessment-definition-1440.png)
- Today with a [legal zero score](screenshots/today-formal-zero-score-1440.png) and [pending result without a score](screenshots/today-pending-no-score-1280.png)

## Verification limits and repository boundaries

`frontend/tests/assessment/*.test.mjs` had 119 passing tests at the supplied checkpoint; this task did not rerun them. The final native Chromium/API/PostgreSQL run passed 2/2. The full API suite and lint were not rerun. The inherited T033 full API lint baseline is 1201 errors / 1 warning and remains the merge-readiness blocker; T037 has no backend/API source changes.

Physical microphone, live speech provider, calibrated scoring, school pilot, production data, and production launch were NOT_RUN. The target checkout `AGENTS.md` does not contain the AA-DEV-V2.2 marker; the user-supplied local safety baseline governed this work. The T005 protected main worktree was not modified; imported files were read-only and their hashes matched before and after. No shared branch merge, Docker/Compose, Worker, or L4 access occurred. T037 native services have exited and all owned ports are free; the isolated DB, MinIO objects and evidence are retained.
