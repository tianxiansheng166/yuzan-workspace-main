# YZ-RD-T074 Results

## Pre-edit audit

Reviewed the accepted BASE `d6fbf670bb6997cae0e841d8f9a397f0da785a42`, the Today frontend and API response contract, and prior T047/T050/T053 evidence. Those earlier runs establish authorized server-selected Today actions, same-attempt resume, identity isolation, and desktop screenshots for their own source revisions; they do not verify this T068-based source revision.

Three reproducible failure boundaries in the current Today code:

1. **Return from a learning page with the same identity:** restore Today from BFCache with `pageshow.persisted=true` after completing or submitting work. The current handler refreshes only when user or school identity differs, so the primary action and pending status stay stale.
2. **Switch school while a create request is pending:** start the server-authorized baseline/remediation action, change active school before the create response resolves, then return a successful attempt ID. The current success path navigates to that ID without rechecking the captured identity.
3. **Server action with an unusable route:** return a primary action whose target is missing or external. Today displays “重新加载后再试” as passive text without a reload control.

Selected the first two for this change because they can leave the student on an obsolete next step or route a successful response into the wrong active-school context. The third is recorded as a lower-frequency contract-error recovery gap and is not included in this implementation slice.

## Implementation

- A BFCache `pageshow` restore now reloads Today from the authenticated server even when the student and active school are unchanged. Ordinary first-page `pageshow` does not trigger a duplicate load.
- Baseline and remediation creation now recheck the captured user/school identity after the awaited API response and before navigating to its Attempt ID. A school/account change causes a fresh Today load instead of opening a stale action.
- No API contract or server priority changes were needed. The server remains authoritative for the one primary action and Attempt status.

## Verification

- Baseline reproduction before the fix: the two selected cases failed (Today read count stayed at 1 after a persisted `pageshow`; the identity-switch case navigated to the old-school Attempt URL).
- Targeted Today frontend test after the fix: **7 passed / 0 failed**.
- Full frontend test and runtime verification: **143 passed / 0 failed**, runtime verification PASS, Node `v24.20.0`, pnpm `10.13.1`.
- New Chrome `153.0.8010.52` screenshots for 1280×900 and 1440×1000 cover the teacher-assigned primary action, pending review, empty state, and 403 error. These use explicit `TEST_FIXTURE_ONLY` API stubs while rendering the actual Today page, CSS, and JavaScript. They are visual evidence only, not live student/API evidence.
- New Chrome + Nest API + isolated PostgreSQL E2E: **NOT_RUN**. This environment has Chrome but no local PostgreSQL/`pg_ctl`, Redis, or MinIO runtime binaries and no task runtime launcher; Docker/Compose is prohibited by the task card. No authorized live student data was accessed and no substitute data was written.
- `git diff --check`: PASS. Screenshot capture script syntax check: PASS.

## Return fields

- `IMPLEMENTED_WEB_FLOW`: same-school return refresh plus post-create identity validation; server-authorized primary action remains the source of priority.
- `PRIORITY_RULE`: server-selected teacher remediation, self remediation, active standard Attempt, formal retry candidate, continue practice, baseline, then legacy course task.
- `REAL_STUDENT_CONTEXT`: `NOT_RUN`.
- `ATTEMPT_ID_REUSE`: client prevents duplicate clicks while creating; service-side same-ID behavior was not revalidated in a new runtime (`NOT_RUN`).
- `DESKTOP_UI`: Chrome screenshots are `TEST_FIXTURE_ONLY`, 1280/1440.
- `E2E`: `NOT_RUN` due unavailable isolated API/PostgreSQL runtime.
- `NO_RAW_READ`: no raw course/question import sources or T005/L4 data were opened.
- `READY_TO_MERGE`: `NO`; new native E2E was not run, and the task baseline records inherited API lint debt.
- `L4_OPEN`: `OPEN`; not accessed.

Only `frontend/student/today/**`, Today frontend tests, and `evidence/yz-rd-t074/**` are in scope. The checkout `AGENTS.md` lacks the `AA-DEV-V2.2-20261017` marker; the Task Card's Lane URL resolves to the project page and does not identify a separate V2.2 policy. The supplied `/home/tian/code/AGENTS.md` baseline and frozen task restrictions governed this work.
