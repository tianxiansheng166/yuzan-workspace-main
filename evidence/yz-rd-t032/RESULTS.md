# YZ-RD-T032 Results

**STATUS: NEEDS_DECISION / WEB_ONLY / NATIVE_CHROMIUM_API_POSTGRESQL_VERIFIED**

## Result contract

| Field | Result |
|---|---|
| `TASK_ID` | `YZ-RD-T032` |
| `STATUS` | `NEEDS_DECISION` |
| `EXACT_T028_BASE_BRANCH_SHA_PUSH` | Base verified as `feat/yz-rd-t028-teacher-invitation-revocation@bfae13ab315bee532842cffe4fdd6c142cb8a488`; implementation commit `94a7d7a54c68bc021df2b7b1568f273157470563` pushed to `origin/feat/yz-rd-t032-teacher-roster-csv-export`; no shared merge. |
| `REAL_CLASS_EXPORT_BUTTON_BROWSER_DOWNLOAD_CSV_SQL_ROWS` | PASS: Teacher C clicked the class detail control; Chromium recorded 6 downloads across repeat, update, keyboard, retry and empty-class checks. Three authorized student rows matched PostgreSQL joins; empty class produced header only. |
| `AUTHORIZED_PAGING_ZERO_NULL_AND_STALE_SCHOOL_IDENTITY` | PASS: endpoint returned the full unpaginated array; zero score stayed `0`, null score stayed blank, no-progress showed `—`; delayed response after identity change was discarded. |
| `CSV_FORMULA_INJECTION_QUOTING_UNICODE_SECURITY` | PASS: BOM, RFC 4180 quoting, commas, quotes, CR/LF, tab, multilingual text and dangerous formula prefixes were parsed independently. No Enrollment IDs or student names appear in filenames. |
| `NEGATIVE_401_403_404_NETWORK_RETRY_NO_OLD_DATA_DOWNLOAD` | PASS for anonymous `401`, cross-school `403`, missing class `404`, UI `401/403/404/500`, network abort, timeout and real retry. **Task-card discrepancy:** Teacher B opening another teacher's same-school class returned `404`; the card requests `403`. |
| `FOUR_VIEWPORT_CODE_ART_A11Y_MOTION` | PASS at 390, 768, 1280 and 1440 px: document and roster had no horizontal scroll; keyboard focus, Enter activation, polite live status and reduced-motion preference passed. Existing class background was retained. |
| `FE_API_NATIVE_CHROME_PG_TESTS_PASS_FAIL_SKIPPED_NOTRUN` | Frontend 43/43 PASS, 0 skipped; related Classes API tests 29/29 PASS; Contracts 6/6 PASS; native E2E 1 PASS / 0 skipped; API build, OpenAPI lint, JS/Python syntax and diff checks PASS. See verification table. |
| `T005_T029_T030_T031_NONINTERFERENCE` | PASS: no T032 changes were made in those worktrees. T029/T028 were clean at review; T030/T031 retain their own pre-existing task changes and were not staged or edited by T032. |
| `OWN_PROCESS_STOP_L4_OPEN_NOT_SHARED_MERGED` | PASS: T032 PostgreSQL/API/Web/Redis/MinIO/Chromium exited; all six T032 ports were closed. L4 remains OPEN and was not inspected or restored. No Docker, Compose, Worker or shared merge was used. |

## Implementation and API boundary

- The former disabled toolbar action now exports `导出名单/学情CSV`; a visible action is also available beside the roster on narrow screens. Both use the same export handler.
- Every export performs a new `GET /schools/{schoolId}/classes/{classId}/student-summaries` with the current bearer token. The page checks the current user, active school, class route, dashboard class ID and expected student count before creating a Blob. A 15 second abort, duplicate-click lock, personal-data confirmation and fresh retry path are in place.
- T028's service executes `Enrollment.findMany` for all ACTIVE STUDENT enrollments in the authorized school/class and applies no `take`, cursor or limit. The controller returns the raw array; there is no pagination metadata. The UI rejects ambiguous or incomplete paged envelopes and rejects a row count that disagrees with the dashboard.
- Export fields are student name, class name, course progress, completed/missing Submission counts, latest formal score, risk and last activity. Enrollment IDs, user IDs, recordings and top issue are excluded. Missing progress is `—`; a null formal score is an empty cell. The export makes no PDF, official archive, formula or calibrated score claim.
- Every CSV field is quoted. Formula-like leading text (`=`, `+`, `-`, `@`, TAB, CR/LF and whitespace-prefixed formulas) receives a text marker before RFC 4180 quoting. CSV includes a UTF-8 BOM. Local dates are validated before formatting. Confirmation explains the personal-data categories and count.
- A 401/403/404 or identity change clears the displayed roster. Network/500/timeout states report `导出失败、重试`; none triggered a download. No prior UI cache is used by export.

## Native browser and PostgreSQL evidence

- Runtime used Node 24.20.0, pnpm 10.13.1, PostgreSQL 17, Redis 7, MinIO and Google Chrome 153.0.8010.52. The task-owned database is `yuzan_t032_native` / `yz_t032`; MinIO bucket is `yz-t032-native`.
- Fictional Teacher C had exactly three ACTIVE STUDENT enrollments in the authorized class. The fixture included progress 100%, 0% and null; formal scores 0, null and 86; and formula-like names containing Unicode, comma, quotes, TAB and line breaks.
- The browser downloaded the fresh response six times: first export, identical-data repeat, changed-progress export, keyboard activation, post-failure retry and empty-class header-only export. Three CSV rows matched SQL joins across Enrollment/User, ActivityProgress, Assignment/AssignmentTarget/Submission and AssessmentSession/AssessmentReport. Updating a real progress row changed the next download from 0% to 50%.
- The independent Python CSV parser confirmed 8 headers, 3 data rows, BOM, formula-safe names, null/zero semantics and SQL parity. Download files were read from Chromium temporary paths and not retained. `csv-sample-redacted.csv` is the only CSV sample in evidence. Screenshots contain only fictional `TEST_FIXTURE_ONLY` browser fixtures.
- Actual API negative controls: anonymous `401`, cross-school `403`, missing class `404`. Teacher B, a same-school teacher assigned to another class, received `404` for this class. This matches the accepted T028 baseline tests: `classes.teacher-scope.spec.ts` expects `404` for another teacher's `student-summaries`, and `classes.controller.spec.ts` asserts the same `404` for an unauthorized existing class and a missing class to conceal resource existence. `ClassesService.requireClassAccess` throws `ClassNotFoundException` when the teacher is not assigned. The task card instead requires `403`; T032 did not change backend code because that path is outside its authorized source scope. **API_REQUEST / OWNER DECISION:** accept the existing resource-concealing `404` for T032, or authorize a separate backend status-contract change.
- The native runtime database, MinIO bucket and evidence are retained. No recordings were created. Native process/port evidence is in `native-runtime-evidence.json`; SQL/browser details and sanitized statuses are in `t032-browser-database-evidence.json`.

## Verification

| Check | Result |
|---|---|
| Native Chromium + NestJS + PostgreSQL E2E | PASS 1 / SKIPPED 0 |
| PostgreSQL row parity, repeated download and changed progress | PASS |
| Native API negative controls | PASS: 401/403/404; Teacher B class-scope status differs from card (actual 404, expected 403) |
| UI failures: 401/403/404/500/network/15s timeout; retry and stale identity | PASS; 0 failure downloads |
| Four viewports, keyboard, aria-live, focus-visible, reduced motion | PASS |
| Frontend suite, including T032 unit tests | PASS 43 / SKIPPED 0 |
| Classes controller and teacher-scope API tests (read-only) | PASS 29 / SKIPPED 0; baseline explicitly codifies 404 concealment for cross-class teacher access |
| OpenAPI lint and generated-contract tests (read-only) | PASS 6 / SKIPPED 0 |
| API build in native runtime | PASS |
| JS syntax, Python compile and `git diff --check` | PASS |
| Docker / Compose / Worker / L4 investigation | NOT_RUN by task scope; L4 stays OPEN |
| School pilot, real student data, PDF/archive output and score calibration | NOT_RUN / not claimed |

## Scope and delivery

- T032 source changes are limited to the three allowed class-detail files plus `roster-export.js`; tests and evidence are T032-owned. No backend, ApiClient, OpenAPI/generated contract, T029, T030, T031 or T005 files were changed.
- The target checkout's `AGENTS.md` lacks the V2.2 marker; the supplied T032 task contract governed this offline task.
- The branch remains independent and unmerged. The T029 integration worktree was not modified. L4 remains OPEN.
