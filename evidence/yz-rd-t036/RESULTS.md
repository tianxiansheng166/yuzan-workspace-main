# YZ-RD-T036 Results

## Completion

- `TASK_ID`: `YZ-RD-T036`
- `STATUS`: `DONE / WEB_ONLY / CHROMIUM_API_PG17_VERIFIED`
- `BRANCH`: `feat/yz-rd-t036-student-history-actionable-ux`
- `FINAL_SHA`: Git HEAD is authoritative and is returned in the task completion message; this file is committed with the checkpoint.
- `READY_TO_MERGE`: `YES` after the independent branch is pushed; no merge was performed.
- `L4_OPEN`: `OPEN`; no L4 source or volume was accessed.
- The target checkout `AGENTS.md` has no `AA-DEV-V2.2` marker. The supplied T036 task card and `/home/tian/code/AGENTS.md` baseline were applied.

## Required outcome fields

- `HISTORY_DYNAMIC_CLICK`: `PASS`. A real `IN_PROGRESS` Attempt opened its same-ID `/student/practices/attempts/{id}/runner/`; a real `PROCESSING` Attempt opened `/student/practices/attempts/{id}/processing/`; a complete formal report opened its authorized report route; the created `REMEDIATION` Attempt opened its own Runner.
- `FILTER_CURSOR`: `PASS`. `IN_PROGRESS`, `PROCESSING`, and `COMPLETED` are sent as exact server status filters. `REMEDIATION` filters by persisted purpose while scanning the full cursor history. Search resolves the real PracticeDefinition title and scans server cursor pages. The UI loads the next server cursor page; Chromium and API/PG verified 26 pages of 25 rows in the retained T036 test database.
- `REPORT_SOURCE`: `PASS`. History reads the authorized `GET /assessments/sessions/{id}/report` payload and links only when the response is bound to the same Attempt and has `dataCompleteness=100`. The native run generated a real report through the API/review flow; PostgreSQL and API both confirmed `COMPLETED`, `overallScore=0`, and `dataCompleteness=100`. Incomplete/missing reports expose no score or report link. The UI keeps numeric zero distinct from null/missing.
- `TEACHER_FEEDBACK`: `PASS`. Course-task `Feedback` and formal `AssessmentReview` comments appear in separately labeled sections, each backed by its own authorized API source. The test-created comments are marked `TEST_FIXTURE_ONLY`.
- `IDENTITY_ISOLATION`: `PASS`. Seeded Student A, a separate same-school Student B, and a separate school were used. Student B could not enumerate or read A's Attempt/report; A could not query B's enrollment or the other school. Browser B history showed B's own Attempt and not A's.
- `CHROMIUM_API_PG_E2E`: `PASS`, Chromium 153 + NestJS API + PostgreSQL 17.11 + Redis + MinIO; 1 passed, 0 failed, 0 skipped. Native runtime ports were API `4136`, Web `4336`, PostgreSQL `55666`, Redis `6466`, MinIO `59256–59257`. Services were stopped after verification; the isolated T036 database and evidence remain.
- `PASS_FAIL_SKIP_NOT_RUN`: `PASS` 90/90 frontend tests; 5/5 focused history tests; native E2E 1/1; JavaScript syntax, Python harness compilation, and `git diff --check` passed. `FAIL=0`, `SKIP=0`. `NOT_RUN`: physical microphone/device checks, calibrated speech scoring, school pilot, and production launch. Browser audio used Chromium's simulated microphone; Worker remained stopped and no external scoring provider was called.
- `READY_TO_MERGE`: `YES` after push of this branch only.
- `L4_OPEN`: `OPEN`.

## Evidence

- Native Chromium/API/PG17 run: [`chromium-api-pg17-e2e.log`](chromium-api-pg17-e2e.log)
- Dynamic IDs, report/SQL checks, status matrix, cursor pages, offline recovery, and accessibility results: [`e2e-proof.json`](e2e-proof.json)
- Responsive screenshots: [390px](screenshots/history-390.png), [768px](screenshots/history-768.png), [1280px](screenshots/history-1280.png), [1440px](screenshots/history-1440.png)

## Fixture boundaries

The T036 runtime uses fictional local seed identities and `TEST_FIXTURE_ONLY` practice definitions. The formal zero is produced by normal deterministic scoring of incorrect choice responses and the test-only AssessmentReview endpoint for its simulated recording; neither scores nor an AssessmentReport were inserted directly into PostgreSQL. This proves the UI/API contract and is not evidence about a real learner, calibrated speech scoring, or pilot outcomes. No T031 Runner, T033 API Client, teacher page, backend source, `local_sources/`, or T005 original source was modified or imported.
