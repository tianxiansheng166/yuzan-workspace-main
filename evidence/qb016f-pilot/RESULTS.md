# QB-016F Pilot feedback and PostgreSQL evidence

Date: 2026-08-24

## Runtime

- Compose project: `qb016f-pilot-20260824a`
- Database: `qb016f_pilot`
- API: `http://127.0.0.1:4020`
- Frontend: `http://127.0.0.1:4181`
- Redis port: `6394`
- MinIO API port: `59022`
- Shared `p0-integration`: **NO**
- Runtime was torn down after verification. Existing `p0-integration` and
  `qb015-release` containers remained running and unchanged.

## Migration and bootstrap

- `20260824130000_add_pilot_feedback`: **APPLIED** on a fresh database.
- Prisma generate/validate: **PASS**.
- Seed and existing six-level Question Bank bootstrap: **PASS**.

## PostgreSQL

`backend/api/test/pilot/pilot.runtime.integration.spec.ts`: **1 passed, 0 skipped**.

The real database proof covered STANDARD/REMEDIATION aggregation, feedback
create/mine/admin resolution, speech failure warning, and scoped service
behavior.

## Chromium

`tests/e2e/assessment/test_qb016_pilot_feedback.py`: **1 passed, 0 skipped**.

`QB_RELEASE_BASE_URL` pointed to `http://127.0.0.1:4181`. The browser created a
Level 1 attempt, submitted feedback, showed it in student history, acknowledged
and resolved it in `/admin/pilot`, then reloaded the student Runner and showed
the resolved state and resolution note.

## Runtime smoke and privacy

- `/health/live`: **200**
- `/health/ready`: **200**
- Admin pilot overview: **200**, worker `UP`
- Admin pilot page: **200**
- Anonymous/student/cross-school pilot overview: **denied**
- PilotFeedback row: **1** real row in the isolated database
- Forbidden answer, rubric, source/provider, transcript/audio, IP, and device
  fingerprint keys: **none**

## Regression

- Pilot module tests: **10 passed**
- Existing Course Submission Feedback tests: **20 passed**
- API full Vitest: **1021 passed, 63 skipped**
- API typecheck/build: **PASS**
- Frontend test/build: **PASS**
- Worker: **NOT TOUCHED** in QB-016F; existing worker build and prior 54-test
  gate remain recorded in `CURRENT_HANDOFF.md`.
