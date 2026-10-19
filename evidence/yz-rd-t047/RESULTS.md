# YZ-RD-T047｜移动优先练习与统一学生平台集成

| Field | Result |
| --- | --- |
| `TASK_ID` | `YZ-RD-T047` |
| `STATUS` | `COMPLETE / NATIVE_CHROMIUM_API_POSTGRESQL17_REDIS_MINIO_VERIFIED` |
| `BRANCH` | `feat/yz-rd-t047-mobile-first-unified-product` |
| `BASE` | `0f6ea3710797612aa08f37944a9ab9d92f033da1` |
| `MERGE_SOURCE` | `e3a3c544bb990904212f5ad518a6dc46ae68916c` |
| `MERGE_COMMIT` | `b5a57430d03d8f92b1419c08b871abc19a415d5d` |
| `FINAL_SHA` | Git HEAD at the evidence checkpoint; returned in the task response (a commit cannot contain its own SHA). |
| `MERGE_GRAPH` | No-FF; merge base `2de3b6636a3ef8febca42d973a7c8edd0e8e86bb`; parents BASE then T045. |
| `MOBILE_FIRST_CARD` | `PASS` — 390×844 card y=624; title y=813.8–838.8 and fully visible. |
| `STUDENT_TEACHER_FLOW` | `PASS` — personalized Today, assigned task, manual review, formal student report and isolation. |
| `CHROMIUM_API_PG_MINIO` | `PASS` — all six integration cases passed cumulatively; isolated native services stopped. |
| `REGRESSION` | `PASS` — frontend 137/137, runtime verify PASS, four responsive widths and keyboard/touch checks. |
| `API_LINT` | `FAIL` — 1201 errors / 1 warning, exit 1; inherited and not waived. |
| `READY_TO_MERGE` | `NO — full API lint remains 1201 errors / 1 warning (exit 1); not waived.` |
| `L4_OPEN` | `OPEN / untouched` |

## Merge graph

- Merge base: `2de3b6636a3ef8febca42d973a7c8edd0e8e86bb`.
- The traceable No-FF merge `b5a57430d03d8f92b1419c08b871abc19a415d5d` has first parent BASE `0f6ea3710797612aa08f37944a9ab9d92f033da1` and second parent T045 `e3a3c544bb990904212f5ad518a6dc46ae68916c`.
- Only the task-history sections in `CURRENT_HANDOFF.md` and `DEVELOPMENT_STATUS.md` conflicted. T046 history was retained; this T047 checkpoint records the accepted T045 source and its integrated outcome. The merge stayed on the independent T047 branch. No shared branch was modified.

## Mobile first card

**PASS.** The integrated native Chromium run queried the real `requiresRecording=true` catalog. Its first result is `停顿与节奏专项训练` (`70000000-0000-4000-8000-000000000003`, `requiresRecording=true`). At 390×844, its card starts at document y=624px. The title occupies y=813.8–838.8px and the browser assertion confirms it is fully visible before the 844px viewport ends. The [390px screenshot](e2e/t045-mobile-catalog/catalog-390.png) and [structured viewport evidence](e2e/t045-mobile-catalog/e2e-summary.json) are retained.

| Viewport | First card document y | `scrollWidth` | Result |
| --- | ---: | ---: | --- |
| 390×844 | 624px | 390px | Title visible above fold |
| 768×1024 | 833px | 768px | No horizontal overflow |
| 1280×900 | 835px | 1280px | No horizontal overflow |
| 1440×1000 | 835px | 1440px | No horizontal overflow |

The server-backed MOCK and SPECIALIZED catalog modes, oral filter, search, category filters, ability disclosure, teacher-assigned task section and keyboard/touch behavior remain present. `extraPromotionCards=0`; no four-card promotion layout was introduced. Catalog and Runner screenshots cover all four viewports.

## Student, teacher and speech workflows

- **Personalized Today and teacher tasks: PASS.** T046's server-selected primary action and progress remain first, with the four old cards absent. The integrated run verified real Today records, a teacher-assigned remediation task opening the authorized student Runner, keyboard actions, identity switching and stale-response rejection. T045's API-backed teacher-task section appears before the catalog categories.
- **Real oral practice: PASS.** Chromium opened the authorized recording-required practice with CHOICE, two SPEECH and TEXT questions. It played the prompt, recorded and auditioned two `SIMULATED_MIC` WebM/Opus takes (24,446 bytes each), uploaded both to T047 MinIO and read them back. Interrupted answer-save and upload cases recovered; one submit request produced `PROCESSING`, two CREATED SpeechJobs, zero scored items and zero reports. No automatic speech score was produced. See [T044 proof](e2e/t044-catalog/e2e-summary.json) and [T045 proof](e2e/t045-mobile-catalog/e2e-summary.json).
- **Teacher manual review and student formal report: PASS.** Before review, the real API and PostgreSQL showed no report. A teacher submitted six manual review entries through the existing review flow. The student then read the server-generated formal `STANDARD` report and teacher feedback. PostgreSQL/API evidence includes legal 0/100 and 55/100 reports, and the pre-review pending state. See [report-state proof](e2e/today-and-report/report-state-proof.json).
- **Identity isolation: PASS.** Same-school other-student attempt/history access and report access were denied (404/403); cross-school report access was denied (403). Anonymous, teacher-queue and missing-practice negatives also returned the expected 401/403/404 states. No prior student's Today data rendered after a school switch.

All browser users, assignments, reports and recordings are `TEST_FIXTURE_ONLY`. The browser microphone was simulated; a physical device and calibrated speech scoring were not tested.

## Native Chromium / API / PostgreSQL / MinIO

The integrated runtime used Google Chrome 153.0.8010.52, Node 24.20.0, pnpm 10.13.1, PostgreSQL 17.11, Redis 7.4.10 and MinIO. T047 owned database `yuzan_t047_native`, role `yz_t047`, bucket `yz-t047-native`, and ports 55747/6547/59747–59748/4247/4447. The accepted Question Bank source was read-only; its 120 items / 600 points / 120 of 120 scoring bindings / 126 media objects validated with zero errors or warnings, and before/after source hashes match in [source proof](e2e/today-and-report/question-bank-source-proof.json).

The six integrated browser cases were verified across two runs. The first full run reported 4 passed / 2 failed: T044 and T045 passed, while T037's report flow used its legacy catalog tile selector and timed out; its dependent Today test then lacked the report proof file. T047 enabled the existing integrated test path that navigates to the API-authorized practice ID and replayed those two report/Today cases: **2 passed / 0 failed**. Thus all six cases pass cumulatively. The first-run log and replay log are retained as [first full attempt](native-e2e-full-first-attempt.log) and [report replay](native-e2e-report-replay.log); [final runtime evidence](e2e/today-and-report/native-runtime-evidence.json) records start/source/E2E/stop success and no remaining owned listeners.

An earlier startup attempt timed out under host load before reaching E2E. A later attempt found a recursion bug in the T047-only environment wrapper before browser launch; both attempts were corrected, and their services exited through the owner-aware shutdown path. No unrelated service was stopped. The final T047 PostgreSQL and MinIO data are retained under the ignored task runtime directory for audit.

## Regression and API lint

- **Frontend: PASS.** Node 24 native test run: 137 passed / 0 failed / 0 skipped; runtime verification passed. Raw output: [frontend-tests.txt](frontend-tests.txt). The initial pnpm wrapper invocation stopped before tests with `ERR_PNPM_IGNORED_BUILDS`; its temporary `pnpm-workspace.yaml` change was restored, and the test suite was run directly with Node.
- **API lint: FAIL, retained as the real gate.** After Prisma generation and API build, `eslint src test` exited 1 with **1201 errors / 1 warning** (1202 problems). This matches the accepted T046/T033 baseline and is not waived. Raw output: [api-lint.txt](api-lint.txt). No API source or contracts files changed in the T045 merge.
- `READY_TO_MERGE=NO` until the API lint owner resolves or explicitly waives the baseline. No backend lint success is claimed.

## Safety and policy

No Docker/Compose or Worker was started. The T005 worktree, shared branch and L4 data were not modified or accessed. L4 remains OPEN. Physical microphone/device, calibrated speech scoring, school pilot and production launch remain NOT_RUN.

The target checkout `AGENTS.md` lacks the `AA-DEV-V2.2-20261017` marker, and this Task Card supplied no Lane policy file reference. The user-provided `/home/tian/code/AGENTS.md` safety baseline governed; the mismatch did not block the offline integration.
