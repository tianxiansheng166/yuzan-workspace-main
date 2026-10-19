# YZ-RD-T025 Results

**Status:** DONE — student Growth report-to-remediation flow verified with the native stack. The T013 Growth unit fixture mismatch is recorded under verification and keeps this branch from being marked merge-ready.

## Source and branch

- Repository: `/home/tian/code/yuzan-workspace-main`
- Exact accepted T019 base: `feat/yz-rd-t019-web-rolling-integrated` @ `1ebc1923d44dcf238f3441552b7eda946b6c0b44`
- T025 branch: `feat/yz-rd-t025-student-growth-feedback-action`
- T025 worktree: `/home/tian/code/yuzan-workspace-t025`
- Exact final branch commit/push SHA is returned in the task completion message. A Git commit cannot embed its own object ID in the same commit tree; the source/base SHA and all final database/session/report evidence are recorded here.
- Shared merge readiness: **NOT READY** until the T013 Growth unit mocks are updated by their owning test scope to represent a completed, enrolled source Session and fully linked Report. The real T013 native E2E passes; T025 is not merged.
- T019 checkout remained clean at the accepted base. The shared `feat/question-bank-v1` checkout’s pre-existing T005 bilingual changes and course resources were not edited or staged. The Question Bank source directory was read only.
- The target checkout has no V2.2 marker in its AGENTS.md. The task card’s V2.2 contract and its narrower frozen scope were followed.

## Delivered

- Growth now shows a formal score only after the server returns a matching `AssessmentSession` and `AssessmentReport` in the active school and enrollment, a `COMPLETED` source session with a completion time, a generated report with 100% completeness, and a finite score from 0 through 100. A formal score of `0` remains distinct from a null or absent score.
- Formal assessment comments render under **正式测评教师评语 · 人工复核**, with real `reviewedAt` times and AssessmentReport/AssessmentSession references. Internal reviewer IDs, rubrics, answer keys and scoring rules are not rendered.
- Released course-task feedback renders separately under **课程任务教师反馈**, labeled as a published Submission feedback event with its Feedback ID and release time. It is not linked to an assessment report or an assessment item.
- Report retry candidates are labeled as content from that report. The page explicitly says they are not linked to a particular open practice. Current open practices remain a separate server-provided list with service `practiceDefinitionId`s; active and processing Attempts use their current server IDs.
- The formal report action calls the existing student remediation API. After a `201`, Growth reads the returned ID through `getAssessmentSession()` and verifies school, enrollment, purpose and `retestOfSessionId` before opening `/student/practices/attempts/{attemptId}/runner/`, `/processing/`, or the completed result route.
- No Idempotency-Key is present in the existing remediation API. Its server transaction lock resumes a matching active remediation; it is not a universal idempotency guarantee for terminal sessions. Growth checks the enrollment-scoped session list before posting, prevents repeat clicks, and stores an outcome-pending marker before the POST. If the browser loses the response, it performs GET recovery and never automatically repeats the POST. If pending state cannot be stored, it does not send the POST.
- If no recovery record can be confirmed, Growth says **创建状态待核实** and offers GET-only verification. Known 401/403/404/409 errors display failure state; no failure path claims a session was created.

## Native business proof

The last native run used Node `v24.20.0`, pnpm `10.13.1`, PostgreSQL `17.11`, Redis `7.4.10`, MinIO `RELEASE.2025-10-15`, Google Chrome `153.0.8010.52`, and Playwright `1.64.0`. It used the isolated database/user `yuzan_t025_native` / `yz_t025`, bucket `yz-t025-native`, and T025-only ports: PostgreSQL `55650`, Redis `6450`, MinIO `59224–59225`, API `4125`, Web `4325`. The Worker was not started.

- Question Bank import validated 120 items, 120 scoring bindings and 126 media objects, then populated T025’s database and bucket from the protected source directory in read-only mode.
- Student A’s real 20-item practice used the existing Runner. Four simulated-microphone recordings were stored in MinIO and read back with positive byte lengths. Teacher A then saved six manual AssessmentItem reviews through the authorized review API. PostgreSQL ended with a completed standard `AssessmentSession`, a complete `AssessmentReport`, and six comments tied to reviewed items.
- Final formal report: `376579c3-e1ea-4393-b416-59ef134f30b6`, score `55`, completeness `100`. Source session: `b695f157-03b0-4af4-8c0b-724e5d6fdda0`. Student A is `143ec4cf-8caf-4f74-b8ce-5f66d6a5c586`; Student B is `205cf84c-d106-4651-ac22-c556037cc479` in another class of the same school; cross-school Student C is `04aaa552-482c-41eb-84b7-a573bbf43992`. Teacher A is the fictional seeded teacher `33333333-3333-4333-8333-333333333333`. Source `schoolId`, `enrollmentId`, `classId`, purpose, status and completion time are in [`native-evidence.json`](native-e2e/native-evidence.json).
- A separate real Assignment `04f9e33e-9744-4a4a-b47e-cbfe89e65c8c` and Student Submission `bb9f22e4-4561-4c73-851c-a4745fa67186` produced course-task Feedback `ac79fc36-953b-40e5-84c7-c5e89b729708` through the teacher Feedback API. PostgreSQL confirms its Feedback→Submission→Assignment relation and the student enrollment. The isolated fixture advanced the Submission to `NEEDS_REVIEW` in SQL because this slice did not start a course speech worker; the Feedback itself was created and released by the authorized API. The UI displays it only as course-task feedback.
- The browser intercepted a real remediation POST after forwarding it to NestJS, then dropped the response. NestJS returned `201 CREATED` and committed session `ac9856fd-d307-4dff-b5c5-99fe12531043`; Growth recovered it with the enrollment-scoped session-list and session-detail GETs. There was exactly one browser POST and exactly one `REMEDIATION` session linked to source session `b695f157-03b0-4af4-8c0b-724e5d6fdda0` for Student A’s enrollment. PostgreSQL confirms matching school, enrollment, class, initiator, practice/version/delivery and the 15 exact report retry question versions.
- Student A completed all 15 remediation items and submitted once. The server’s real result state was `PROCESSING` with six items awaiting review; Growth displayed **查看处理状态** using the returned remediation ID. This remediation has no formal `AssessmentReport`. Four source and four remediation recording objects were read back from MinIO.
- API negatives passed: unauthenticated `401`, same-school Student B report/history/remediation POST denied (`403`), cross-school Student C report denied (`403`), missing report `404`, and ineligible remediation creation `409` with zero remediation rows.
- Chromium also verified A→B account switching and A→unauthorized-school switching clear the prior student’s name, report and comments.
- The native T013 Growth E2E passed: `1 passed / 0 skipped` against this isolated T025 stack.

Detailed SQL rows, report feedback, Assignment/Submission/Feedback IDs, remediation response, MinIO object keys, negative statuses and identities are in [`native-evidence.json`](native-e2e/native-evidence.json). The browser logs are in [`native-e2e.log`](native-e2e.log).

## Visual and interaction evidence

Chromium screenshots are saved at 390, 768, 1280 and 1440 pixels. All four widths passed `documentElement.scrollWidth <= viewport`; source and remediation screens retained the paper cards, cream/green palette, mountain/plant artwork and report-to-action path. Keyboard activation and source-details toggling passed. `prefers-reduced-motion: reduce` was active and confirmed.

- [Growth at 390px](native-e2e/growth-formal-390.png)
- [Growth at 768px](native-e2e/growth-formal-768.png)
- [Growth at 1280px](native-e2e/growth-formal-1280.png)
- [Growth at 1440px](native-e2e/growth-formal-1440.png)
- [Growth after remediation submit](native-e2e/growth-remediation-processing-1440.png)

The one-result state shows no trend chart because fewer than three formal results exist. Open practices and report retry candidates remain visually separate.

## Verification matrix

| Check | Result |
|---|---|
| T025 frontend unit tests | PASS — 15 passed, 0 failed, 0 skipped. [`t025-frontend-unit.log`](t025-frontend-unit.log) |
| Existing T013 Growth unit test | FAIL — 10 passed, 3 failed, 0 skipped. Its report fixtures return an `IN_PROGRESS` session and omit the session/report school and enrollment link fields. The new page correctly suppresses official score/feedback/action for those incomplete or mismatched records. The T013 test file was outside T025’s authorized modification scope. [`t013-growth-unit.log`](t013-growth-unit.log) |
| T025 native Chromium/API/PostgreSQL/MinIO E2E | PASS — 1 passed, 0 skipped. [`native-e2e.log`](native-e2e.log) |
| T013 native Chromium/API/PostgreSQL E2E | PASS — 1 passed, 0 skipped. [`t013-native-regression.log`](t013-native-regression.log) |
| API regression | PASS — full API suite: 1,101 passed, 64 environment-gated skips, 0 failed. [`api-targeted-regression.log`](api-targeted-regression.log) |
| Frontend Runtime | PASS — `frontend/scripts/verify-runtime.mjs`. [`frontend-runtime.log`](frontend-runtime.log) |
| OpenAPI/contract read-only validation | PASS — Redocly lint; no contract files changed. [`contracts-readonly.log`](contracts-readonly.log) |
| Node and Python syntax checks | PASS — Node 24 `--check`; Python `py_compile` for both T025 E2E scripts. |
| Keyboard, ARIA and reduced motion | PASS — native browser; focusable buttons/source `<details>`, keyboard Enter, live status semantics, reduced-motion query. |
| Responsive overflow | PASS — 390, 768, 1280, 1440 |
| `git diff --check` | PASS |
| Physical microphone, school pilot, production | NOT_RUN — browser capture used `SIMULATED_MIC`; no worker/provider or production system was started. |

`API_REQUEST: NONE` and `ROUTE_REQUEST: NONE`. The existing POST returns the authoritative remediation Session, while the authorized session-list/detail GETs safely recover unknown outcomes without claiming a universal idempotency key. The native E2E runner log is [`native-e2e.log`](native-e2e.log); its final serialized evidence is [`native-evidence.json`](native-e2e/native-evidence.json).

## Scope, isolation and handoff

- Only the two authorized Growth assets, T025 frontend/native tests, screenshots and `evidence/yz-rd-t025/` were changed in the T025 worktree. No backend, API client, OpenAPI, generated types, Prisma, shared navigation, T021/T022/T023/T024 pages or T005 resources were changed.
- The T005 shared worktree still contains its original uncommitted bilingual course work; the root `.env` and course resources were not modified or staged. T019, T022, T023 and T024 worktrees remain untouched.
- T025 services were stopped by the ownership-aware runtime manager. The first stop attempt observed processes awaiting reaping; the follow-up cleared all T025 process records. Final stop result is PASS and all six T025 ports are free. The T025 database and MinIO data remain for audit. [`runtime-exit.json`](runtime-exit.json)
- No Docker, Compose, P1-SIM or L4 volume action was used. The L4 historical PostgreSQL Docker-volume incident remains OPEN and untouched.
- T025 is not merged into `feat/question-bank-v1`. The T013 unit fixture mismatch should be corrected in its owning test scope before shared integration; it does not affect the real T013 browser E2E or the T025 native flow.
