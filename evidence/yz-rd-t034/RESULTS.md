# YZ-RD-T034 Results

**STATUS: DONE / WEB_ONLY / NATIVE_CHROMIUM_API_PG17_VERIFIED**

## Result contract

| Field | Result |
|---|---|
| `TASK_ID` | `YZ-RD-T034` |
| `STATUS` | `DONE` |
| `BRANCH` | `feat/yz-rd-t034-teacher-class-roster-ux`; independent and not merged |
| `BASE` | `feat/yz-rd-t032-teacher-roster-csv-export@67bbfda3f13b3dbcbb3e9a5e256ac3c6a7ab32ec`; checkout continued from `995d74b4c0a4c1e634253ebc2a990d30b29a3b50` |
| `FINAL_SHA` | Git branch tip is returned with the task result after commit and push. |
| `REAL_35PLUS_STUDENTS` | PASS: isolated PostgreSQL 17 main class had 35 ACTIVE STUDENT enrollments; API enrollment IDs and display names matched an independent SQL join. Two same-name records retained different Enrollment IDs. The same runtime also verified one-student and empty classes. All fixture identities are synthetic. |
| `SEARCH_FILTER_SORT` | PASS: Unicode name search; server `riskStatus` counts (24 `OK`, 4 `AT_RISK`, 7 `INACTIVE`); formal report present/absent filters (3/32); recent-activity and course-progress descending sorts with missing values last. The filtered status announced `当前显示 3 / 已加载 35 人`. |
| `STUDENT_DETAIL_CLICK` | PASS: Enter on a real roster name opened `/teacher/students/{Enrollment ID}` and loaded that enrollment's detail. The same-name record stayed selected on return; legal search/risk/sort state survived return and refresh. |
| `CSV_FULL_CLASS` | PASS: with 3 of 35 visible, the explicit `导出全班名单CSV` action downloaded all 35 authorized rows from a fresh API GET. CSV rows matched PostgreSQL, including `0` versus blank/null score cells. Empty class downloaded a header-only CSV. No Enrollment IDs or student names were used in filenames. |
| `AUTH_NEGATIVE_TESTS` | PASS: API `401` anonymous, `403` cross-school, `404` same-school unassigned teacher (resource hiding), and `404` missing class. Browser `403/404/500` responses and network abort displayed errors with zero roster rows. A held old-school API response released after school switch did not repopulate the page. |
| `CHROMIUM_API_PG_E2E` | PASS: 1 passed / 0 skipped using Google Chrome 153.0.8010.52, Node 24, pnpm 10.13.1, NestJS API, PostgreSQL 17, Redis 7 and MinIO. Task-owned services stopped; database and bucket retained. |
| `PASS_FAIL_SKIP_NOT_RUN` | Frontend 50 PASS / 0 FAIL / 0 SKIP (includes T032 CSV's 6 cases); Classes API focused 29 PASS / 0 FAIL / 0 SKIP; API suite 1106 PASS / 0 FAIL / 64 SKIP; native E2E 1 PASS / 0 FAIL / 0 SKIP; Contracts OpenAPI lint and TypeScript typecheck PASS; JavaScript/Python syntax and `git diff --check` PASS. Contracts generator tests NOT_RUN because they rewrite `packages/contracts/src/generated.ts`, outside the frozen T034 write scope. |
| `FOUR_VIEWPORTS_KEYBOARD` | PASS: 390×844, 768×900, 1280×900 and 1440×1000; document widths matched viewport widths and roster widths stayed within their containers. Tab order, Escape search clear, Enter detail activation, visible keyboard focus, polite count announcement and reduced motion passed. Screenshots are `roster-390.png`, `roster-768.png`, `roster-1280.png` and `roster-1440.png`. |
| `T005_T033_T035_T036_NONINTERFERENCE` | PASS: changes and staging stayed within the T034 checkout's frozen paths. T005's pre-existing dirty status matched the initial snapshot; T033, T035 and T036 worktrees were not edited or staged. |
| `OWN_PID_PORT_L4_OPEN_NOT_SHARED_MERGED` | PASS: T034 API/Web/PostgreSQL/Redis/MinIO/Chromium runtime stopped using task-owned process records; ports 4134, 4334, 55834, 6474, 59274 and 59275 are closed. Worker, Docker and Compose were not used. L4 remains OPEN and untouched. |
| `READY_TO_MERGE` | YES, after the branch push recorded in the task return. |
| `L4_OPEN` | OPEN |

## Behavior and limits

- Filters use the loaded, currently authorized class roster. Legal state is normalized and stored in the URL; the return path also restores it only for the same user, school and class. Invalid risk/score/sort values fall back to defaults.
- The score filter uses a numeric formal report value, so `0` is scored and `null` is not. Roster display uses `0` and `—` respectively. CSV preserves `0` and writes null as an empty cell.
- The current Classes API derives only `OK`, `AT_RISK` and `INACTIVE` from activity timestamps; it has no persisted unknown-risk value. T034 did not change the backend. Missing or future risk values are rendered as neutral `未知`, and the UNKNOWN filter/helper path is covered by frontend tests. The real-PostgreSQL unknown-risk row is therefore NOT_REPRESENTABLE by the frozen API contract.
- Native browser/database details, sanitized statuses and row counts are in `t034-browser-database-evidence.json` and `native-runtime-evidence.json`. No real student data was used.
