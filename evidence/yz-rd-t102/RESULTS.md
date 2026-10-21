# YZ-RD-T102 Results

- **STATUS:** implementation checkpoints delivered for Owner review
- **READY_TO_MERGE:** `NO`
- **DEPLOY:** forbidden; not performed
- **SHARED_BRANCH_MERGE:** forbidden; not performed
- **PRODUCTION_DATA_ACCESS:** forbidden; not performed

## Baseline and branch

- **BASE:** `0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8`
- **Commit time:** `2026-09-08T12:27:49+08:00`
- **Parent:** `9b09c94143c2bf719ae6732c9a5279ac4ee21b3b`
- **Branch:** `feat/yz-rd-t102-recover-2026-09-08-student-baseline`
- **Worktree:** `/home/tian/code/work/yuzan-workspace-t102`
- **Final report commit:** the exact SHA is included in the final Codex return.

`0a7b931...` is the latest reachable commit dated Sep 8 in the inspected Git
history. It follows that day's Today navigation, course media, course cover, and
course-directory scrolling changes. The Sep 8 handoff records acceptance of
Today, Courses, course detail, the course Runner, report, and remediation. The
Sep 7 handoff records the course-center to detail route, an imported MP4 playing
for 3.1 seconds, PDF access, persisted exercise progress, and the course
practice entry. Those are historical product evidence, not a T102 live test.

`5619bdf...` is Sep 7's starting state for COMP-DEMO-05, before Sep 8 student
changes. `03371f728...` is an Oct 21 integration state and was not used as the
baseline. T098, T099, T100, and T101 were reviewed as later work, not treated as
the baseline. The branch was created from the verified BASE in an isolated
worktree. The dirty shared T005 worktree and clean T101 worktree were left
unchanged.

The target checkout has no `AA-DEV-V2.2` marker in its `AGENTS.md`. The Task
Card's route-specific contract and the supplied `/home/tian/code/AGENTS.md`
rules were followed, and the marker mismatch is recorded here. Before changing
`AGENTS.md`, ownership, CODEOWNERS, protected paths, and existing rules were
checked. `AGENTS.md` now contains the three required rules separately: Codex
executes project development; plugins/connectors/MCP cannot substitute for
Codex; and unavailable Codex execution is a blocker to report to the Owner.

## Recent task review and selective ports

| Task and source                                                                                       | Findings against Sep 8                                                                                                                                                         | T102 decision and evidence                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T093 `9642875c755779cdf5c9352cc39eebdafeec2d1b`                                                       | The Oct 20 change removes demo-token/offline login paths and routes using server-returned identity. It does not replace the Sep 8 login presentation.                          | Ported narrowly as `7ccdfab`; 12 focused login tests passed.                                                                                                                                                           |
| T094 `4f0fe53b11c6ec96c8ef5683e635f41b93a533ec`                                                       | Adds submission-bound recording playback for teacher review. It is not the student course video player or the Growth student's own recording archive.                          | Not ported as a task branch. T102 Growth uses the Sep 8 student recording archive and evidence API only after matching the returned recording to the active student's completed history.                               |
| T095 `449e256bae337ca6224cd9a12b564a44abaf36b2`                                                       | Adds active teacher-to-class authorization for feedback reads/writes and an atomic revision-checked transition before releasing feedback. Growth reads those released records. | Relevant to the student Growth data path; ported narrowly as `7f58dcd`, including service/policy tests. T095's original evidence is retained under `evidence/yz-rd-t095/`. Its PostgreSQL concurrency E2E was not run. |
| T096 `1357b1af3b4dbc4bd06ffc769dbe91d550478bc7`                                                       | Teacher feedback UI work, outside the student-first Sep 8 UI.                                                                                                                  | Not ported. The student Growth page consumes released server data without importing the teacher page.                                                                                                                  |
| T097 `82824b8abc6bf02dfef6b02219e5e0bb800f28be`                                                       | Test-only ConfigService fixture repair. It changes test setup rather than student behavior.                                                                                    | Not ported into product source. The full API suite passes with the T095/T099 changes.                                                                                                                                  |
| T098 `17ff508075e51ab3fabf546d711a1e22023c44e6`                                                       | Oct 21 Today, Courses, and Growth redesign. Its own source scope is HTML/CSS; the user explicitly rejects its overall visual treatment.                                        | No T098 page template or global styling was carried. Its page-specific CSS depended on the redesign markup and did not address a Sep 8 layout defect independently.                                                    |
| T099 `f2c28565c4c2559c842f5bdc812a37133b3f75b6`                                                       | Implements partial and all-blank submission, with answer-save, failed-upload, ownership, state, and idempotency protections. This is an explicit product requirement.          | Ported narrowly as `aa48b87`; 10 new Runner/formal-submit regressions and backend scoring/submission regressions pass. Authenticated browser/API E2E remains `NOT_RUN`.                                                |
| T100 merge `4cc14de696285c3d3f0b16f0e04e4f1a5daf9bf8`, tip `5e65f2582818387f1934d0d793056b76e402e67b` | Integrates T099 on the Oct 21 UAT/T098 redesign parents. It inherits the rejected visual state and is not date-matched.                                                        | No branch merge or full cherry-pick. T099 behavior was ported and reviewed directly.                                                                                                                                   |
| T101 `55770e4f051c4c7b58c054f92fdf76b320ec96a1`                                                       | Oct 21 UI restoration still targets an October style. Its nested `activity.content` video metadata mapping is an isolated data fix.                                            | Ported only the nested `videoUrl`, poster, subtitle, and marker aliases as `fa8425a`, with adapter regression coverage. No T101 UI restoration was used.                                                               |

Related student history was inspected as context. T077's `growth-live.js`
replaced the whole page template, so that renderer was not carried. Its report
loader also required `report.teacherFeedback`, which the current
`toAssessmentReportResponse` does not return. T102 reads teacher comments from
the released history-events endpoint instead. T074/T075/T076/T081/T082 work was
reviewed; none was merged wholesale. The current course page keeps its existing
dynamic assignment, submission, activity, and practice IDs.

## Restored pages and behavior

The branch starts on the actual Sep 8 source tree, retaining its Today,
Courses, course detail/player, Runner, and Growth page structures and their
existing course assets. No page was replaced with a new template.

- **Login:** fail closed when the API is missing or authentication fails; no
  demo token, fixed school, or offline session. Successful routing uses the
  server-returned identity.
- **Today:** the existing Today response and primary action remain usable when
  only the optional course catalog request fails. Catalog failure, successful
  empty catalog, and loaded courses have different states. Course detail links
  preserve the returned `assignmentId`.
- **Courses and course detail:** the BASE catalog and detail hierarchy remain
  intact. Catalog card clicks are covered for dynamic and missing assignment
  IDs. The detail view selects the requested `activityId`, creates/resumes a
  submission using the requested `assignmentId`, and preserves the required
  IDs on course practice actions. Recommendations and dashboard statistics no
  longer block the main course. Missing metrics remain unknown; API errors get
  local unavailable messages.
- **Course media:** activity-level media aliases are retained, with fallback to
  published `activity.content` fields when top-level aliases are absent. No
  video URL was hard-coded. Playback progress now sends the fraction required
  by the backend `videoPosition` contract instead of overwriting it with the
  player's 0–100 display percentage. A focused regression checks dynamic course,
  submission, activity, and expected revision IDs.
- **Growth:** the existing React component hierarchy remains. The bundled
  fixture payload, sample feedback, fake progress/trend, and sample audio
  reference were removed from the loader. The adapter loads current-school
  profile, history, question-bank progress, released events, and open practice
  records. It validates each report against its source session, school,
  enrollment, purpose, status, generation time, completeness, and score bounds.
  Audio appears only for a recording returned by the student's own recording
  archive and linked to that student's completed session, using the API's
  signed download URL. No static fallback data is shown.
- **Runner:** T099 partial/all-blank submission is retained. Blank written
  answers are not finalized as answered; valid unanswered QuestionBank written
  items receive the existing safe zero-score path with an `UNANSWERED` reason.
  Real speech recordings remain on their existing review path.
- **Feedback source:** T095's class scope and atomic revision transition are
  retained because student Growth consumes released feedback.

## API and media evidence

The page-by-page endpoint, parameter, response, adapter, and failure-state audit
is in [`API_AUDIT.md`](API_AUDIT.md). Key dynamic IDs are assignment, activity,
submission, practice definition, attempt, enrollment, assessment session, and
recording IDs returned by the server. No hard-coded course or recording data is
used as real student data.

The course media chain remains structurally present:

```text
Courses card assignmentId
  -> /student/courses/course-detail/?id=<assignmentId>
  -> authenticated course and submission reads
  -> current activityId and its resources/content
  -> authorized resource playback URL or published activity videoUrl
  -> MediaController playback/progress events
  -> activity attempt write with assignmentId, submissionId, activityId
  -> existing recommendations and course-practice entry
```

Historical Sep 7/8 evidence proves the then-used imported MP4 path. T102's
nested-media adapter regression passes. **Authenticated browser playback,
current API authorization, progress persistence, and the full playback E2E are
`NOT_RUN`** because no authorized isolated Browser/API/PostgreSQL/MinIO runtime
was available. Player presence in HTML is not counted as playback success.

## UI improvements

The specific state/layout scope is listed in [`UI_IMPROVEMENTS.md`](UI_IMPROVEMENTS.md):
Today catalog failure and loading announcement; detail optional-data isolation
and truthful metric states; Growth removal of sample content while retaining
the page hierarchy; and authorized recording evidence. No color system, card
system, or broad layout redesign was introduced. Authenticated visual captures
are `NOT_RUN`.

## Tests and gates

| Check                                                                          | Result                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full frontend suite: `corepack pnpm --filter @yuzan/frontend test`             | **PASS** — 51 tests; runtime verifier passed.                                                                                                                                                                                                                                                                                                                   |
| Focused Today, course adapter, course player-state, and Courses route fixtures | **PASS** — 15/15.                                                                                                                                                                                                                                                                                                                                               |
| Growth API adapter fixtures                                                    | **PASS** — 4/4.                                                                                                                                                                                                                                                                                                                                                 |
| T099 Runner/formal-submit regressions                                          | **PASS** — 10/10.                                                                                                                                                                                                                                                                                                                                               |
| T095 feedback service and policy cases                                         | **PASS** — 36/36, included in the full API suite.                                                                                                                                                                                                                                                                                                               |
| API package suite: `corepack pnpm --filter @yuzan/api test -- ...`             | **PASS** — 66 files passed, 10 skipped; 1,072 passed, 64 skipped. The package script ran the full API suite despite the supplied file filter.                                                                                                                                                                                                                   |
| API TypeScript typecheck                                                       | **PASS**.                                                                                                                                                                                                                                                                                                                                                       |
| Frontend typecheck and build/runtime verification                              | **PASS**.                                                                                                                                                                                                                                                                                                                                                       |
| Changed JavaScript syntax checks and course-detail inline script parse         | **PASS**.                                                                                                                                                                                                                                                                                                                                                       |
| `git diff --check`                                                             | **PASS** at the latest source checkpoints; rerun after final docs.                                                                                                                                                                                                                                                                                              |
| Repository `format:check`                                                      | **FAIL** — broad existing formatting debt and parser errors in unrelated `frontend/volunteer.css` and `infra/ai/provider-stub/index.ts`; the repository command reports 12 files with errors and many unrelated warnings. Focused Prettier passes for the new Growth adapter and T102 evidence; the T099 harness and modified BASE files retain existing style. |
| API ESLint                                                                     | **FAIL / blocked before analysis** — `backend/api/eslint.config.mjs` cannot import missing `@eslint/js`; no source lint diagnostics were produced.                                                                                                                                                                                                              |
| Authenticated course-video E2E                                                 | **NOT_RUN**.                                                                                                                                                                                                                                                                                                                                                    |
| Live Browser/API/PostgreSQL/MinIO E2E                                          | **NOT_RUN**. No service was started and no database, object storage, or production data was accessed.                                                                                                                                                                                                                                                           |

Unit and VM fixture tests are not real API or browser acceptance. No failures or
skips were hidden: the 64 skipped API tests are existing suite configuration.

## Checkpoints, files, evidence, and rollback

Each code checkpoint is a separate reviewable commit. To roll back one checkpoint on this
branch, use `git revert <full-commit-sha>`; revert later dependent commits first.
No reset, clean, force-push, merge, or deployment was used.

| Checkpoint commit                                                     | Files                                                                                                                                                                                                                                                                                                                                                                                                     | Purpose and evidence                                                                                                                                       | Known issue                                                                                                      | Rollback                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `77d3a7009cf97eaae3db5781757f390df6087c9d`                            | `AGENTS.md`; `evidence/yz-rd-t102/BASELINE.md`                                                                                                                                                                                                                                                                                                                                                            | Record the exact historical baseline and add the three required Codex-only execution rules. Baseline history and acceptance evidence are in `BASELINE.md`. | Target checkout has no AA-DEV-V2.2 marker.                                                                       | `git revert 77d3a7009cf97eaae3db5781757f390df6087c9d` |
| `d750b65ce5ef68ca739d34ead4136045db5c9224`                            | `evidence/yz-rd-t102/API_AUDIT.md`                                                                                                                                                                                                                                                                                                                                                                        | Read-only API/controller/source audit.                                                                                                                     | Audit findings were later updated in the final docs checkpoint.                                                  | `git revert d750b65ce5ef68ca739d34ead4136045db5c9224` |
| `7ccdfab30d23cf3133f0f4695a22707c7dad542e` (source T093 `9642875...`) | `frontend/login/app.js`; `frontend/login/login.js`; `frontend/login/index.html`; `frontend/login/auth-fail-closed.test.mjs`; `evidence/yz-rd-t093/verification.md`                                                                                                                                                                                                                                        | Remove offline/demo authentication paths; 12 login cases pass.                                                                                             | Live identity provider/browser E2E not run.                                                                      | `git revert 7ccdfab30d23cf3133f0f4695a22707c7dad542e` |
| `fa8425a0a844520768635fc581c63c447ea14851` (source T101 `55770e4...`) | `frontend/student/courses/course-detail/course-api-adapter.js`; `frontend/student/courses/course-detail/course-api-adapter.test.mjs`                                                                                                                                                                                                                                                                      | Map nested published media fields; adapter test passes 6/6 at this checkpoint.                                                                             | Authenticated playback not run.                                                                                  | `git revert fa8425a0a844520768635fc581c63c447ea14851` |
| `aa48b87395dd56112cbb428dc529c13ebc8b537f` (source T099 `f2c2856...`) | `backend/api/src/modules/assessment/assessment.service.ts`; `backend/api/src/modules/assessment/question-bank-deterministic-scoring.service.ts`; their two focused API specs; `frontend/assessment/assets/app.js`; `frontend/assessment/assets/runner.js`; `frontend/assessment/assets/runner.css`; `frontend/tests/assessment/t102-unanswered-submit.test.mjs`; `evidence/yz-rd-t102/T099_CHECKPOINT.md` | Partial/all-blank submit and truthful unanswered scoring; focused Runner 10/10, API package suite and typecheck passed at checkpoint.                      | Authenticated submit E2E not run; ESLint cannot start due missing `@eslint/js`.                                  | `git revert aa48b87395dd56112cbb428dc529c13ebc8b537f` |
| `02b4236fedc9a7f9754b7625b4dfdfac0475d10c`                            | `frontend/package.json`; Today JS and tests; course adapter, player state, course detail, and their tests                                                                                                                                                                                                                                                                                                 | Distinguish Today catalog error/empty states; isolate detail optional calls and preserve route IDs. Focused frontend tests 12/12.                          | Fixture evidence only.                                                                                           | `git revert 02b4236fedc9a7f9754b7625b4dfdfac0475d10c` |
| `1b2094401925e742acf0e64586a62043a649411e`                            | `frontend/student/growth/assets/growth-api-adapter.js`; `frontend/student/growth/assets/index-ByH3ToFf.js`; `frontend/student/growth/growth-api-adapter.test.mjs`; `frontend/student/growth/index.html`                                                                                                                                                                                                   | Preserve the Sep 8 page hierarchy, remove sample loader, and use authorized API data. Growth fixtures 4/4; JS syntax passes.                               | Live API/audio E2E not run; report API does not return `teacherFeedback`, so comments come from released events. | `git revert 1b2094401925e742acf0e64586a62043a649411e` |
| `7f58dcd2c426100c01d1967fd6e3937500d0a633` (source T095 `449e256...`) | feedback policy/service/repository/port; feedback service/policy tests and fake; `evidence/yz-rd-t095/` source-task results/logs                                                                                                                                                                                                                                                                          | Class-authorized reads/writes and atomic revision-checked feedback creation. Focused feedback/policy cases 36/36; full API suite and typecheck pass.       | PostgreSQL concurrency E2E not run.                                                                              | `git revert 7f58dcd2c426100c01d1967fd6e3937500d0a633` |
| `b739a27f1cf2dad279539d70e3d3b965ddd77e93`                            | `frontend/student/courses/courses.test.mjs`; `frontend/student/courses/course-detail/course-player-state.js`; `frontend/student/courses/course-detail/course-player-state.test.mjs`                                                                                                                                                                                                                       | Cover dynamic catalog route and fix fractional video-progress mapping; focused route/progress tests 5/5.                                                   | Live playback/progress write not run.                                                                            | `git revert b739a27f1cf2dad279539d70e3d3b965ddd77e93` |

Complete changed-file list through the final docs checkpoint:

```text
AGENTS.md
CURRENT_HANDOFF.md
backend/api/src/modules/assessment/assessment.service.ts
backend/api/src/modules/assessment/question-bank-deterministic-scoring.service.ts
backend/api/src/modules/feedback/feedback.policy.ts
backend/api/src/modules/feedback/feedback.service.ts
backend/api/src/modules/feedback/infra/prisma-feedback.repository.ts
backend/api/src/modules/feedback/ports/feedback-repository.port.ts
backend/api/test/assessment/assessment.service.spec.ts
backend/api/test/assessment/question-bank-deterministic-scoring.service.spec.ts
backend/api/test/modules/feedback/fakes/fake-feedback.repository.ts
backend/api/test/modules/feedback/feedback.policy.spec.ts
backend/api/test/modules/feedback/feedback.service.spec.ts
evidence/yz-rd-t093/verification.md
evidence/yz-rd-t095/RESULTS.md
evidence/yz-rd-t095/api-full-lint.exit
evidence/yz-rd-t095/api-full-lint.json
evidence/yz-rd-t095/api-full-lint.stderr
evidence/yz-rd-t095/api-typecheck.log
evidence/yz-rd-t095/feedback-tests-default-pool-aborted.log
evidence/yz-rd-t095/feedback-tests-first-run.log
evidence/yz-rd-t095/feedback-tests.log
evidence/yz-rd-t095/git-diff-check.log
evidence/yz-rd-t095/submission-read-list-regressions.log
evidence/yz-rd-t095/target-lint.log
evidence/yz-rd-t102/API_AUDIT.md
evidence/yz-rd-t102/BASELINE.md
evidence/yz-rd-t102/RESULTS.md
evidence/yz-rd-t102/T099_CHECKPOINT.md
evidence/yz-rd-t102/UI_IMPROVEMENTS.md
frontend/assessment/assets/app.js
frontend/assessment/assets/runner.css
frontend/assessment/assets/runner.js
frontend/login/app.js
frontend/login/auth-fail-closed.test.mjs
frontend/login/index.html
frontend/login/login.js
frontend/package.json
frontend/student/courses/course-detail/course-api-adapter.js
frontend/student/courses/course-detail/course-api-adapter.test.mjs
frontend/student/courses/course-detail/course-player-state.js
frontend/student/courses/course-detail/course-player-state.test.mjs
frontend/student/courses/course-detail/index.html
frontend/student/courses/courses.test.mjs
frontend/student/growth/assets/growth-api-adapter.js
frontend/student/growth/assets/index-ByH3ToFf.js
frontend/student/growth/growth-api-adapter.test.mjs
frontend/student/growth/index.html
frontend/student/today/today.js
frontend/student/today/today.test.mjs
frontend/tests/assessment/t102-unanswered-submit.test.mjs
```

## Acceptance status

- [x] Sep 8 BASE identified from Git dates, parent chain, checked-in sources,
      tests, and historical acceptance evidence.
- [x] New isolated output branch created from the selected BASE.
- [x] Original student page hierarchy retained; no whole-page template or
      uniform card redesign was introduced.
- [x] Course route/activity IDs, published media mappings, optional API states,
      recommendations, and practice entry reviewed and regression-tested.
- [x] T099 partial/all-blank submission behavior reviewed, retained, and tested.
- [x] Growth sample loader replaced with current-school API data and an
      authorized recording URL flow.
- [x] T095 feedback class scope and atomic transition carried because Growth
      consumes those released records.
- [x] Required Codex-only execution rules added to project `AGENTS.md`.
- [x] Shared T005 and T101 worktrees remain unchanged; no shared merge or deploy.
- [ ] Authenticated course video playback and real browser/API E2E: **NOT_RUN**.
- [ ] READY_TO_MERGE: **NO** until the Owner reviews the branch and the P0
      playback E2E is run in an authorized isolated environment.
