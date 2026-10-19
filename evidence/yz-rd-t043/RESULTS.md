# YZ-RD-T043 — Student Today UX acceptance

| Field | Result |
|---|---|
| TASK_ID | YZ-RD-T043 |
| STATUS | ACCEPTANCE_VERIFIED |
| BRANCH | `feat/yz-rd-t043-personalized-today-ux-restoration` |
| START_SHA | `752a6b9ec42e6903635ea6cc45d757eb5aa592aa` |
| FINAL_SHA | `fd6648ee8b4686b6cec8f8e320ea65214a6df63c` — verified implementation and native E2E evidence checkpoint. The final results-only branch-head commit is reported in the task return because a Git commit cannot embed its own SHA. |
| READY_TO_MERGE | NO — inherited full API lint baseline remains unresolved (T033: 1201 errors / 1 warning); this task made no API source changes and did not rerun or waive that baseline. |
| L4_OPEN | OPEN / untouched |

## Acceptance fields

- **FIRST_SCREEN_HIERARCHY:** PASS. The personalized primary task and progress summary precede one optional discovery strip; there are zero four-card feature tiles. The primary card is fully above the fold at all four tested heights. The optional strip is below it (at 390 px it begins at y=931, below the 844 px fold).
- **PERSONALIZED_PRIMARY:** PASS. The real `BASELINE` action remained the main CTA; keyboard Enter created/resumed its real attempt. A real teacher-assigned remediation became the primary action in both teacher-assignment E2Es. When the baseline became a resumed assessment, its own recording definition was no longer repeated as the optional action.
- **REAL_DYNAMIC_CONTENT:** PASS. Chromium authenticated through the login form. Today used the live authorized course Assignment ID and opened its database-backed Course Detail/activity. The optional recording practice ID came from the authenticated practice catalog (`requiresRecording=true`) and its detail API returned 200. Teacher review feedback and the generated report appeared in Growth. The completed `STANDARD` report preserved a legal 0 score; a separate `PROCESSING` attempt had no report and no score. The real `CREATED`/`IN_PROGRESS` continuation remained linked from Today.
- **FOUR_VIEWPORTS:** PASS — 390×844, 768×1024, 1280×900, 1440×1000. All had zero horizontal overflow.
- **CHROMIUM_API_PG_E2E:** PASS — native Google Chrome 153 + NestJS API + PostgreSQL 17.11 + Redis + MinIO; 4 passed, 0 failed, 0 skipped. Teacher, student, API, SQL, course, practice, report, retry, and access-isolation paths ran against the isolated T043 runtime.
- **PASS_FAIL_SKIP_NOTRUN:** Frontend 120/120 passed, 0 failed, 0 skipped. Final native E2E 4/4 passed, 0 failed, 0 skipped. JavaScript/Python syntax and `git diff --check` passed. **NOT_RUN:** full API suite/lint, physical microphone, speech scoring, school pilot, and production deployment.

## Visual review

Authenticated, database-backed screenshots:

- [390 px](screenshots/today-real-390.png)
- [768 px](screenshots/today-real-768.png)
- [1280 px](screenshots/today-real-1280.png)
- [1440 px](screenshots/today-real-1440.png)
- [Course Detail](screenshots/authorized-course-detail-1440.png)
- [Authorized recording practice](screenshots/recording-practice-definition-1440.png)
- [Formal zero-score state](screenshots/today-real-formal-zero-score-1440.png)
- [Pending result without score](screenshots/today-pending-no-score-1280.png)

The first fold keeps the primary action visible at every viewport. Measured typography and spacing:

| Viewport | Primary card y-range | Optional strip y | Page heading | Primary heading | Primary reason | Overview gap | Overflow |
|---|---:|---:|---:|---:|---:|---:|---:|
| 390×844 | 247–567 px | 931 px | 29 px | 25 px | 13 px / 23.4 px line | 12 px | 0 px |
| 768×1024 | 279–599 px | 795 px | 32 px | 26 px | 15 px / 27 px line | 18 px | 0 px |
| 1280×900 | 337–687 px | 709 px | 43.5 px | 36 px | 15 px / 27 px line | 18 px | 0 px |
| 1440×1000 | 343–693 px | 715 px | 46 px | 36 px | 15 px / 27 px line | 18 px | 0 px |

The 390 px run verified the primary action and optional practice by touch. Their measured heights were 47 px and 40 px. The primary CTA was reached by Tab, showed a 3 px focus outline, and opened the real attempt with Enter. The optional section was exposed as the named `其他已开放的学习内容` region with a named link. Full viewport metrics and interaction evidence are in [native-today-proof.json](native-today-proof.json).

## Dynamic-content and failure evidence

- The optional discovery target was selected from the authorized API response, not generated from a fixture list in the page. A continuation attempt is resolved through the already-loaded authenticated attempt records before choosing a different practice. If that continuation cannot be linked to its practice definition, discovery stays hidden.
- Teacher task and course views were checked against real API responses. Same-school other-student course/practice reads returned 404 and report access returned 403; cross-school course, practice, and report reads returned 403.
- A Today API network failure displayed the retry state; retry and refresh recovered the server state. When optional course/practice requests failed or returned empty authorized lists, Today showed no invented recommendation and no four-card fallback.
- The formal report was `COMPLETED` / `STANDARD`, with SQL and API both confirming score `0`. The student saw `0 分` and the teacher comment in Growth. A separate submitted `PROCESSING` session had zero `AssessmentReport` rows and Today showed no score.
- Question Bank preflight: 120 items / 600 points / 120 of 120 scoring bindings / 126 media files / 0 errors / 0 warnings. The six published practice deliveries were imported into the isolated T043 database and bucket. Source files were read-only; hashes before and after matched. See [source proof](native-question-bank-source-proof.json).
- Detailed report/teacher-feedback SQL evidence: [report-state proof](native-report-state-proof.json) and [teacher-feedback proof](native-teacher-feedback-proof.json). Final test count and paths: [E2E summary](native-e2e-summary.json).

## Test/runtime evidence

- Frontend: `corepack pnpm --filter @yuzan/frontend test` — 120 passed, 0 failed, 0 skipped.
- Native E2E files: `tests/e2e/assessment/test_yz_rd_t037_today_showcase.py` and `tests/e2e/assessment/test_qb017a_student_today.py` — 4 passed, 0 failed, 0 skipped. The teacher-assignment helper used its native PostgreSQL path; Docker was not invoked.
- Runtime: `yuzan_t043_native` / `yz_t043`, PostgreSQL 17.11 on 55643, Redis 6443, MinIO 59443–59444 / bucket `yz-t043-native`, API 4143, Web 4343. Native runtime details and stopped PIDs are in [native-runtime-evidence.json](native-runtime-evidence.json); test identities and authored activity are `TEST_FIXTURE_ONLY`.
- T043 API/Web/PostgreSQL/Redis/MinIO processes were stopped after verification and all T043-owned ports are free. Isolated PostgreSQL and MinIO data remain under `/tmp/yz-rd-t043-runtime` for audit. No Worker, Docker/Compose, shared-branch merge, or sibling runtime shutdown occurred.
- The target checkout `AGENTS.md` lacks the `AA-DEV-V2.2` marker; the user-supplied local safety baseline was followed. T005 protected source files were not changed or staged. `L4_OPEN` remains OPEN.
