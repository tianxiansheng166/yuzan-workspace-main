# YZ-RD-T015 Results

## Task and Git state

- `TASK_ID`: `YZ-RD-T015`
- `STATUS`: `DONE / READY_TO_MERGE`
- `OUTPUT_BRANCH`: `feat/yz-rd-t015-student-web-rollup`
- `BASE`: T011 `4d971c9683664c09e533069ec001b00d0dc239af`
- `COMMON_ANCESTOR`: T010 `9b4340081e7d330007368062a898f4c11d29a14f`
- T011 remains the base and already contains T010. T008/T010/T011 were not re-applied.
- T012 `67e79644e341164aaaf239ad4ebc466de1cc1c38` was cherry-picked with `-x` as `f15d1aac376adcb662d13d74ef995ba383cf2f26`.
- T013 `0bfd284dd8b31d95485c0be2b2993af15afef28e` was cherry-picked with `-x` as `96b0a44ab6d20e7d0f8fb27b21f3450848d21116`.
- Git graph: `9b43400` (T010) → `4d971c9` (T011) → `f15d1aa` (T012, `-x`) → `96b0a44` (T013, `-x`) → T015 validation/evidence commit.
- Both source cherry-picks completed without conflicts. T012 and T013 changes originally had no source-file overlap.
- T015 validation/evidence commit `6de3e1b` was pushed to `origin/feat/yz-rd-t015-student-web-rollup`; remote creation succeeded. The final docs checkpoint is also pushed and its SHA is verified in the task handoff.
- This branch has not been merged into the shared branch. `READY_TO_MERGE`; `MERGED` is false.

## Integrated student flow

- Today reads the authenticated student’s API response and renders `StudentToday.primaryAction` as the primary recommendation. The T008 browser regression checks the real Today primary action and proceeds through the Today practice section, catalog, detail, and a dynamic Attempt ID.
- The T012 regression now uses the active, imported Level 1 Question Bank practice in T015. It does not reopen the legacy four-item seed practice that the existing importer closes. The same 20-item real practice is also used by T008 and T011.
- Growth renders only generated, complete reports. It reads safe `teacherFeedback.comment` values and escapes them. The Growth view does not render reviewer IDs, rubrics, answer keys, or scoring specifications.
- No API, OpenAPI, generated contract, API client, Prisma schema, or frontend server source was changed in T015. All required API operations already existed; no `API_REQUEST` was filed. T014 remains the shared API owner.

## Test results

| Area | Command / evidence | Result |
| --- | --- | --- |
| T008 legacy 20-item Chromium E2E | `tests/e2e/assessment/test_yz_rd_t008_student_history.py` via `bash tests/e2e/assessment/run-yz-rd-t015-native.sh all` | PASS, 1 test |
| T012 Runner Chromium E2E | `tests/e2e/assessment/test_yz_rd_t012_student_practice.py` via the same T015 native runner | PASS, 1 test |
| T013 Today/Growth Chromium E2E | `tests/e2e/assessment/test_yz_rd_t013_student_today_growth.py` via the same T015 native runner | PASS, 1 test |
| T011 review/report/Growth Chromium E2E | `tests/e2e/assessment/test_yz_rd_t011_web_review_feedback.py` via the same T015 native runner | PASS, 2 tests |
| Combined native runtime | `bash tests/e2e/assessment/run-yz-rd-t015-native.sh all` | PASS, all four suites; real Chromium, NestJS, PostgreSQL, Redis, and MinIO |
| T012 frontend tests | `node --test frontend/tests/assessment/student-practice-runner-t012.test.mjs` | PASS, 12/12 |
| T013 Today/Growth frontend tests | `node --test frontend/tests/assessment/t013-student-today.test.mjs frontend/tests/assessment/t013-growth-live.test.mjs` | PASS, 23/23 |
| Combined frontend suite and runtime | `pnpm@10.13.1 --filter @yuzan/frontend test` | PASS, 63/63; runtime verifier PASS |
| API regression | `pnpm@10.13.1 --filter @yuzan/api test -- test/assessment/practice.service.spec.ts test/assessment/assessment-review.service.spec.ts test/assessment/student-dashboard.today.service.spec.ts test/assessment/student-today-decision.spec.ts` | PASS, the package command ran the full suite: 1,082 passed, 64 skipped, 0 failed |
| OpenAPI and generated types | `pnpm@10.13.1 --filter @yuzan/contracts test` (with a temporary PATH shim for nested `pnpm exec`) | PASS, Redocly lint and all 6 generation tests; deterministic regenerated types matched |
| TypeScript | contracts, API, and domain package `typecheck` commands | PASS |
| Prisma schema | `pnpm@10.13.1 --filter @yuzan/database validate` with `DATABASE_URL` from the T015 private config | PASS; Prisma emitted its existing `SetNull` referential-action warning |
| JS/Python/shell syntax and whitespace | `node --check`, `python3 -m py_compile`, `bash -n`, `git diff --check` | PASS |
| T015 storage smoke | Native runtime storage suite | PASS; isolated MinIO bucket upload/read-back/signed GET |

### Resolved integration-test mismatches

- The first T008 run exposed the second, older `.today-link-card` selector in the Student B isolation step. It now follows the real Today practice-section link. Final T008 passed.
- T012’s original four-item seed exercise is intentionally closed by the Question Bank importer. The T015 E2E now selects the active 20-item practice from the real catalog and retains Runner audio, recording, failure/retry, confirmation, submit, and isolation coverage.
- The original T013 fixture created completed Question Bank attempts without valid formal reports. The real progress endpoint correctly returned `409` for that inconsistent state, so the T015 Today/Growth E2E now uses real API-created IN_PROGRESS attempts and one PROCESSING state fixture. The actual T011 review flow is the evidence for final report generation and Growth display.
- A T012 completion assertion now waits for the debounced text answer save before checking 20/20 progress. A T011 check also verifies that one saved review still leaves Growth without a formal result. Final combined native run passed all four suites.
- An initial frontend command invoked shell pnpm `11.25.0`; its automatic install guard failed with `ERR_PNPM_IGNORED_BUILDS` and temporarily added an `allowBuilds` stanza to the T015 worktree's `pnpm-workspace.yaml`. That file was restored from the clean T011 baseline, and final package checks used the pinned pnpm `10.13.1`. The final T015 diff has no workspace-config change; T005/T014 files were not touched.

## Browser, SQL, and MinIO proof

- T015 runtime: database `yuzan_t015_native`, role `yz_t015`; bucket `yz-t015-native`; PostgreSQL `55638`, Redis `6438`, MinIO `59202–59203`, API `4095`, Web `4295`.
- T015 used Node `24.20.0`, pnpm `10.13.1`, PostgreSQL `17.11`, Redis `7.4.10`, MinIO, and Chromium `153.0.8010.52`. The initial empty task database applied the existing 32 migrations. The official Question Bank importer read the protected source directory and imported 120 question/version rows and 126 media objects into T015; subsequent runs reused those records and objects.
- T008 final Attempt `68d703f6-6826-4bf1-8137-1e7a2f76a61b`: 20 items, 6 source audio clips played, 4 `SIMULATED_MIC` recordings, one browser submit POST after cancel and Escape were each verified to submit zero, 14 deterministic written scores, 0 scored speech items, 0 reports, and final `PROCESSING`. The same Attempt ID appears in submit response, processing route, and owner history. Student B received 404 for A’s Attempt.
- T012 final Attempt `cc93310f-e64c-4f2a-97b0-e7870a158913`: 20 persisted Question Bank items, real catalog/detail/Runner flow, microphone-denial negative, answer-save retry, signed PUT tamper returned 403 with no object before retry, network-interrupted PUT recovered, one browser submit POST, 4 recordings/4 distinct SpeechJobs, 0 speech scores, 0 reports, and final `PROCESSING`.
- T013 final fixture Attempt IDs: IN_PROGRESS `b082376f-beb6-4d8f-8baf-60d8f27d6dee`; PROCESSING `7e3697ae-4716-43f9-adde-f8f2c3be9bcc`. The Processing state in this E2E is explicitly a fixture projection, not claimed as a completed submit workflow. The T008/T011 browser paths verify real state transitions.
- T011 final Attempt `9b2f6183-d1b9-438c-93a4-c77ad6b3aa31`: 20 items, 4 real MinIO recordings and 4 SpeechJobs, 14 deterministic written scores plus 6 manual review results. PROCESSING had no report before review; after one review, the student Growth page still had no formal result; the last required review created one COMPLETED report `206332de-a173-443f-b10b-d79304d433b1`, score `55`, with 6 reviewed items and 6 comments. After student re-login, the student-safe report and Growth showed the same score and all six teacher comments.
- SQL and MinIO `HeadObject` evidence for the final T008/T012/T011 Attempts is in [database-minio-proof.json](database-minio-proof.json). It records 12 objects with actual IDs, keys, byte counts, MIME types, and one SpeechJob per Recording.
- Browser logs are in [T008](logs/t008-student-history.txt), [T012](logs/t012-student-practice-runner.txt), [T013](logs/t013-today-growth.txt), and [T011](logs/t011-human-review-growth.txt). Screenshots are in [screenshots](screenshots/); the T012 structured summary is [e2e-summary.json](t012-runner/e2e-summary.json).

## Security, process ownership, and remaining NOT_RUN items

- Cross-user and cross-school negatives passed in Chromium/API: unauthenticated `401`; wrong-school `403`; other-student Attempt `404`; class/school teacher review `403`; invalid review score `400`; changed duplicate review `409`; retry after injected network failures; repeat submit returns the same Attempt ID.
- T015 native owner stopped only its own processes. In the final combined run: PostgreSQL PID `73431` / `55638`, API PID `73800` / `4095`, Web PID `73826` / `4295`, Redis PID `73895` / `6438`, MinIO PID `73919` / `59202–59203`; stop returned PASS. A later SQL/MinIO evidence audit also stopped its own T015 processes. [t015-process-exit.txt](t015-process-exit.txt) confirms all T015 ports are free.
- T005’s dirty bilingual source changes and original `习题课程资源/` remain untouched. T010/T011/T012/T013 source worktrees remain clean at their original SHAs. T014 completed independently at `feat/yz-rd-t014-teacher-class-remediation@0596a9b8256c1d674b93eb2afd4de7306c768129`; its handoff records its own task-aware service stop. T015 did not modify its worktree or stop its processes.
- No Docker/Compose/P1-SIM or old PowerShell control plane was used. The PostgreSQL default-volume incident remains `L4 OPEN`; its volume was not accessed or changed. T015’s isolated DB, bucket, recordings, logs, and screenshots are retained.
- `NOT_RUN`: physical microphone/device and OS permission testing; calibrated/automatic speech scoring (provider disabled and worker deliberately stopped); school pilot; production launch. Browser recording evidence is `SIMULATED_MIC` only.
- Final acceptance failures: `0`. API suite skipped tests: `64` as reported by the full package suite; the T008/T011/T012/T013 Chromium suites and required frontend, contract, and typecheck suites had no skips.
- `API_REQUEST`: none. `COMBINED_BRANCH_FILE_CONFLICTS`: none. `NEXT_WEB_SLICE`: perform the next short-cycle integration against T014’s actual final commit; T015 itself is ready to merge and is not merged.
