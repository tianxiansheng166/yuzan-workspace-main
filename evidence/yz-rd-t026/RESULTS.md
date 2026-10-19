# YZ-RD-T026 Results

**Status:** DONE / WEB_ONLY / READY_TO_MERGE

**Branch:** `feat/yz-rd-t026-onboarding-rolling-web`

**Shared branch:** not merged to `feat/question-bank-v1`

## Exact source graph

| Role                                                 | Exact commit                               | True merge base / parent                          |
| ---------------------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| Accepted T024 base                                   | `ea1a048966d3eb5e17d9ba1c24d565e4616499de` | T024 merge of T019/T020; T018 is already in T020  |
| T021 student Profile source                          | `6445dca34c19fea89c885a3e4085cf47f9d7e5ed` | `4475f418078e5800678a55b05d418d216962732e` (T015) |
| T023 teacher class invitation source                 | `34af873837c9cfb74a7be33e94617b94668b4f4d` | `e6b8e8aa0b2f8cfe9a3bed894f264c73f64e1f3c` (T020) |
| T026 merge 1                                         | `8f831b6e1547f14d79e623b981a1ab65b68c27d3` | Parents: T024 base, exact T021 source             |
| T026 merge 2 / integration HEAD before task evidence | `f3a43d0170a43ab1a5127f8517202ac0aebb29bd` | Parents: T026 merge 1, exact T023 source          |

Both source commits are absent from T024's ancestry before integration. The two normal `--no-ff` merges preserve their original source commits and parents. No source commit was cherry-picked or replayed.

T021 changed 14 paths from its true T015 base; T023 changed 18 paths from its true T020 base. The source path sets have no overlap with each other. T021's changed paths have no overlap with T024's changes from T015 (302 paths); T023's changed paths have no overlap with T024's changes from T020 (308 paths). Both merges used Git's `ort` strategy and had zero conflicts. The accepted frontend/API/contract implementation needed no production-code reconciliation; T026 adds only its native E2E/runtime evidence and handoff.

## Real teacher-to-student flow (G1/G2/G3)

The final native E2E used fictional test identities in one fresh T026-owned PostgreSQL 17 database. It ran as one pytest case and passed `1/1`, with `0` failed and `0` skipped.

1. Teacher C logged in through Chromium, selected the actual authorized class from the T024 Teacher Home class listing, and opened T023's class invitation ticket from that class detail.
2. The UI's class-scoped `GET /teacher-invitations/mine` showed no invitation from Teacher C's other class. An injected list-read failure displayed an error; clicking Retry returned the real empty state.
3. Teacher C submitted the invitation form with one use and 30-day validity. The server returned `201`, but Chromium dropped that POST response. The UI re-read the teacher's real invitation list, found the committed invitation and made no second POST. `maxUses=1`, `usedCount=0`, and expiration came from the server.
4. A denied Clipboard write showed failure, selected the real code field for manual copy, and did not report success. The next actual Clipboard write resolved; Chromium read the clipboard value back and confirmed it matched the server-issued code. The code stayed in browser memory and is absent from saved logs/JSON; screenshots mask it with parchment `#f3ecdd`.
5. Student A logged in in a separate browser page, pasted that clipboard value with Ctrl+V into the merged T021 `/student/profile/` form, and submitted. The Profile UI showed successful binding only after the authenticated school selection/Profile re-read. PostgreSQL then contained the ACTIVE Membership, ACTIVE STUDENT Enrollment, one bind AuditLog, and invitation `usedCount=1`.
6. Teacher C returned through Teacher Home, refreshed the same class roster, saw Student A, and opened the student's real enrollment detail. Student A opened the merged Student Today page through the shared navigation. PostgreSQL and the page showed no open Assignment or PracticeDelivery and an empty course section; the page did not invent a task or direct assignment CTA.
7. The same aggregate test ran the accepted T021 two-school/three-class Profile scenario. Student A switched between school A and school B and saw only the server-authorized classes; a separately authenticated Student B did not retain Student A's identity or class rows.

The linked T023 teacher/student journey and the T021 multi-school isolation journey use separate fictional identities; both ran in the same T026 database. Their full browser/API assertions and IDs are in [`native-e2e-summary.json`](native-e2e-summary.json), [`browser-database-evidence.json`](t023-browser-flow/browser-database-evidence.json), and [`e2e-summary.json`](t021-profile-isolation/e2e-summary.json).

### PostgreSQL parity

[`real-onboarding-records.txt`](sql/real-onboarding-records.txt) contains the exact SQL and returned rows. It selects no invitation secret.

| T023 UI flow record | Dynamic ID                             | Persisted result                                          |
| ------------------- | -------------------------------------- | --------------------------------------------------------- |
| School              | `2c883092-5be5-4b41-9d2f-7dcc90ce122a` | Matches invitation, Membership, Enrollment, AuditLog      |
| Class               | `d08c894b-8a27-43c2-8ca7-6c2517b4bd0a` | Class selected from Teacher Home and opened in detail     |
| Student A user      | `95cf0d1e-2c36-412d-a36d-391697bdacd1` | Same identity in browser bind and SQL                     |
| Membership          | `06ded14d-6087-46d7-9c57-a7fad0a44d16` | `ACTIVE` / `STUDENT`                                      |
| Enrollment          | `35f51728-b095-4686-8c63-23400c0c9d7b` | `ACTIVE` / `STUDENT`; same school and class               |
| TeacherInvitation   | `db2a6c3b-459c-483b-8d92-01d7e0a37e53` | `maxUses=1`, `usedCount=1` after bind and duplicate retry |
| AuditLog            | `285b0964-d5d0-42cb-a4e3-3438390e2c40` | `STUDENT_BOUND_TEACHER_INVITATION`; exactly one row       |

For the separate T021 identity, the SQL records two ACTIVE school Memberships and three ACTIVE class Enrollments across two schools. Each of the three bound TeacherInvitations has `usedCount=1`, with a corresponding Enrollment and AuditLog. The exact School, Class, Invitation, Enrollment, and AuditLog IDs are in the SQL evidence file and T021 browser evidence.

## Authorization, retry, identity, and invitation separation (G3)

- Teacher invitation API negatives: unauthenticated create `401`; Teacher B creating for Teacher C's class `403`; nonexistent class `404`.
- Student invitation API negatives: Student attempting create `403`; invalid code `404`; expired, revoked, and exhausted invitation binds `409`. A suspended/inactive teacher enrollment also returned `409` without consuming a use.
- Duplicate bind returned `alreadyBound=true`; `usedCount` and active enrollment count remained `1`.
- The T021 flow dropped a committed bind response and a school-select response. The Profile showed “绑定状态待核实”, retained the committed records, and resolved state through GET/recheck; it did not blindly consume another invitation use.
- T021 omitted optional statistics only at the browser response boundary after a real API read: the Profile showed `—`. The real empty database/API response explicitly returned zero and the Profile showed `0` with the “server explicitly returned 0” note.
- Class student invitations are filtered by class ID. Expired/revoked/exhausted codes are masked and not offered as usable. The AI Tools coworker invitation remains a separate feature: when its endpoint failed, no static `TCH-...` code was displayed or copied and no success was claimed.
- Account and school changes cleared the teacher invitation ticket. The Profile switched A→B without stale class rows; Student B could not read Student A's school profile (`403`).

## Responsive UI, accessibility, and original visuals (G4)

Chromium captured Teacher Home, class invitation, and student Profile at **390, 768, 1280, and 1440 px**. The screenshots and measured widths are under [`screenshots/`](screenshots/), [`t023-browser-flow/`](t023-browser-flow/), and [`t021-profile-isolation/screenshots/`](t021-profile-isolation/screenshots/). Teacher Home document width equaled each viewport; the T023 invitation dialog and copy button stayed inside all four viewports; T021 Profile had no horizontal overflow at any breakpoint.

The screenshots preserve the T024 Teacher Home highland cover, T023 self-drawn invitation ticket, and T021 paper/growth/pathway Profile visuals. The T023 dialog has an accessible label; Tab remained in the dialog, Escape closed it and restored focus, and reduced motion was emulated. The Profile's invitation form was submitted with Enter; its live status was checked. The T021 reduced-motion transition was effectively zero (`0.00001s`).

## Test matrix

| Check                                                                     | Result                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T024 frontend baseline, merged workspace                                  | `67 passed / 0 failed / 0 skipped`                                                                                                                                                                                                                     |
| T023 invitation UI contract                                               | `4 passed / 0 failed / 0 skipped`                                                                                                                                                                                                                      |
| Targeted TeacherInvitation + class/supplementary/review API regression    | `48 passed / 0 failed / 0 skipped`                                                                                                                                                                                                                     |
| Full API suite, final run without optional database-only integration URLs | `1101 passed / 0 failed / 64 environment-gated skipped`                                                                                                                                                                                                |
| Contracts/OpenAPI                                                         | `6 passed / 0 failed / 0 skipped`; Redocly validation passed                                                                                                                                                                                           |
| Prisma validation                                                         | Passed; existing `SetNull`/required-relation warning remains                                                                                                                                                                                           |
| Monorepo typecheck                                                        | Passed for all 6 applicable workspace projects                                                                                                                                                                                                         |
| Monorepo build                                                            | Passed for all 6 applicable workspace projects                                                                                                                                                                                                         |
| Native T026 Chromium/API/PostgreSQL 17/Redis/MinIO E2E                    | `1 passed / 0 failed / 0 skipped`; MinIO upload/read-back/signed-GET smoke passed                                                                                                                                                                      |
| T024 original cross-role Chromium suite                                   | `NOT_RUN`: it includes simulated microphone media and its full Question Bank import setup; T026's no-fake-media requirement and protected source boundary made it unsuitable. The targeted class/review API suite and T026 native journey ran instead. |

The final full API command omitted `DATABASE_URL` and `QB_RUNTIME_DATABASE_URL`, so the repository's database-only integration tests were skipped as designed; the T026 native E2E used the live T026 database. An earlier exploratory API invocation pointed those suites at the already-stopped T026 port and failed its integration setup; the corrected final suite above passed. The targeted TeacherInvitation/class/review suites passed after the fresh worktree's Prisma client was generated and database package built.

Two accepted T023 test expectations predated the merged T021/T024 UI wording. The T026 adapter asserted the current Profile success copy (“已加入该班级”) and the current personalized Today/empty-course copy while leaving the actions, live API calls, and success/error states under test. No product source or shared API/contract was changed to accommodate those old assertions.

Superseded attempts were kept separate from the final result: the first browser runs stopped at those outdated T023 assertions; one rerun with redundant extra T021 navigation instrumentation stopped progressing after the Profile screenshots, so its recorded T026 test process group was stopped through the T026 ownership helper. That instrumentation was removed while keeping the real T023 shared-nav clicks. A MinIO startup collision on the first API/console pair led to moving only T026 MinIO to verified-free ports `59326/59327`; no other process was stopped. The final run then passed and exited `0`.

## Runtime, process exit, and protected work (G5)

- T026 owned `yuzan_t026_native` / `yz_t026`, bucket `yz-t026-native`, Node `v24.20.0`, pnpm `10.13.1`, PostgreSQL `17.11`, Redis `7.4`, MinIO, and Chromium `153.0.8010.52`. The worker was not started.
- Final T026 ports: API `4126`, Web `4326`, PostgreSQL `55686`, Redis `6486`, MinIO API/console `59326/59327`. The earlier MinIO allocation `59286/59287` collided during startup; after a port-in-use exit, T026 selected and checked the new pair. No other process was stopped.
- [`native-runtime-summary.json`](native-runtime-summary.json) records the owned PIDs, test PID exit, all six ports free after stop, T026 database/MinIO retention, and `testExitCode=0`.
- No Docker, Compose, P1-SIM, worker, microphone, audio/video fixture, or automatic scoring was used. The historical L4 shared-default PostgreSQL volume incident remains `OPEN`; it was not inspected.
- The T005 shared checkout remained on `feat/question-bank-v1@9c77c8c` with its pre-existing 15 tracked edits and untracked bilingual/course resource paths; none was written, staged, or imported by T026. T021/T023/T024 source worktrees remained clean. T022 and T025 were not edited or stopped. T027's separate worktree still had its own nine pending paths and its MinIO listener remained on `59004/59005` at the final read-only check. T028 and every other sibling branch/worktree were not merged or modified by this task.

## Merge readiness

T026 is **READY_TO_MERGE** on `feat/yz-rd-t026-onboarding-rolling-web`. The task branch was pushed to `origin` and verified `0 ahead / 0 behind`; the shared `feat/question-bank-v1` branch was not changed. No remaining key button path is blocked. Product pilot, production release, live school accounts, and microphone/scoring validation remain outside this WEB_ONLY task.
