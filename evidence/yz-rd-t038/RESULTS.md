# YZ-RD-T038｜口语练习、模拟练习与专项训练闭环

- `TASK_ID`: `YZ-RD-T038`
- `STATUS`: `VERIFIED / NATIVE_CHROMIUM_API_POSTGRESQL17_MINIO / READY_TO_MERGE`
- `BRANCH`: `feat/yz-rd-t038-speech-practice-exam-showcase`
- `START_SHA`: `39c01598e687f020037c82c23e3e0cfd7029ba64`
- `FINAL_SHA`: Git HEAD is authoritative; returned separately with the pushed checkpoint.
- `L4_OPEN`: `OPEN`

The target checkout's `AGENTS.md` has no `AA-DEV-V2.2` marker. I followed the supplied T038 task card and `/home/tian/code/AGENTS.md` safety baseline. Work stayed in the exact T038 worktree and branch. No Docker/Compose, force Git operation, T005 worktree edit, other development worktree edit, L4 data access, or Tibetan subtitle publication occurred.

## Required outcomes

| Field | Result | Evidence |
| --- | --- | --- |
| `REAL_SPEAKING_PRACTICE` | PASS — the authenticated student entered `/student/practices/`, used the oral entry to request `requiresRecording=true`, then opened the authorized seeded `停顿与节奏专项训练` (`70000000-0000-4000-8000-000000000003`). | Browser/API request log and `e2e-summary.json` |
| `MOCK_MODE` | PASS — the portal made a server request with `catalogType=MOCK`; the result list contained only MOCK definitions and the page said the exercise is not an official exam and does not produce official results. | Browser/API request log and catalog screenshots |
| `REMEDIATION_MODE` | PASS — the portal switched to server `catalogType=SPECIALIZED`; the real `停顿与节奏专项训练` appeared. | Browser/API request log and `e2e-summary.json` |
| `RECORDING_AND_SUBMISSION` | PASS — real question prompts rendered, sample audio played, two simulated-browser recordings were previewed, uploaded, and confirmed by the API. MinIO `HeadObject` read back both WebM/Opus objects at 24,446 bytes each. An answer save and a signed MinIO PUT were interrupted once and recovered through the UI. Exactly one submit POST occurred; duplicate API submit returned the same Attempt. | SQL/object-storage proof in `e2e-summary.json`; runner screenshots |
| `REPORT_AND_REVIEW` | PASS — submitted speech jobs remained `CREATED` without diagnostics or scored speech items; the separate formal report fixture appeared in the teacher queue as `PENDING`. A teacher manually reviewed its recording through the existing API; the server generated a 100%-complete report with 20/20 scored items. The student opened it through the history link and saw the AssessmentReview comment. | `e2e-summary.json`; formal report screenshot |
| `CHROMIUM_API_PG_MINIO` | PASS — Google Chrome 153.0.8010.52, NestJS API, PostgreSQL 17.11, Redis, and MinIO. Dedicated T038 ports: API 4138, Web 4338, PostgreSQL 55668, Redis 6468, MinIO 59260–59261; bucket `yz-t038-native`. API readiness and storage upload/read-back/signed-GET smoke passed. Worker stayed stopped. | Native E2E log and runtime log |
| `FOUR_VIEWPORTS` | PASS — 390, 768, 1280, and 1440 px on catalog and Runner; document width matched viewport at every width. Detail also passed at 390 and 1440 px. | Screenshots below and width assertions in the E2E |
| `IDENTITY_AND_PERMISSION` | PASS — unauthenticated request 401, cross-school 403, student review-queue request 403; another same-school student received 404 for the Attempt and 403 for the report, and their history omitted it. Denied microphone permission created no Recording. | `e2e-summary.json` |
| `READY_TO_MERGE` | YES after the isolated branch is committed and pushed; no merge was performed. | Branch and remote HEAD verified at completion |

## Submission and score authority

The T038 runtime used `SPEECH_PROVIDER=disabled`, no Worker, and Chromium's explicitly identified `SIMULATED_MIC` source. The oral practice finished in `PROCESSING`; its two SpeechJobs remained `CREATED`, had no result, no formal report was created, and no speech item received a score. This is the real configured server behavior, not a generated score.

The completed-report proof used dynamic `TEST_FIXTURE_ONLY` question-bank items and a published practice delivery in the isolated T038 database. The 19 choice answers were deterministically incorrect; the sole speech score came from an explicit teacher review with a test-only comment. The resulting zero is local QA evidence and is not a learner result or evidence of automatic speech scoring. Test fixture rows and MinIO objects remain only in the isolated T038 runtime for audit.

## Evidence files

- Native Chromium/API/PG/MinIO run and service output: [chromium-api-pg17-e2e.log](chromium-api-pg17-e2e.log)
- Dynamic IDs, API filters, status, SQL/MinIO checks, identity and responsive proof: [e2e-summary.json](e2e/e2e-summary.json)
- Catalog: [390 px](e2e/catalog-390.png), [768 px](e2e/catalog-768.png), [1280 px](e2e/catalog-1280.png), [1440 px](e2e/catalog-1440.png)
- Practice detail: [390 px](e2e/detail-390.png), [1440 px](e2e/detail-1440.png)
- Runner: [390 px](e2e/runner-390.png), [768 px](e2e/runner-768.png), [1280 px](e2e/runner-1280.png), [1440 px](e2e/runner-1440.png)
- Formal report: [1440 px](e2e/formal-report-1440.png)

## Checks and remaining gates

- PASS: `pnpm --filter @yuzan/frontend test` — 92 passed, 0 failed, 0 skipped; frontend runtime verification passed.
- PASS: T038 native Chromium E2E — 1 passed, 0 failed, 0 skipped; final evidence run completed against the native API, PostgreSQL 17.11, and MinIO.
- PASS: database client generation, all 32 migrations on the new T038 database, bootstrap seed, API build, API readiness, MinIO storage smoke, Python compilation, and `git diff --check`.
- PASS: T038 services stopped through the task-aware runner; all six T038 ports were closed. Isolated database/object evidence was retained.
- Operational note: a post-shutdown attempt to rerun only to add an Attempt ID to the summary stopped before test logic because PostgreSQL was no longer running. A subsequent task-runtime startup retry timed out waiting for API health; owned processes were stopped/cleared and port checks are free. The recorded full E2E pass and evidence above are from the successful run before shutdown.
- `NOT_RUN`: physical microphone/device coverage, calibrated or production automatic speech scoring, school pilot, and production launch. Tibetan subtitle review/publication is not applicable; no Tibetan subtitles were edited or published.
- `PASS_FAIL_SKIP_NOTRUN`: final gates PASS; FAIL=0; SKIP=0; remaining NOT_RUN gates are listed above.
