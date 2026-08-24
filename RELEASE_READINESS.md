# Question Bank release readiness — QB-015

Date: 2026-08-24
Evidence base HEAD: `cea0d99` (`feat/question-bank-v1`, functional closure checkpoint)

## Decision

**READY_FOR_PILOT**. The four QB-015F release blockers are closed by executable
evidence in an isolated runtime. This approves a controlled pilot/staging run
only; it is not production certification, an official examination, or a claim
of calibrated speech accuracy.

This product remains a national common-language ability learning, simulated
assessment, and learning-diagnosis product. It is not an official Putonghua
examination, national-level certification, or certificate issuer.

## QB-015F executable closure evidence

- Runtime identity: Compose project `qb015f-release-20260824d`, PostgreSQL
  database `qb015f_fresh`, API `http://127.0.0.1:4019`, frontend
  `http://127.0.0.1:4180`, Redis port `6393`, MinIO port `59028`, bucket
  `qb015f-question-bank`. Database/container/project isolation was asserted;
  shared `p0-integration` was not used. The isolated runtime was torn down
  after the final run.
- QB-014 real PostgreSQL integration:
  `backend/api/test/assessment/qb015f.teacher-assignment.runtime.integration.spec.ts` —
  `2 passed`. It proves two students, exact per-source question-version
  snapshots, duplicate `RESUMED`, different-focus coexistence,
  `SELF_INITIATED` separation, class/school/role scope denial, and assigned
  READ_ALOUD review closure.
- QB-014 deterministic Chromium:
  `tests/e2e/assessment/test_qb015f_teacher_assignment.py` — `1 passed in
  36.35s`. Teacher assignment, student-only assigned task, existing Runner
  subset, refresh restoration, deterministic completion, safe result, and
  teacher dashboard `COMPLETED` state all passed.
- Assigned READ_ALOUD: the same Chromium evidence created new recordings,
  drove local controlled speech through Worker/API, produced three
  `SpeechJob=NEEDS_REVIEW` records with `provider=local` and
  `SPEECH_READING`, kept candidate points out of formal scores, completed only
  after teacher review, created zero remediation `AssessmentReport` rows, and
  left the source formal report/scores/diagnosis unchanged.
- Isolated Level 1 release loop:
  `tests/e2e/assessment/test_qb007_picture_review.py -k '1'` — `1 passed`;
  QB011, QB012, and QB013 each passed in the same runner.
- Isolated parameterized Levels 1–6:
  `tests/e2e/assessment/test_qb007_picture_review.py` — `6 passed in
  786.09s`. The controlled mock scorer was enabled only in the release speech
  process; the production shell had `MOCK_SPEECH_SCORING` unset.
- Tracked runner: `tests/e2e/assessment/run-qb015f-release-gates.sh` refuses
  the shared project, applies the real six-level runtime, runs all closure
  gates, and records non-secret runtime identity. A concise result record is
  in `evidence/qb015f-release/RESULTS.md`.

## Cold-start and toolchain evidence

- Clean detached worktree: `/tmp/yuzan-qb015-release`, based on `04af580`;
  `git status --short` was empty before verification.
- Node `v24.19.0` (engine `>=24 <27`), pnpm `10.13.1`, Docker `29.1.3`,
  Docker Compose `2.40.3`; `.nvmrc` is `24`.
- `corepack pnpm install --frozen-lockfile`: **PASS** without reusing the
  original worktree's `node_modules`.
- `git diff --check`: **PASS** in the clean worktree. `local_sources/` remains
  ignored and was read through a read-only worktree symlink only.

## Migrations and fresh runtime

- Isolated PostgreSQL database: 28 migrations from an empty schema:
  **PASS**. Latest migration is
  `20260824110000_add_assessment_remediation_origin`.
- A representative QB-014 state (the latest migration record and its columns
  removed only in an isolated clone) upgraded forward with `migrate deploy`:
  **PASS**.
- Shared development database audit: exactly the latest migration is pending;
  Prisma reported no checksum mismatch or schema drift. Classify it as
  **DOCUMENTED_DEV_DB_DRIFT**, not a production workaround. Production deploys
  must use `prisma migrate deploy` against a backed-up database; never edit
  `_prisma_migrations`, alter an old migration, or use `migrate resolve` to
  hide drift.
- `prisma generate`, `prisma validate`, and database build: **PASS**. Prisma
  emits its existing referential-action warning; it is not new QB-015 drift.
- Fresh MinIO had no bucket. Question Bank bootstrap now idempotently verifies
  or creates only its configured bucket before upload; permission/endpoint
  failures remain explicit.

## Question Bank integrity

- `pnpm test:question-import`: **17 passed**.
- `pnpm qb:source:validate -- --all`: **PASS** — 6 levels, 120 items,
  600 points, 90 images, 36 audio, 0 errors, 0 warnings.
- Fresh apply to isolated PostgreSQL/MinIO: **PASS** — 120 canonical items,
  120 versions, 6 published Question Bank practices, 90 image and 36 audio
  Resources.
- Second `apply --all`: **PASS** — 0 new Resource, QuestionBankItem,
  QuestionBankItemVersion, PracticeDefinition, PracticeVersion, delivery,
  section, and item-reference records.
- SQL integrity audit: 120 canonical published versions; 6 published practices;
  every practice has 20 published references and 100 points; 0 unsafe delivery
  specs; 0 invalid EXACT_CHOICE reference keys.
- Automated media gate HEADed and HTTP-GETed all 126 signed MinIO objects:
  **126 checked, 0 failures**, correct bytes and content types.

## Verified quality and safety gates

- Contracts validate/test/typecheck: **PASS** (6 generator tests).
- API typecheck/build: **PASS**. Full unit suite: **1011 passed, 62 skipped**.
- Focused real PostgreSQL QB tests: deterministic scoring, progress, runtime
  delivery, and remediation: **5 passed** after the remediation fix.
- Worker test/typecheck/build: **51 passed**.
- Python speech tests: **9 passed**. Frontend test/build: **PASS**.
- Speech policy remains safe: default `.env.example` is
  `SPEECH_PROVIDER=disabled`; `MOCK_SPEECH_SCORING` is not a production default;
  local/iFlytek/Tencent evidence is uncalibrated, review-required and cannot
  write a formal `scoredScore` automatically. Missing cloud credentials leave
  cloud providers disabled rather than silently simulating a cloud result.
- Student-safe Question Bank unit/security tests passed; delivery snapshots
  exclude answers and scoring specs. Existing class and tenant authorization
  tests passed in the full API suite.

## Content provenance disclosure

- Level 1 has one missing `A` choice label recovered structurally.
- Level 4 has one `A`/`B` choice-label structural recovery.
- Level 2 has one authorised `READ_ALOUD` `AI_AUTHORED_GAP_FILL` item.

These are validated, server-side provenance records and are not exposed in
student delivery payloads. They are not release blockers.

## Closure status

1. Real PostgreSQL QB-014 assignment: **PASS**.
2. Deterministic QB-014 Chromium assignment: **PASS**.
3. Teacher-assigned READ_ALOUD review closure: **PASS**.
4. Isolated Level 1 and Levels 1–6 Chromium release run: **PASS** (`6/6`).

## Operator checklist for a later pilot approval

- Provision PostgreSQL, Redis, S3-compatible storage/MinIO, API, worker, and
  frontend. Supply `DATABASE_URL`, `SESSION_SECRET`, `WEB_ORIGIN`, S3 endpoint,
  bucket, region, access key ID, and secret access key through the deployment
  secret manager; do not put values in this repository.
- Take and verify a PostgreSQL backup before `prisma migrate deploy`. Prisma
  migrations are forward-only: on failure restore the backup or deliver a
  corrective forward migration; there is no `prisma migrate rollback` command.
- Preserve Question Bank MinIO media during database migration. Run the source
  validator, bootstrap apply, catalog/report/progress/teacher-diagnostic smoke
  checks, and health checks for API, PostgreSQL, Redis, MinIO, frontend, and
  worker.
- Keep speech formal scoring teacher-reviewed. QB-009B remains
  `PARKED / EXTERNAL_INPUT`; no live iFlytek/Tencent credentials or calibration
  data were used in this audit.

## Known limitations

1. Local speech diagnostics are experimental and uncalibrated.
2. iFlytek/Tencent adapters are uncalibrated and no live credentials were used.
3. Formal speech scores remain teacher-reviewed.
4. The Level 2 AI-authored gap fill and Level 1/4 structural recoveries remain
   provenance disclosures.
5. The shared development database is one migration behind; apply it forward
   through the normal deployment path rather than modifying history.
6. The product is a learning/simulated-assessment experience, not official
   certification.
