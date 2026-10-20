# YZ-RD-T053 Results

**Task:** `YZ-RD-T053`
**Status:** E2E and regression evidence complete; branch pushed; `READY_TO_MERGE=NO` because the full API lint gate exits nonzero.
**Branch:** `feat/yz-rd-t053-course-authoring-unified-student-teacher`
**Final feature/evidence SHA:** recorded in the task return and branch `HEAD`.
**L4:** no Level 4 runtime data was applied or opened in the browser; see the source-preflight scope note below.

## Merge lineage

The T053 worktree was created from exact BASE `69eff46965b5c0bdd418a490319275aa7acfc4ab`. Accepted T049 source `0d9dca9765b37c8817c0a2bbebfa918fdbd64494` was integrated with a no-fast-forward merge. Merge commit `3de27d667c65b8f3d9dafb98ce2c53aa001b5162` has BASE as first parent and T049 as second parent. T050 personalized Today/mobile work remains in the first-parent lineage. The branch was kept independent; no shared branch was merged, force-pushed, or rewritten. See [merge-graph.txt](merge-graph.txt).

## Teacher authoring and publication

The native Chromium journey created a `TEST_FIXTURE_ONLY` course in the teacher course studio, added a unit and course activities through the real dialogs, and saved the version through the existing course-version API. The teacher selected a school-published practice in the studio and saved the relation through the T049 API. The test only queried the database to verify the resulting relation; it did not insert `CourseActivityPractice` rows with SQL. The teacher then published the course version and used the real Assignments UI to create and open an assignment for the authorized class.

Proof: `teacherAuthoring.createdThroughStudioUi=true`, course save HTTP 200, practice relation HTTP 200 with one persisted row, version status `PUBLISHED`; the class assignment was created/opened in the UI and reached `OPEN`.

## Student recording, manual review, and official report

An authorized student opened the assigned course from personalized Today, entered the course activity, recorded and previewed speech, uploaded the course recording to MinIO, and submitted the activity. The student followed the linked formal practice into the unified runner, played prompts, recorded four required responses, previewed them, uploaded them to MinIO, and submitted once. The task-owned MinIO bucket returned non-empty WebM/Opus objects for the course recording and four assessment recordings. The runner returned to the same course submission.

The speech scorer and Worker remained disabled. Browser audio used the fake Chromium microphone; these files prove capture/upload/review flow, not physical microphone quality. No automatic speech score was created. Before teacher review the assessment remained `PROCESSING` and had no formal report. The authorized teacher opened the review queue, listened to and replayed the stored recording, and manually reviewed all six queued items with the real review UI. Only after the last required review did the API create the official report. The same student opened that same report ID from History. The official overall score was 19; speech items were scored by the teacher, and no automated speech score was represented.

Proof: [t053-course-speech-proof.json](t053-course-speech-proof.json). It records the single course Submission, course/assessment MinIO object metadata, one practice submit POST, six manual reviews, no pre-review report, report ID `d062252e-0a56-4481-b23a-429eb8d13568`, and same-report History read. Screenshots at all four widths are in this directory.

## Authorization and identity isolation

The native flow asserted:

| Case | HTTP |
|---|---:|
| Anonymous practice-relation write / review queue | 401 |
| Student practice-relation write/options and review access/write | 403 |
| Cross-school teacher relation write | 403 |
| Missing activity / review detail | 404 |
| Stale or already-published relation write | 409 |
| Other-class course read | 404 |
| Cross-class/cross-school teacher review | 403 |
| Other student's report and history | 403 |

The proof's two `authorizationStatuses` maps retain the individual assertions.

## Native E2E, viewport, and regression results

The task-owned native Chromium + web + API + PostgreSQL + Redis + MinIO runner completed **2/2 new cross-role E2Es** in 46.11 seconds. PostgreSQL/MinIO data remains in the T053 runtime directory for evidence. Task-owned service cleanup returned `stopExitCode=0`; all five owned listeners were verified stopped. Docker and Compose were not used.

Today, teacher studio, assignment, course detail, course speech, practice runner, review queue/detail, and student formal report were captured at **390×844, 768×1024, 1280×900, and 1440×1000**. Every captured document/body width matched the viewport with no horizontal page overflow. Some decorative or navigation descendants extend outside a narrow viewport while their containing page remains clipped; the evidence records those nodes. Student report widths are individually recorded in `manualReview.studentReportViewports`. Screenshots and the complete per-page measurements are retained in this directory and `t053-course-speech-proof.json`.

| Regression | Result |
|---|---:|
| New native cross-role E2E | 2 passed / 0 failed |
| Focused API suites (12 files) | 158 passed / 15 skipped / 0 failed |
| Frontend suite + runtime verification | 137 passed / 0 failed |
| Contracts / OpenAPI / generated-type checks | 6 passed / 0 failed |
| API typecheck | PASS |
| Full API lint | FAIL, exit 1; exact counts below |

The 15 skipped API cases are in `prisma-course-version.repository.spec.ts`, which is environment-gated in this focused unit-test invocation; the browser E2E independently exercised the course-version and relation APIs against the task-owned PostgreSQL runtime.

Captured command output: [native-e2e.log](native-e2e.log), [api-focused-tests.log](api-focused-tests.log), [frontend-tests.log](frontend-tests.log), and [contracts-tests.log](contracts-tests.log). Runtime ownership and stop evidence is [native-runtime-evidence.json](native-runtime-evidence.json).

## Full API lint gate

Ran the unmodified `pnpm --filter @yuzan/api lint` command over both `src` and `test`; no ESLint rules were disabled and no automatic fixes or waivers were applied. It exited **1** with **1,201 errors and 1 warning** (1,202 problems), matching the inherited T050/T033 baseline.

| Scope | Errors | Warnings |
|---|---:|---:|
| `backend/api/src` | 1,037 | 1 |
| `backend/api/test` | 164 | 0 |
| **Total** | **1,201** | **1** |

Raw command output: [api-lint.log](api-lint.log). Scoped counts are also retained in [api-lint-counts.json](api-lint-counts.json). This unwaived gate keeps `READY_TO_MERGE=NO`.

## Scope and safety record

- T050 Today/mobile and T049 formal course-practice relation API are preserved in the merge ancestry and exercised in this flow.
- No four-card functional navigation fallback was introduced; the E2E asserts the personalized Today primary action and absence of `.today-skill-card` cards.
- No SQL was used to create the course-practice relation. No automatic speech score was fabricated.
- T005 source files were read-only; the importer recorded and compared source hashes before and after, with no change. No T005 worktree files were edited or staged.
- The Level 1 source importer was used to provide the official, versioned practice needed for a real manual-review/report flow. It applied only the 20-item Level 1 selection. Its preflight reports `Parsed items: 120` and `Selected: 20`, meaning the parser scanned the shared raw source set before selecting Level 1. No Level 4 record was applied to the task runtime, and no Level 4 activity/session was opened in the browser. If “touch L4” is interpreted to include any full-corpus parser read, that preflight crossed that boundary; the source-scan scope is disclosed here rather than described as a no-read run.
- Worker/scorer stayed stopped/disabled. No Docker/Compose, shared-branch merge, force Git operation, or L4 runtime workflow was used.
- The target checkout `AGENTS.md` lacks the AA-DEV-V2.2 marker. The user-provided `/home/tian/code/AGENTS.md` baseline governed; no Lane policy path was supplied.

## Readiness

`READY_TO_MERGE=NO` until the API owner resolves or explicitly waives the existing full-lint debt. All requested integrated flows and regression evidence are complete, and the independent task branch is pushed for review.
