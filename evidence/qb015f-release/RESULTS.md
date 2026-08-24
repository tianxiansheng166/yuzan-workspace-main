# QB-015F Release Evidence Closure

Date: 2026-08-24

Compose project: `qb015f-release-20260824d`

Database: `qb015f_fresh`

Frontend/API: `http://127.0.0.1:4180` / `http://127.0.0.1:4019`

MinIO bucket: `qb015f-question-bank`
Shared `p0-integration` used: **NO**

The runner used fresh isolated PostgreSQL/Redis/MinIO, deployed all 28
migrations, applied the real 120-item/6-level Question Bank runtime, and tore
the runtime down after completion. `MOCK_SPEECH_SCORING=true` was scoped only
to the isolated speech process; the production shell remained unset.

## Closure results

- PostgreSQL QB-014F integration: **2 passed**.
- Teacher-assignment Chromium closure: **1 passed in 36.35s**.
- Isolated Level 1 release loop: **1 passed in 135.39s**.
- QB011/QB012/QB013 targeted Chromium regressions: **1 passed each**.
- Isolated Levels 1–6 Chromium release suite: **6 passed in 786.09s**.
- Contracts/frontend smoke: **PASS**.

The teacher-assigned READ_ALOUD path created new recordings, reached three
local `SPEECH_READING` jobs in `NEEDS_REVIEW`, kept `scoredScore` null until
teacher review, completed remediation with zero `AssessmentReport` rows, and
left the source formal result unchanged. Student-facing leak scans found no
answers, scoring specs, rubrics, provider raw/audit data, transcripts, or
candidate points.

## Reproduction

```sh
QB_RELEASE_COMPOSE_PROJECT=qb015f-release \
tests/e2e/assessment/run-qb015f-release-gates.sh
```

The runner accepts isolated port/database overrides, refuses the shared
`p0-integration` target, and writes detailed per-gate logs under
`evidence/qb015f-release/` when run with its default `QB_RELEASE_LOG_DIR`.
