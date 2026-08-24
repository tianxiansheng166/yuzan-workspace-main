# CURRENT HANDOFF

Last updated: 2026-08-24
Repository: `yuzanxinsheng_test`

## Git truth

Run `git branch --show-current` and `git log -1 --oneline`; live Git results
are authoritative. Expected active branch: `feat/question-bank-v1`.

Do not infer a commit SHA from this document. The task-start dirty change in
`pnpm-workspace.yaml` is pre-existing and protected; do not stage or modify it.

## Current outcome

QB-008R and the Levels 1–6 rollout are implemented on the current feature
branch. QB-009A, QB-010, QB-011, QB-012, QB-013, and QB-014 are complete.
QB-015 release hardening is **BLOCKED / NOT_READY** pending executable release
evidence. QB-009B remains `PARKED / EXTERNAL_INPUT`; see
[`CURRENT_TASK.md`](CURRENT_TASK.md) and [`RELEASE_READINESS.md`](RELEASE_READINESS.md).

QB-015 did prove clean frozen install, 28 isolated migrations, fresh 120-item
runtime apply, zero-duplicate re-apply, 126/126 MinIO object HTTP integrity,
and full non-browser quality gates. It fixed three release issues: Prisma now
accepts a supplied `DATABASE_URL` without a root `.env`; fresh bootstrap creates
or verifies its configured MinIO bucket; legacy self-remediation uses an
explicit null-safe origin filter compatible with Prisma/PostgreSQL. Do not mark
the release READY until QB-014 real-DB assignment, Chromium, and assigned
speech-review coverage plus a clean-runtime six-level browser re-run exist and
pass.

The original DOCX/ZIP files under `local_sources/` were inspected as read-only
inputs and were not modified, moved, deleted, or staged.

## Recovery and provenance

The importer now executes:

`raw source → parser → structural recovery → explicit repair ledger → canonical
validation → immutable runtime apply`.

Structural recovery is generic and structure-driven. An unlabeled candidate
followed by `B/C/D` becomes `A/B/C/D`; two unlabeled candidates followed by
`C/D` become `A/B/C/D`. Ambiguous or unsafe patterns fail closed. Existing
`A/B/C/D` input is unchanged. Recovered values carry server-side provenance and
are never included in student payloads.

Authorized repairs are recorded in
[`content-repairs.json`](tools/question-bank-importer/content-repairs.json):

- `L1-READ-WORD_RECOGNITION-003`: structural recovery restored option `A`.
  The old published v1 remains immutable; the corrected item is published as
  v2 and the Level 1 practice as a new immutable version.
- `L2-SPEAK-READ_ALOUD-003`: exactly one reproducible
  `AI_AUTHORED_GAP_FILL` item, family `READ_ALOUD`, scoring mode
  `SPEECH_READING`, max score 4. Its trace is explicitly derived and has no
  fabricated Word paragraph range.
- An isolated Level 4 two-label omission was recovered structurally using the
  same generic rule; it is represented as `STRUCTURAL_RECOVERY` provenance.

## QB-009A speech provider boundary

- iFlytek uses the official ISE streaming WebSocket adapter with backend-only
  AppID/APIKey/APISecret configuration and HMAC request signing.
- Tencent uses the official new SOE WebSocket adapter with backend-only
  AppID/SecretID/SecretKey configuration, signed query parameters, 16 kHz
  40 ms binary frames, and an explicit end frame.
- Both adapters accept only server-prepared 16 kHz / 16-bit / mono WAV bytes,
  preserve nullable vendor dimensions, and keep raw vendor responses in
  server-side audit data only. Auth, malformed response, timeout, and provider
  configuration failures fail closed; non-transient failures are not retried.
- Cloud providers handle `SPEECH_READING` only. Open response/picture speaking
  remains on the local diagnostic route.
- Every provider result is `experimental: true`, `calibrationStatus:
  UNCALIBRATED`, `finalizable: false`, and `requiresReview: true`. The API
  policy rejects calibrated/finalizable cloud evidence and never writes a
  formal `scoredScore` from it.

## QB-009A benchmark and privacy status

- `pnpm speech:benchmark` supports manifest-driven synthetic or explicitly
  approved live runs and reports validity/failure, MAE/RMSE, Pearson/Spearman,
  tolerance bands, p50/p95 latency, and review-required rate.
- The checked-in example is synthetic only: 2 samples, 0 real samples. Cloud
  smoke was skipped as `SKIPPED_NOT_CONFIGURED`; no credentials were printed,
  committed, or used to call a provider.
- With fewer than 30 real labelled samples the report is
  `INSUFFICIENT_CALIBRATION_DATA`; formal runtime activation remains
  `DISABLED` and teacher review remains the authority.

## QB-010 deterministic diagnosis

- Only a completed standard Question Bank session with all 20 formal scores
  can persist `summary.diagnosis` with version `qb-diagnosis-v1`; partial,
  missing-metadata, or zero-max-score sessions fail closed without a diagnosis.
- The builder uses only formal `scoredScore`, `maxScore`, and immutable
  Question Bank domain, family, and level. It aggregates actual points into
  `LISTEN`, `SPEAK`, `READ`, and `WRITE`, plus the eight canonical families;
  no denominator, level rule, or provider candidate point is hard-coded.
- Bands are `STRONG` (>=85), `DEVELOPING` (>=70), and `PRIORITY`; priorities
  are deterministic (percentage asc, lost points desc, canonical family order)
  and strengths use the inverse deterministic ordering. Display names and
  guidance are fixed Chinese mappings in the backend.
- The student report DTO projects an explicit allowlist and never returns
  answers, scoring specs, rubrics, source traces, provider raw/audit data,
  transcripts, or candidate points. Existing/legacy reports return
  `diagnosis: null`.
- The student report shows domain capability cards, strengths, priorities, next
  steps, and a safe Practice Center handoff. It does not create remediation
  content; that is QB-011.

## QB-014 teacher targeted remediation assignment

- `AssessmentSession` now records nullable `remediationOrigin` and safe JSON
  `remediationFocus`; legacy nullable remediation rows are treated as
  `SELF_INITIATED`. New sessions are explicitly `SELF_INITIATED` or
  `TEACHER_ASSIGNED`, while STANDARD remains null.
- Teacher assignment is `POST /schools/:schoolId/teacher/question-bank-diagnostics/classes/:classId/remediation-assignments` and reuses `AssessmentReviewService.assertAuthorizedClass`. Every selected enrollment must be an ACTIVE STUDENT in the authorized class or the request fails closed.
- The server—not the client—selects each target's latest completed STANDARD
  session for the chosen `practiceDefinitionId`, validates its persisted
  `qb-diagnosis-v1` retry candidates against the immutable source item
  snapshot, and applies an ALL_RETRY or canonical FAMILY filter. No source or
  matching candidates yields a safe per-target skip; no empty attempt is
  created.
- The shared remediation builder makes clean subset snapshots with the exact
  source question versions. It preserves no answers, scores, recordings,
  reviewer data, speech jobs, or provider evidence. Exact active duplicates
  resume under a PostgreSQL transaction-scoped advisory lock; different focus
  values may coexist. Self-remediation searches only SELF_INITIATED/legacy
  rows, so it cannot be redirected to a teacher assignment.
- Students discover only their own teacher-assigned remediation tasks through
  `GET /schools/:schoolId/assessments/sessions/assigned-remediations`; the
  Practice Center links active tasks to the existing Runner. The dashboard
  projects only safe latest assignment state/count/focus metadata.
- Migration: `20260824110000_add_assessment_remediation_origin`.

## Runtime state

- Canonical validation: 120 items / 600 points, six levels, zero errors and
  zero warnings.
- Every level: 20 items / 100 points; `LISTEN 6/24`, `SPEAK 4/26`,
  `READ 6/24`, `WRITE 4/26`; 15 image and 6 audio bindings.
- Published practices: six canonical 20-item practices, four sections each,
  20 references each, one open delivery each. Catalog total is 12 including
  the six legacy practices.
- Media: 90 unique images and 36 unique audio resources.
- Repeated `--apply --all` runs were fully reused: resources, question items,
  question versions, practices, practice versions, sections, refs, and
  deliveries all reported zero new records on the verification reruns.
  Existing Level 1 v1 remains present and the corrected v2 is the active
  published version.
- Security audit of active canonical deliveries: 20 refs per practice, four
  sections, zero student-visible source-trace leaks.
- Completed QB reports persist the diagnosis snapshot in their existing JSON
  summary and reuse it for repeated finalization/report reads.
- QB-011 adds `AssessmentSessionPurpose` with `STANDARD` as the migration-safe
  default. A `REMEDIATION` session is created only from the student's completed
  20-item standard session and its persisted, revalidated diagnosis retry
  candidates. It reuses source practice IDs and question versions but snapshots
  only fresh, safe delivery data. Active attempts resume; a completed attempt
  allows a new round.
- Remediation uses existing response, deterministic scoring, and teacher-review
  paths. Once its subset is scored it completes without an `AssessmentReport`
  or diagnosis and keeps the source formal result immutable. Its dedicated
  result projection contains only completion and score aggregates, never
  answers, rubrics, delivery/scoring specs, or provider audit data.

## QB-012 student progress tracking

- `qb-progress-v1` is a deterministic, read-only derived view. It does not add
  a `ProgressSnapshot` table, migration, cache, or any mutation to historical
  reports, diagnoses, or item scores.
- The student endpoint is
  `GET /schools/:schoolId/students/me/question-bank-progress`. Its identity is
  derived exclusively from the active student auth context and school scope;
  no client-supplied student or session identifier can select another student.
- Formal trend includes only `STANDARD` + `COMPLETED` Question Bank sessions
  with a formal report and persisted `qb-diagnosis-v1`. It reuses the stored
  `overallScore` and diagnosis percentages; it never regenerates diagnosis or
  reads provider candidate points. Trends are grouped strictly by
  `practiceDefinitionId`. A practice-version change remains comparable within
  the level and is flagged, while cross-level results are chronological
  milestones only and never have a score delta.
- Baseline-only levels return null deltas and student wording that a second
  same-level assessment is needed. Latest same-level comparisons expose
  deterministic domain/family percentage changes (improved, stable, attention)
  from the two persisted diagnosis snapshots.
- Completed `REMEDIATION` history is grouped by its original
  `retestOfSessionId`, then sorted by `createdAt`/id into rounds. Every item is
  matched only by identical `questionVersionId`; ambiguous/missing versions,
  full-score source items, invalid scores, and max-score mismatches fail
  closed with `PROGRESS_COMPARISON_INVALID`. `MASTERED`, `IMPROVED`,
  `UNCHANGED`, and `LOWER` are scoped to that original question only.
- The student payload allowlists aggregate scores, percentages, item version
  IDs, and safe comparison states only. It never includes answers, scoring
  specs, rubrics, source traces, transcripts, provider raw/audit output, or
  provider candidate points.
- The student “学习进步” page presents separate same-level formal cards,
  listening/speaking/reading/writing and family changes, scoped remediation
  rounds, and a milestone timeline. Formal reports and remediation results now
  include a “查看学习进步” entry; existing repeat/back actions remain intact.

## QB-013 teacher diagnostic dashboard

- The read-only teacher dashboard reuses `AssessmentReviewService`'s exact
  review scope: an ordinary teacher sees only classes with an ACTIVE TEACHER
  enrollment; school/platform admins retain the existing in-school admin scope.
  Cross-class and cross-school requests are denied server-side.
- It lists only formal Question Bank practices identified from published
  `PracticeDefinition → PracticeVersion → PracticeItemRef → QuestionBankItemVersion`
  runtime relations. The selection authority is `classId + practiceDefinitionId`.
- The cohort denominator is every ACTIVE STUDENT enrollment in the selected
  class. Each student contributes at most their latest completed STANDARD
  report with a persisted `qb-diagnosis-v1`; invalid history is excluded safely
  and counted as a data-quality issue, never treated as zero.
- Domain/family cards aggregate persisted percentages only. Common difficulties
  use average percentage ascending, priority-student count descending, then the
  canonical family order; strengths use the inverse score order. Remediation is
  projected only as “专项巩固” and is never included in the formal class average.
- Student rows are display-name ordered, never score ordered. They expose only
  same-practice self deltas, safe priority/remediation summaries, and pending
  review counts. There is no rank, position, percentile, cross-level delta,
  answer, rubric, transcript, provider result, or candidate-point projection.
- `GET /schools/:schoolId/teacher/question-bank-diagnostics` returns the
  authorized selection catalog. Class and detail endpoints use batched Prisma
  reads and QB-012's `deriveQuestionBankProgress` helper; the teacher UI is
  `/teacher/diagnostics/` and links to the existing review queue.

## Verification snapshot

- QB-014: Prisma generate/validate, database build, API typecheck/build, and
  full API Vitest pass (`1011 passed`, `60 skipped`). The focused remediation
  coverage proves clean subset snapshots, exact duplicate resume, different
  focus coexistence, and explicit teacher-assigned origin. Frontend runtime
  build and contracts validate/test/typecheck pass. PostgreSQL/browser QB-014
  integration remains the recommended release-hardening proof in QB-015.

- Importer tests: `16 passed`.
- API verification: final full Vitest run `995 passed`, `58 skipped`, no
  failures; the real-DB deterministic/runtime integration run passed `3/3`
  tests.
- Worker tests: `51 passed`; provider contract, audio preparation, benchmark,
  routing-safety, and existing worker tests pass. Worker typecheck/build pass.
- Frontend tests passed.
- Speech-scoring tests: `9 passed`.
- API typecheck/build passed.
- API speech policy/service tests: `30 passed`.
- Contracts validation/test/typecheck and frontend test/build passed.
- Benchmark CLI completed with synthetic data and safe cloud skips.
- Source validation passed for `--level 1` and `--all`.
- Dry-run apply passed for `--level 1` and `--all`.
- Parameterized browser coverage exercises Levels 1–6 end to end and passed
  `6 passed in 984.34s`, including media loading, answer persistence,
  submission, teacher review, and the point-based report gate. The run used
  the repository's explicit mock speech scorer for diagnostics only.
- The Level 1 browser regression now passes through
  `tests/e2e/assessment/run-level-one-mock.sh`: four ready recordings, three
  `SPEECH_READING` and one `SPEECH_OPEN_RESPONSE` local `NEEDS_REVIEW` jobs,
  four bounded student-safe diagnostics, 14 deterministic scores, six formal
  scores pending, `PROCESSING`, and no premature report. The runner starts an
  explicit test-only mock scorer and restores a default scorer with mock unset.
- QB-007's Level 1 student-to-teacher review flow passed: `1 passed, 5
  deselected in 141.82s`.
- QB-010 Level 1 student-to-teacher completed-report flow passed: `1 passed in
  133.81s`. It verified 20/20 items, 100 max points, four domains/eight
  families, no diagnosis leakage, a formal 84/100 result, `READ_ALOUD` then
  `PICTURE_SPEAKING` priorities, and the rendered student capability cards.
- QB-010 diagnosis unit/security/scoring coverage passed, including perfect and
  weak cases, tie ordering, zero score, zero max/missing metadata rejection,
  teacher-final speech authority, deep deterministic equality, levels 1/3/6,
  partial and 19-of-20 sessions.
- QB-011 remediation unit/security coverage, real-DB runtime integration, and
  a Chromium browser journey passed. The browser proof creates the retry from
  the source report, runs exactly four selected questions, persists that subset
  across refresh, and verifies the “本次巩固” result does not expose answer or
  scoring configuration fields.
- QB-012 progress unit/service coverage passed (`6` tests), including baseline
  handling, same-level delta, version change, domain/family changes, processing
  exclusion, provider-data exclusion, exact-match remediation states, multiple
  rounds, ownership, and fail-closed mismatches.
- QB-012 real PostgreSQL integration passed: Level 1 `84 → 91`, one four-item
  remediation with three mastered items, and an independent Level 2 baseline.
  The source formal item scores remained unchanged.
- QB-012 Chromium E2E passed through
  `tests/e2e/assessment/test_qb012_progress.py`: the real student page showed
  Level 1 `比上次提高 7 分`, domain changes, `4 道题，3 道已掌握`, scoped
  recovered points, a separate Level 2 baseline, and links back to both the
  formal report and remediation result.
- Final API regression without broad integration-DB opt-in: `1006 passed`,
  `60 skipped`; API typecheck/build, contracts validation/test/typecheck, and
  frontend test/build passed.
- QB-013 service/security coverage passed (`4` focused cases): own versus other
  class and cross-school scope, catalog admin scope, five-student cohort
  denominator (`3` assessed / `1` processing / `1` unassessed), latest-only
  `84 → 91` self delta, remediation isolation, mixed versions, four domains,
  eight families, deterministic ordering, review counts, no ranking, no
  sensitive-field leakage, and no dashboard N+1 loops.
- QB-013 Chromium E2E passed through
  `tests/e2e/assessment/test_qb013_teacher_diagnostics.py`: isolated Class A
  showed 5 eligible, 3 assessed, 1 processing, 1 unassessed, 60% coverage,
  81-point average, four domains/eight families, one pending review, Student 1
  `+7`, remediation summary, detail view, and a 403 request for Class B.
- QB-012 student-progress Chromium regression passed again (`1 passed in
  8.20s`). The QB-007 browser fixture now self-provisions missing active
  student/teacher membership rows for an isolated local test database.
- QB-007 Level 1 browser regression passed again (`1 passed, 5 deselected in
  134.49s`) through the explicit mock-scorer runner. A processing-page scope
  error for `isRemediation` was corrected; the runner restored the default
  local scorer with `MOCK_SPEECH_SCORING` unset.

## Known limitations and next task

Local and cloud speech diagnostics remain experimental and uncalibrated; they
do not produce formal automatic rubric scores. The former stale Level 1 browser
assertions have been replaced with the current `SPEECH_READING` plus
`SPEECH_OPEN_RESPONSE` semantics and pass under the explicit controlled mock
runtime. The default scorer is restored with `MOCK_SPEECH_SCORING` unset.

QB-009B remains `PARKED / EXTERNAL_INPUT`: it needs approved consented
recordings, teacher labels, credentials if live smoke is approved, and a
separate product decision. The next implementation task is QB-015: release
targeted remediation assignment. It must keep QB-013's class scope, no-ranking
boundary, formal/remediation isolation, and student privacy controls intact.

## Protected paths

Do not modify or stage `pnpm-workspace.yaml`, `infra/database/prisma/seed.ts`,
`tests/e2e/assessment/question-bank-runner.spec.py`, or
`frontend/assessment/assets/question-bank/`. Never modify original files under
`local_sources/`.
