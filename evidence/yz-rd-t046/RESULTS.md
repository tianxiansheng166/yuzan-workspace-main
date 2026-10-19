# YZ-RD-T046 — personalized Today and speech catalog integration

| Field | Result |
|---|---|
| `TASK_ID` | `YZ-RD-T046` |
| `STATUS` | `VERIFIED / READY_TO_MERGE=NO` |
| `BRANCH` | `feat/yz-rd-t046-personalized-speech-ux-integration` |
| `START_HEAD` | `a23232c582647f6f0222fe46414105bc03d5a651` |
| `INITIAL_MERGE_HEAD` | `6049e107f586fe4ca87158608c297b10908b05f1` |
| `T044_SOURCE` | `7f9288521a2f4e486ccf2ea2f49e1d78e9ce7865` |
| `PRE_EVIDENCE_HEAD` | `7a2ec1fb3ee7e9b4ea39273b86f0580277a3428f` |
| `FINAL_SHA` | Returned in the task response; the final evidence commit cannot contain its own SHA. |
| `L4_OPEN` | `OPEN / untouched` |

## Merge graph

- T043 merge base: `6d3aa67c114bd310c2d793caa7bcd5be9166ec3f`. No-FF commit `d6e0328522817be08ab496c5b294b8eaae903afc` has parents T042 `a23232c582647f6f0222fe46414105bc03d5a651` and T043 `6049e107f586fe4ca87158608c297b10908b05f1`.
- T044 merge base: `d2ed5c8ca7b01f6c955e23cae6a2a9202d815e49`. No-FF commit `7a2ec1fb3ee7e9b4ea39273b86f0580277a3428f` has parents T046/T043 `d6e0328522817be08ab496c5b294b8eaae903afc` and the exact requested T044 SHA `7f9288521a2f4e486ccf2ea2f49e1d78e9ce7865`.
- T045 `c140214` is not an ancestor. No shared branch was merged.

## Conflict resolution

The five T043 conflicts were `CURRENT_HANDOFF.md`, `DEVELOPMENT_STATUS.md`, `frontend/student/today/today-showcase.js`, `frontend/tests/assessment/t037-student-showcase.test.mjs`, and `tests/e2e/assessment/test_yz_rd_t037_today_showcase.py`. Resolution preserved both T042 and T043 checkpoint notes, selected the T043 one-item optional discovery implementation, kept the T043 layout/authorization tests, and added an assertion that the server-issued SYSTEM BASELINE ID remains the primary action even when the regular practice catalog omits it. The native E2E verifies that ID through the authorized detail API and starts the action through the existing create/resume API. The former four-card UI is absent.

The T044 merge had documentation conflicts in `CURRENT_HANDOFF.md` and `DEVELOPMENT_STATUS.md`; both T046/T042/T043 and the T044/T038 acceptance records were retained. T044 UI, E2E, native runtime, and evidence paths merged without code conflicts.

## Acceptance results

### Personalized Today

**PASS.** The authenticated server-selected primary task and progress remain first. There are zero old four-card tiles, and at most one distinct server-authorized discovery follows the overview. The main card stayed above the first fold at all four sizes. SYSTEM BASELINE remains a keyboard/touch-operable primary button that calls `createOrResumePractice` with Today’s returned `practiceDefinitionId`; its ID is checked through the authorized detail endpoint rather than assumed to appear in the ordinary catalog. Empty/offline catalogs do not create a recommendation. See [Today proof](today-showcase-proof.json) and the [390px screenshot](screenshots/today-real-390.png).

### Speech catalog, recording, and submission

**PASS.** The real catalog requests used `catalogType=MOCK`, `catalogType=SPECIALIZED`, and `requiresRecording=true`; MOCK displayed its non-official-exam disclaimer. T046 added an isolated authorized delivery for the already-published seeded `停顿与节奏专项训练` after the read-only Question Bank importer closed its legacy delivery. The four real Runner items were CHOICE, SPEECH, SPEECH, and TEXT.

Chrome used `SIMULATED_MIC`: two WebM/Opus takes (24,446 bytes each) were previewed, uploaded, and read back from MinIO. Interrupted answer-save and signed-upload cases recovered. The browser sent one submit request. PostgreSQL showed `PROCESSING`, two CREATED SpeechJobs without provider results, zero scored items, and zero report rows; the report API returned `null`. No automatic score or fake report was generated. See [speech E2E summary](speech/e2e-summary.json), [catalog screenshots](speech/), and [native run evidence](native-runtime-evidence.json).

### Teacher/student flow and reports

**PASS.** Two native T043 flows exercised teacher-created remediation assignment → student Today primary action → the same authorized Runner attempt, including multi-enrollment scope. The T037 report flow used the real teacher review API: before review the submitted standard session had no report; after six teacher review entries the API generated a complete `STANDARD` report with score `0/100`, and the student Growth page showed the report and teacher feedback. A separate reviewed standard report scored 55. All created users, assignments, attempts, comments, and recordings were local test fixtures.

### E2E, viewports, and checks

**Native E2E: 5 passed, 0 failed, 0 skipped.** The run covered two Today/report cases, two teacher-assignment/student-Runner cases, and the T044 catalog/speech case. Full output: [native-e2e.txt](native-e2e.txt).

| Viewport | Today | Catalog | Runner | Horizontal overflow |
|---|---:|---:|---:|---:|
| 390×844 | PASS; primary above fold | PASS; oral filter visible | PASS | 0 px |
| 768×1024 | PASS | PASS | PASS | 0 px |
| 1280×900 | PASS | PASS | PASS | 0 px |
| 1440×1000 | PASS | PASS | PASS | 0 px |

At 390px the T044 oral filter remains visible while the first catalog card starts near y=1017px, requiring a short scroll. T045's mobile-first-card work was intentionally not merged.

| Check | Result |
|---|---|
| Frontend full suite | 133 passed / 0 failed / 0 skipped — [log](frontend-tests.txt) |
| Frontend build/runtime verification | PASS — [log](frontend-build.txt) |
| API full Vitest | 1109 passed / 64 environment-gated skipped / 0 failed — [log](api-tests.txt) |
| Contracts | 6 passed / 0 failed / 0 skipped — [pinned pnpm run](contracts-tests-pinned.txt) |
| Workspace TypeScript | PASS for API, Worker, database, contracts, domain, and frontend — [log](typecheck.txt) |
| API build | PASS in the isolated native run |
| Full API lint | **FAIL: 1201 errors / 1 warning**, exit 1 — raw output in [api-lint.txt](api-lint.txt) |

The API lint count matches the inherited T033 baseline recorded by T042/T043/T044. This is not waived; `READY_TO_MERGE=NO`. An initial Contracts invocation through Corepack caused nested generator subprocesses to resolve global pnpm 11.7; rerunning the same suite through repository-pinned pnpm 10.13.1 passed 6/6. The passing and initial diagnostic outputs are in [contracts-tests-pinned.txt](contracts-tests-pinned.txt) and [contracts-tests-corepack-attempt.txt](contracts-tests-corepack-attempt.txt).

## Runtime and safety

- Native runtime: Chrome 153.0.8010.52, Node 24.20.0, pnpm 10.13.1, PostgreSQL 17.11, Redis 7.4.10, and MinIO. T046-owned ports were PostgreSQL 55696, Redis 6496, MinIO 59496–59497, API 4196, and Web 4396. All services exited; the runtime evidence lists no remaining listener PIDs.
- The importer validated 120 items / 600 points / 120 of 120 scoring bindings / 126 media files with 0 errors and 0 warnings. It read the accepted source directory read-only; before/after hashes match in [source proof](question-bank-source-proof.json). T005 was not modified.
- Worker and speech scorer remained stopped/disabled. No Docker/Compose, forced Git operation, T005 modification, shared-branch merge, or L4 access occurred. Physical microphone/device, calibrated speech scoring, school pilot, and production are NOT_RUN.
- T046 PostgreSQL and MinIO evidence data remain under the task-owned runtime. `READY_TO_MERGE=NO` until the API lint baseline is resolved or explicitly waived. `L4_OPEN=OPEN`.
