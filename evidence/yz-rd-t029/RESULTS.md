# YZ-RD-T029 Results

**STATUS: BLOCKED** — the T026 + T028 integration and native browser journey pass. The repository-wide API lint gate still fails on the wider API baseline; the exact T028 controller/service files lint cleanly. T029 is pushed on its own branch and is not merged into shared T005.

## Git and contract integration

- T026 source: `feat/yz-rd-t026-onboarding-rolling-web@2416577aeddcca7ebd45ff9c64ff702adb69c79d` (clean, upstream 0/0 before integration).
- T028 source: `feat/yz-rd-t028-teacher-invitation-revocation@bfae13ab315bee532842cffe4fdd6c142cb8a488` (clean, upstream 0/0 before integration).
- Actual merge base: T023 `34af873837c9cfb74a7be33e94617b94668b4f4d`.
- T029 merge commit: `f292c6bfa5d753ecab9e3dc316c1459fbe97e2dc`, parents exactly T026 `2416577…` and T028 `bfae13a…`. T024, T021, T023 and the earlier T020 history remain reachable through T026. No cherry-picks were used.
- Git `ort` merged the three files changed on both sides without textual conflict markers: `frontend/assets/api-client.js`, `packages/contracts/openapi/openapi.yaml`, and `packages/contracts/src/generated.ts`. I reviewed each side against the T023 base and checked the merged methods, DTOs, and operations. No side was selected wholesale and no hand-edits were needed after Git's clean merge.
- The merged API client retains T026 `addCourseFavorite` (PUT) / `removeCourseFavorite` (DELETE), along with the compatibility POST toggle, and adds T028 `revokeTeacherInvitation` (POST). OpenAPI and generated types retain the course favorite operations and response DTO while adding revoke and nullable/redacted `TeacherInvitationResponse.code`. OpenAPI generation completed with no generated-file diff. `git diff --check` passes.

## Native merged browser and database proof

Final run: **1 passed, 0 failed, 0 skipped**, in one T029-owned native runtime using Node 24.20.0, pnpm 10.13.1, PostgreSQL 17.11, Redis 7, MinIO, NestJS API, frontend server, and Chromium. The accepted T026 and T028 source journeys both ran against the same T029 PostgreSQL database; this is not a reuse of their old logs or runtimes.

- Teacher C logged in, opened their authorized class from Teacher Home, generated the server-issued class invitation, tested denied clipboard permission and successful clipboard copy, and used the real invitation UI.
- Student A bound through the actual T021 Profile form before revoke. Teacher C clicked revoke and confirmed. The browser response was dropped after the server committed; one GET reconciled the UI to REVOKED, with no blind POST retry. A repeated revoke returned REVOKED and did not add another audit.
- Student A retained one ACTIVE Enrollment and refreshed Today successfully. With no real Assignment in this fixture, Today showed its real no-task / no-open-practice empty state. Student A clicked Course navigation and returned to Today.
- Student B's Profile bind with the old code returned 409, created no Enrollment, left Membership unchanged, and did not increment old-code `usedCount`. Teacher C generated a replacement code; Student B bound through Profile with 201 and received an ACTIVE Enrollment. Teacher C's real roster displayed both A and B (3 total rows because the deterministic bind-first race also enrolled Student C).
- SQL confirms invitation `38d6c491-dba9-4f59-801e-2a49b10cb8bf`, `revokedAt`, `usedCount=1`, one `TEACHER_INVITATION_REVOKED` row `55d42e5d-efaa-4738-8f0d-b599e0eb6ddc`, and ACTIVE enrollments for A and B. The audit summary timestamp is UTC `2026-10-19T05:19:25.839Z` and request ID `45ec8bbf-389e-4712-bc7e-9100e24db02e`. The query output is in [`sql/t029-merged-invitation-records.txt`](sql/t029-merged-invitation-records.txt); full dynamic records and API events are in [`t028/t028-browser-database-evidence.json`](t028/t028-browser-database-evidence.json).
- Deterministic bind-first race returned bind 201 / revoke 200 and retained the student's ACTIVE Enrollment. Revoke-first returned revoke 200 / bind 409, with no Enrollment or use increment and exactly one audit.
- Real route negatives: malformed UUID 400; unauthenticated revoke 401; student, Teacher B in another class, and cross-school teacher 403; missing invitation 404; expired, exhausted, and revoked invitation bind/revoke 409. Teacher account and school switching cleared the previous invitation from the page.
- Clipboard denial selected the actual token field and showed no false success; a later successful copy placed the server-issued code on Chromium's clipboard. Tokens are masked in screenshots and evidence.
- Teacher C opened and closed the real invitation dialog at 390, 768, 1280, and 1440 widths; each viewport had no horizontal/dialog overflow, and screenshots mask the active replacement code. The revoke screenshots show no code, copy, or revoke control after confirmation. Keyboard focus loop, Escape cancellation, labelled dialog, and reduced-motion checks passed.

See [`native-e2e-summary.json`](native-e2e-summary.json), [`native-runtime-evidence.json`](native-runtime-evidence.json), the nested T026/T028 evidence, and [`screenshots/`](screenshots/). T026's accepted responsive Profile/Home/invitation screenshots are under `t026/`; T028's post-revoke screenshots are under `t028/`.

## Checks

| Check | Result |
|---|---|
| T029 native Chromium + API + PostgreSQL + MinIO | PASS — 1 / 0 / 0 |
| T026 browser onboarding + T021 Profile isolation, same T029 runtime | PASS |
| T028 invitation revocation browser journey, same T029 runtime | PASS |
| Frontend full suite | PASS — 72 / 0 / 0; runtime verification passed |
| API invitation + course-favorite targeted specs | PASS — invitation 11, favorites 32; 43 / 0 / 0 |
| Full API suite | PASS — 1,109 passed, 64 environment-gated skipped, 0 failed (73 files passed, 10 skipped) |
| Contracts | PASS — Redocly lint, generation, 6 tests, TypeScript check |
| Frontend lint | PASS |
| Merged invitation controller/service ESLint | PASS |
| Full API lint (`pnpm --filter @yuzan/api lint`) | **FAIL** — 1,201 errors and 1 warning across the full API lint target, including existing unrelated source diagnostics and test files rejected by the configured TypeScript project service. The invitation controller/service alone lint cleanly; the invitation spec cannot be linted by this config because `backend/api/test` is excluded from its project service. No unrelated API files or ESLint configuration were changed. |
| Workspace typecheck | PASS |
| Workspace build | PASS |
| Prisma validate | PASS — supplied a non-connecting task-local `DATABASE_URL` required by Prisma config |
| Python runner/E2E syntax | PASS |
| `git diff --check` | PASS |

API favorite PUT/DELETE idempotency and authorization are covered by the 32-test `student-courses.service.spec.ts`; the full Frontend suite also passed. The full repository `pnpm test` aggregate was NOT_RUN; its frontend, API, and contract suites were run individually as listed above. Physical-device testing, production pilot, and production launch remain NOT_RUN.

## Retries and unresolved checks

- Native test iterations before the final pass: one stale T028 Profile wording assertion (actual merged Profile success was correct), one T029 SQL evidence UUID/text comparison error after the business assertions passed, and one successful native pass before adding the four-viewport dialog clicks. Both harness issues were corrected only in T029's own test.
- MinIO twice reported its first T029 port pair `59270/59271` already in use before browser tests started. No owner was stopped or data deleted. T029 moved only its MinIO ports to the checked-free `59429/59430` pair; the final run verified MinIO health HTTP 200 and bucket `yz-t029-native` ready.
- Lost-response count in the passing browser flow: one committed revoke response dropped, one GET reconciliation, zero automatic POST retries; explicit duplicate revoke count: one, with audit count still one. Unresolved business/API statuses: 0.
- Full API lint is the sole failing required gate and is why this result is BLOCKED despite the functional integration passing.

## Scope protection and runtime exit

- T005 shared `feat/question-bank-v1` remains at `9c77c8cd35ffd45d6a164cc7a4ec616c3345fd15` with the same 15 modified tracked paths and 5 untracked entries (four bilingual files plus the learning-resource directory). Its `.env` was not read or changed. No shared merge, stash, reset, clean, `git add .`, Docker, Compose, or P1-SIM was used.
- T026 and T028 source worktrees remain clean at their accepted SHAs. T025 and T027 remain clean at `c085ac2f15df90ddfdf0ccde7600e53aa31e860f` and `deede5b767da8b067c6b51d754039e265e55fe34` respectively. T030/T031/T032 worktrees and their in-progress files/services were left untouched.
- Final T029 service PIDs recorded before stop: PostgreSQL 2524553, API 2524906, Web 2524956, Redis 2524591, MinIO 2524603, pytest 2525004. Pytest exited 0; all six T029 ports (4129, 4329, 55829, 6469, 59429, 59430) are free. T029 database and MinIO bucket/data are retained; worker was not started.
- No Docker/Compose/P1-SIM was used. The historical L4 Docker Postgres volume incident remains OPEN and was not inspected. This branch is not merged into shared T005.
