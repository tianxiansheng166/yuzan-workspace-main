# YZ-RD-T030 Results

**Status:** DONE / WEB_ONLY / NATIVE_CHROME_API_POSTGRESQL_MINIO_VERIFIED / READY_TO_MERGE
**Base:** `feat/yz-rd-t025-student-growth-feedback-action` @ `c085ac2f15df90ddfdf0ccde7600e53aa31e860f`
**Branch:** `feat/yz-rd-t030-growth-formal-report-regression`
**Merge state:** not merged into `feat/question-bank-v1`; final branch push is verified in the task return.

The T025 checkout's `AGENTS.md` has no V2.2 marker. I followed the task card's frozen file and runtime scope. No production Growth JavaScript or CSS changed: the confirmed defect was that T013's legacy unit fixtures modeled an in-progress Session with no school/enrollment or completed time and Reports with no server linkage fields. Production correctly hid those records.

## T013 fixture repair

The preserved base run was **10 PASS / 3 FAIL / 0 SKIP** in [`t013-before.log`](t013-before.log). Its three failures were:

1. The formal trend fixture could not show the report's `句子理解` retry candidate because its source Session and Report were incomplete and unlinked.
2. The review-pending fixture was classified as incomplete before the real `summary.requiresTeacherReview` / `summary.scoringState` state could be presented.
3. The valid 72-point report and its safe teacher comment were suppressed because the mock omitted the Report ID, school, source Session link, and the source Session's school/enrollment/completion fields.

T013 fixtures now use the actual GET response fields: `STANDARD`, `COMPLETED`, `completedAt`, `schoolId`, and `enrollmentId` on the source Session; `id`, `sessionId`, `schoolId`, `generatedAt`, `dataCompleteness: 100`, score, summary, diagnosis, and teacher feedback on the Report. The no-report completed record also has a matching completed source Session. The trend retry candidate uses the server's allowlisted fields. Existing meaningful assertions remain. Result: **13 PASS / 0 FAIL / 0 SKIP**, logged in [`t013-after.log`](t013-after.log).

T025 negative controls now cover IN_PROGRESS and PROCESSING Sessions with fake complete reports, teacher-review-required Reports, source school/enrollment/ID mismatches, Report school/session mismatches, out-of-range score 101, 99/null completeness, and missing `generatedAt`. Existing legal-zero versus absent-score, feedback separation, privacy, and remediation tests remain. Result: **24 PASS / 0 FAIL / 0 SKIP**, logged in [`t025-frontend-unit.log`](t025-frontend-unit.log).

## Native browser, service, and SQL evidence

The final T030 Chromium E2E passed **1 PASS / 0 FAIL / 0 SKIP**. Its companion T013 Today/Growth native regression passed **1 PASS / 0 FAIL / 0 SKIP**. Logs: [`native-e2e.log`](native-e2e.log), [`t013-native-regression.log`](t013-native-regression.log), and [`native-run.log`](native-run.log). Dynamic rows and API results are in [`native-e2e/native-evidence.json`](native-e2e/native-evidence.json).

Numbered `*-attempt-*` artifacts preserve intermediate harness diagnostics. Acceptance status is determined by the final canonical logs and exit record above.

T030 owned PostgreSQL 17 on `55660`, Redis on `6460`, MinIO on `59240–59241`, API on `4130`, and Web on `4330`; the isolated database/user are `yuzan_t030_native` / `yz_t030`, and the bucket is `yz-t030-native`. Chromium 153 drove the real web app and NestJS API. The existing Level 1 Question Bank data was reused from the read-only source and imported idempotently into T030's own database/bucket.

- A completed standard source Session `c68b3286-a619-4da6-b7d9-b1c6ca954b01` and Report `e657a4de-d7f4-4dbe-bafb-cb761cba12f9` are linked to school `11111111-1111-4111-8111-111111111111` and Student A's enrollment. PostgreSQL records `COMPLETED`, a completion time, score **55**, and **100%** report completeness. The Report API returned six safe AssessmentReview comments; reviewer IDs, rubric, answer key, and scoring configuration were absent from the student response.
- Before teacher review, the real submitted source Session was `PROCESSING` with **0** AssessmentReports. Growth showed no official score for it. After authorized teacher review, it appeared as the completed 55-point report.
- A second real standard Session `9cdb48ec-2704-4173-b53c-e51c6c0d1b22` received deliberately incorrect submitted answers and six teacher-review scores through the review API. The server generated Report `589edcd2-22b9-486a-9fa9-c64fbce3ac7e`: score **0**, completeness **100%**, Session `COMPLETED`, and all **20/20** AssessmentItems scored zero. Growth displayed `0 分`, distinct from the earlier no-report state. No score was written directly to SQL.
- The formal Report row and the published course Feedback row stayed separate: SQL/API evidence shows **6 AssessmentReview items** and **1 Submission Feedback** event. The course feedback remained on its own card.
- Student A clicked the 55-point report's remediation action. NestJS returned `201` for actual remediation Session `bbe05c26-1b71-495b-a34d-f4ed0f75efac`, with 15 server-selected retry items. The browser dropped the response; it issued **one POST**, then recovered through the enrollment-scoped session-list and session-detail GETs. SQL shows exactly one linked remediation Session with `retestOfSessionId` set to the source. After submission and refresh, the real state was `PROCESSING`, with six pending review items and no formal remediation Report. Four remediation recordings were read back from T030 MinIO.
- API negatives passed: unauthenticated **401**; same-school Student B report/history/remediation access **403**; cross-school Student C report **403**; missing Report **404**; ineligible remediation creation **409** with no remediation row. The same tab also switched to an unauthorized school while an old school-A history response was delayed. The old response arrived after the switch, but Growth stayed in the error state and rendered no Student A data.
- The open-practice list was checked against server-returned IDs. Report retry candidates are explicitly identified as report content, not an AI-selected open-practice recommendation.
- Browser checks passed at **390, 768, 1280, and 1440** pixels with no horizontal overflow. Keyboard activation, accessible button/link names, alert role, and reduced-motion mode passed. Screenshots: [390](native-e2e/growth-formal-390.png), [768](native-e2e/growth-formal-768.png), [1280](native-e2e/growth-formal-1280.png), [1440](native-e2e/growth-formal-1440.png), [processing without report](native-e2e/growth-processing-without-report-1440.png), [remediation processing](native-e2e/growth-remediation-processing-1440.png), [stale response discarded](native-e2e/school-switch-stale-response-discarded.png).

The browser used Chromium's fake microphone device (`SIMULATED_MIC`) for test recordings; scoring and teacher review were server-backed. Physical microphone and production speech-worker behavior were not claimed.

## Verification

| Gate | Result |
|---|---|
| T013 Growth unit | 13 PASS / 0 FAIL / 0 SKIP |
| T025 Growth unit and new negative controls | 23 PASS / 0 FAIL / 0 SKIP |
| Full frontend suite + Runtime verifier | 87 PASS / 0 FAIL / 0 SKIP; [`frontend-full.log`](frontend-full.log) |
| API suite | 1,101 PASS / 64 environment-gated SKIP / 0 FAIL; [`api-full-suite.log`](api-full-suite.log) |
| Contracts, read-only | Redocly validation PASS; [`contracts-readonly.log`](contracts-readonly.log) |
| Native T030 and T013 browser suites | 1 PASS / 0 SKIP each |
| Node/Python syntax and `git diff --check` | PASS |

The final ownership-aware stop verified all T030 processes exited and all six T030 ports were free; the isolated database and MinIO objects remain for audit in `runtime-local/native-web-t030`. Evidence: [`runtime-exit.json`](runtime-exit.json). No Docker, Compose, Worker, or P1SIM was used. The L4 historical shared PostgreSQL Docker-volume incident remains **OPEN / UNTOUCHED**.

## File scope and noninterference

Changed source files are limited to the authorized T013 and T025 unit tests plus T030's own native runner and E2E. Growth production assets, API/OpenAPI/contracts, the shared T005 source, and T029/T031/T032 source files were not modified or staged.

At close, the shared `feat/question-bank-v1` checkout retained its T005 dirty course-detail/backend/OpenAPI/resource state; T029 remained clean; T031 and T032 retained their own active task changes. T025 remains clean at the exact base SHA. These worktrees were inspected read-only. T030 is not merged into the shared branch.
