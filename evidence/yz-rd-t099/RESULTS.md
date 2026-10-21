# YZ-RD-T099 — optional unanswered submission

STATUS: DONE (implementation and offline/fixture verification)

- BASE: `03371f7287433dac7f09c99ff95729fb4c071652`.
- Repository: `tianxiansheng166/yuzan-workspace-main`.
- Branch: `feat/yz-rd-t099-practice-allow-unanswered-submit`.
- Isolated worktree: `/home/tian/.devspace/worktrees/yuzan-workspace-t099`.
- Final delivery SHA is the task checkpoint commit containing this file; use Git HEAD and the final return, rather than embedding a self-referential SHA here. Normal push and remote/clean checks are performed after committing.
- READY_TO_MERGE=NO. HISTORICAL_L4_INCIDENT_OPEN=YES. No merge/deploy.

## Behavior delivered

Runner confirmation always offers “确认交卷” / “仍然交卷”. Incomplete attempts display the unanswered count and applicable zero-score warning, with an optional return-to-question action. Removing the completeness gate does not remove flush, pending-save, ownership/identity, uncertain-submit, idempotency, or course-sync recovery behavior. Existing local audio drafts must still have their upload/binding confirmed; simply never creating a recording is allowed.

The formal submit page enables submission with missing recordings and blank written items in an otherwise eligible session. It displays their counts and warning. Real failed uploads, failed saves, invalid state, and submit-data transport errors remain technical blockers. Local text clears survive server hydration and are persisted as empty text; blank/nonexistent rows are never sent to written-answer finalization. Real nonblank local answers are saved/finalized before submit.

AssessmentService removes the missing-recording and all-written-finalized requirements. School/student ownership, state transitions, nonempty attempt, FAILED recording-upload protection, and idempotent retries remain. Existing persisted nonblank written answers are finalized server-side if the client omitted that call; missing/blank rows are skipped.

For published QuestionBank items with valid scoring configuration and matching positive maximums, absent written rows, whitespace/empty text, and absent oral recordings get score `0` with safe `AUTO_SCORED` / `reasonCode: UNANSWERED`. Incorrect nonblank answers retain normal wrong-answer scoring. Formal-page choice payloads (`optionIndex` / `optionLabel`) retain their real response meaning. Invalid configuration/maxScore remains unresolved. Scoring reads persisted answer state and preserves authoritative teacher scores and all existing recording evidence.

A valid all-blank 20-item formal attempt produces the existing zero-point report/diagnosis, with 0 answered / 20 unanswered in its summary; a valid remediation subset completes without a formal report. Absent recordings do not require invented SpeechJobs. Actual recordings still wait for their real processing/review results. No provider call, audio evidence, speech score, or maximum is fabricated.

## Validation

All final commands, arguments, exit codes: [`checks.json`](checks.json), [`checks.txt`](checks.txt). Toolchain: Node 24.20.0, pnpm 10.13.1, existing Vitest 3.2.7.

| Check | Result | Raw evidence |
| --- | --- | --- |
| `pnpm --dir frontend test` | 214 PASS / 0 FAIL / 0 SKIP | [frontend-suite.txt](frontend-suite.txt) |
| Business JS syntax gate | 100 JS/MJS files PASS | [frontend-suite.txt](frontend-suite.txt) |
| Frontend runtime verifier | PASS | [frontend-suite.txt](frontend-suite.txt) |
| New T099 frontend regressions | 15 PASS / 0 FAIL / 0 SKIP | [frontend-focused.txt](frontend-focused.txt) |
| AssessmentService + deterministic scorer | 58 PASS / 0 FAIL / 0 SKIP | [api-focused.txt](api-focused.txt) |
| Adjacent QB scoring / remediation / review tests | 15 PASS / 0 FAIL / 0 SKIP | [api-related.txt](api-related.txt) |
| API source TypeScript, no emit | PASS | [api-typecheck.txt](api-typecheck.txt) |
| Targeted ESLint, both owned production and both test files | PASS | [target-lint.txt](target-lint.txt) |
| Runner/app/new-test `node --check` | PASS | [runner-syntax.txt](runner-syntax.txt), [app-syntax.txt](app-syntax.txt), [test-syntax.txt](test-syntax.txt) |
| `git diff --check` | PASS | [diff-check.txt](diff-check.txt) |

The isolated worktree has no installed node_modules. To respect the write allowlist, no dependency links or installs were created in it. Read-only installed dependencies from the exact-BASE UAT checkout were reused. [`vitest.config.mjs`](vitest.config.mjs) resolves dependencies there while testing T099 source/tests. [`typecheck.json`](typecheck.json) extends the repository API tsconfig and changes only dependency/type resolution and build-info location. [`eslint.config.mjs`](eslint.config.mjs) applies the same repository recommended type-checked rules using [`lint-tsconfig.json`](lint-tsconfig.json). No lint rule or test assertion was disabled. [`run-checks.mjs`](run-checks.mjs) records the reproducible commands. Empty successful command logs have exit 0 in checks.json.

Coverage includes zero/some/all unanswered confirmations and submission, clearing saved text, pending-save failure, uncertain-submit locking, course-sync retry without duplicate submission, formal submit hydration/save/finalize handling, transport failures, ownership/school/state/empty-attempt negatives, FAILED upload denial, idempotency, safe empty-vs-wrong scoring, unfinalized persisted nonblank scoring, all-blank formal/remediation completion, real recording processing/review, authoritative teacher scores, and invalid maximums. Lifecycle tests use the real scoring service with in-memory repository/Prisma fixtures; these are not database E2E.

## Visual evidence and limits

- [Runner confirmation 390×844](runner-confirm-390x844.png).
- [Runner confirmation 1280×900](runner-confirm-1280x900.png).
- [Fixture source](visual-fixture.mjs), [raw browser assertions](visual-fixture.txt).

Both captures use the actual Runner rendering and existing CSS with synthetic content, visible `VISUAL_FIXTURE_ONLY` watermarks, and all network requests blocked. The “仍然交卷” control is enabled and inside the viewport at both sizes. Both images were visually inspected. Chromium was closed in finally; no shared service was started.

Native authenticated browser/API/PostgreSQL/MinIO E2E = NOT_RUN. No authorized isolated runtime was supplied. No database/MinIO/Redis startup, Docker/Compose, production speech call, service shutdown, or process kill was performed.

Full API suite = NOT_RUN in T099. The task's exact-UAT baseline remains **1141 PASS / 13 FAIL / 64 SKIP**. All 13 inherited failures are the existing SubmissionsService ConfigService-fixture DI setup errors before assertions; environment-gated skips remain separate. T097 `82824b8abc6bf02dfef6b02219e5e0bb800f28be` is not an ancestor and was not inspected, merged, or cherry-picked. This result does not claim a green full API suite.

## Startup and ownership receipt

Remote UAT SHA was checked read-only before creating the task worktree and matched BASE exactly. Main status/current branch/worktree list were checked without reading its diffs. T099 branch, remote branch, and target path were absent before creation. The named isolated worktree started at exact BASE. No T098 source/diffs were inspected or altered; no shared branch was modified.

REPO_AGENTS_ACTUALLY_READ: `/home/tian/code/AGENTS.md` and exact-BASE task-worktree `AGENTS.md` (blob `a931f77fa17dad8e023adf4034c1550227c321b8`); README-FIRST.md, CURRENT_TASK.md, CURRENT_HANDOFF.md and task source/tests were also read.

NOTION_POLICY_READ=READ_OK: [17](https://app.notion.com/p/3e7909d673d2816388ced86414c08585), [17A](https://app.notion.com/p/3eb909d673d281459caad397469005aa), [YZ-RD Lane / minimum execution rules](https://app.notion.com/p/3fc909d673d28175b61fcee160d15c17). POLICY_SCOPE=YZ-RD; AA-DEV marker=CROSS_PROJECT_MARKER_NOT_APPLICABLE.

FILE_OWNER_GUARD=PASS. Only the four allowed production files, three allowed test files, an append-only CURRENT_HANDOFF.md checkpoint, and evidence/yz-rd-t099/** are changed. No teacher pages, schema, Contracts, shared API client, CSS, practice.service.ts, T005 protected changes, T098 paths, source corpus, or local_sources were modified. L4_SOURCE_READ=NO (raw sources not opened); L4_IMPORT_APPLIED=NO; L4_RUNTIME_OPENED=NO; HISTORICAL_L4_INCIDENT_OPEN=YES.
