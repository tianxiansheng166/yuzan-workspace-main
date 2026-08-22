# CURRENT TASK

Task: QB-005 — Deterministic non-speech scoring
Status: TODO

## Recovery state

QB-003B is complete. Validated Level 1 now flows from the canonical source
pipeline through global Resource/MinIO, immutable QuestionBankItemVersion,
the published system Practice, development-school delivery, and the real
student runner.

The current database checkpoint has one canonical Level 1 practice with 20
question-version references, 21 global media resources (15 IMAGE, 6 AUDIO),
and one open `SELF_PRACTICE` delivery for the development school/class.
Repeat Level 1 apply is idempotent and creates no duplicate Resource, item,
version, practice, or delivery.

## QB-005 boundary

Implement deterministic scoring only for non-speech Level 1 responses where
the existing server-only `scoringSpec` supports it. Do not begin speech scoring,
AI/rubric scoring, Levels 2–6 import, or any change that exposes scoring data to
students without an explicit task request.

## Useful entry points

- `corepack pnpm qb:source:apply -- --level 1` is dry-run only.
- `corepack pnpm qb:source:apply -- --level 1 --apply` is the explicit,
  idempotent Level 1 runtime apply command.
- Canonical importer: `tools/question-bank-importer/index.mjs`
- Runtime importer: `backend/api/src/modules/assessment/question-bank-runtime-import.service.ts`
- Student boundary: `backend/api/src/modules/assessment/practice.service.ts`

## Protected paths

- `pnpm-workspace.yaml` (unrelated dirty worktree change)
- `infra/database/prisma/seed.ts`
- `tests/e2e/assessment/question-bank-runner.spec.py`
- `frontend/assessment/assets/question-bank/`

Use path-scoped staging; never use `git add .` or `git add -A`.
