# YZ-RD-T077 Results

| Field | Result |
|---|---|
| TASK_ID | `YZ-RD-T077` |
| STATUS | `RETURNED / FRONTEND_FIXES_VERIFIED / REAL_RUNTIME_E2E_NOT_RUN` |
| BASE | `d6fbf670bb6997cae0e841d8f9a397f0da785a42` |
| BRANCH | `feat/yz-rd-t077-student-growth-feedback-actionable` |
| FINAL_SHA | Recorded in the task return after the evidence commit. |
| OWNER_SCOPE | `frontend/student/growth/`, its frontend regression test, and `evidence/yz-rd-t077/` only. |
| FORMAL_FEEDBACK | Live authorized feedback `NOT_RUN`; fixture feedback is labeled `TEST_FIXTURE_ONLY`. |
| REMEDIATION_REAL_ACTION | `NOT_RUN` without an authorized isolated API/PostgreSQL dataset. Existing client recovery tests pass with fixture data. |
| PROGRESS_DATA_TRUST | Client reads server `qb-progress-v1`; screenshot fixture returns `EMPTY_STATE`, so no skill mastery or curve is claimed. Live data verification `NOT_RUN`. |
| E2E | `NOT_RUN` — no authorized isolated PostgreSQL runtime was available. Desktop screenshots are browser/API fixture evidence only. |
| READY_TO_MERGE | `NO` — inherited T068/T064 API lint debt remains at 733 findings; this task made no API or contract changes and did not rerun API lint. |
| L4_OPEN | `OPEN / NOT ACCESSED` — no L4 source or historical incident was read. |

## Read-only baseline audit

The accepted T068 checkout was clean at BASE. Its accepted capsule records 141 frontend tests passing and the existing Growth page behavior. At BASE, Node `24.20.0` / pnpm `10.13.1`, the two Growth suites passed `37/37`.

Three reproducible breakpoints were recorded before implementation:

1. If one report request returns 503, `renderReports` returned before rendering any other report, even when its linked report was complete. The T077 two-report regression fixture reproduced the lost sibling card.
2. A `retryCandidates` entry with a whitespace-only `questionVersionId` passed the string type check and exposed the remediation action. The T077 malformed-candidate fixture reproduced the invalid action.
3. With nine completed sessions, `loadReports` queried only the first eight and the page did not explain that earlier reports were available through history. The T077 nine-session fixture confirmed the capped lookup.

The first two now have explicit recovery/validation behavior. The eight-report request cap remains to limit request fan-out; Growth now labels the cap and links to complete history.

## Changes

- Report lookup failures now render as per-report error rows with a retry action. Successful linked reports and their formal scores remain visible while another report is unavailable. Authentication failures still use the page-level login state.
- A remediation action requires a non-empty `questionVersionId` from the report candidate. Candidate authorization and attempt creation remain server-owned; no new route or scoring logic was added.
- When more than eight completed report candidates exist, the section says that it shows the latest eight and links to the full learning history.
- Added three Growth regressions for partial report failure, blank candidate versions, and the capped report list. No API source, OpenAPI, shared student routes, T005-owned files, Today, Course, Assessment Runner, or Teacher Studio files changed.

## Verification

- Baseline before fixes: the three T077 regressions failed `3/3` for the recorded issues.
- `node --test frontend/tests/assessment/t025-growth-feedback.test.mjs frontend/tests/assessment/t013-growth-live.test.mjs`: `40/40` passed.
- `pnpm --filter @yuzan/frontend test`: `144/144` passed and the frontend runtime verifier passed.
- Frontend `lint`, `typecheck`, and `build` scripts passed. `git diff --check` passed.
- Chrome `153.0.8010.52` rendered the Growth page at `1280×900` and `1440×1000`. Both full-page captures show explicit `0 分` and `暂无正式得分` separately, multiline feedback, two dynamic report links, one valid remediation action, and a 503 report-read error with its retry control while the other reports remain visible. Layout widths matched their document widths (`1265/1265` and `1425/1425`); no horizontal overflow was detected.
- Screenshots and measurements are in `screenshots/` and `browser-proof.json`. The browser run used an in-browser fixture and is strictly `TEST_FIXTURE_ONLY`; its fixture IDs are not real report or attempt IDs.

## Runtime and evidence boundaries

The local readiness check found no API, PostgreSQL, Redis, or MinIO services listening on the expected development ports. No authorized isolated PostgreSQL dataset was identified, so the Chrome + NestJS/PostgreSQL report-to-remediation E2E is `NOT_RUN`. No synthetic written attempt was substituted as a real action. Fixture report IDs are `report-t077-zero-fixture` and `report-t077-null-fixture`; both returned no real Attempt ID. The fixture's explicit zero and null only verify presentation behavior.

`L4_OPEN=OPEN` is inherited project status; this task did not access L4 or the historical incident. `READY_TO_MERGE=NO` follows the inherited API lint gate recorded by T068/T064.
