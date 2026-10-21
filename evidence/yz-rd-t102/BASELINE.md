# YZ-RD-T102 Phase A — Historical baseline decision

Status: **BASELINE IDENTIFIED** (read-only source and history review complete)

## Decision

Use **`0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8`** as the product BASE.

| Fact | Evidence |
|---|---|
| Committer time | `2026-09-08T12:27:49+08:00` |
| Parent | `9b09c94143c2bf719ae6732c9a5279ac4ee21b3b` |
| Subject | `feat(assessment): personalize remediation outcomes` |
| Historical branch | `feat/question-bank-v1`, named in the Sep 8 handoff; the commit is reachable from that branch and all inspected later task branches |
| Date-window result | `git log --all` over Sep 7–10 found this as the latest reachable commit on Sep 8; no Sep 9 or Sep 10 commits were present in that window |

This is the last visible source state from Sep 8, after that day's student navigation, course-media, cover and scrolling work. `5619bdf48638a455692389d352ba1dad1a62658b` is dated Sep 7 at 23:52 and is named in the Sep 8 handoff as the *starting BASE for COMP-DEMO-05*. It predates the Sep 8 student changes, so it is not the end-of-day product state. `03371f7287433dac7f09c99ff95729fb4c071652` is dated Oct 21 at 11:28; its UAT invitation binding and role in the T098/T099 branches make it a recent integration point, not a date-matched product baseline.

The verified Sep 8 first-parent chain relevant to the student experience is:

| SHA | Local committer time | Parent | Student-facing change |
|---|---|---|---|
| `6274399dfb811ef3623b99ca82c3eadbd5b4e0e6` | Sep 8 00:16:59 +08:00 | `5619bdf48638a455692389d352ba1dad1a62658b` | Adds the course mind-structure detail view and corresponding course-detail wiring. |
| `15fda045b734525e8f6ad390a6a2290039576a1d` | Sep 8 08:29:13 +08:00 | `6274399dfb811ef3623b99ca82c3eadbd5b4e0e6` | Unifies Today navigation and its course destination. |
| `c480330c373e89b5a61371dce4af737e37fe91b4` | Sep 8 09:16:33 +08:00 | `15fda045b734525e8f6ad390a6a2290039576a1d` | Finishes course media behavior and visual cover polish; updates the adapter, player state, media controller, course detail and catalog. |
| `eda7dce661eb63cb8c42ed926e4dd9b51abf30f2` | Sep 8 09:22:37 +08:00 | `c480330c373e89b5a61371dce4af737e37fe91b4` | Lets the course directory follow document scrolling. |
| `0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8` | Sep 8 12:27:49 +08:00 | `9b09c94143c2bf719ae6732c9a5279ac4ee21b3b` | Last Sep 8 commit; assessment/remediation changes, with no student course, Today or Growth page changes. |

The full date-window history also contains the Sep 8 assessment commits between `eda7dce` and `0a7b931`, plus Sep 7 course import, catalog metadata persistence and speech/review work. No later Sep 8 student page change follows `eda7dce`.

## Product and acceptance evidence at BASE

This decision uses the source tree and the historical acceptance record, not the subject lines alone.

- `frontend/student/courses/courses.js` loads the server course catalog and routes a selected card to `/student/courses/course-detail/?id=<assignmentId>` using that returned card's ID. The catalog keeps search, filters, sorting, grid/list mode, favorites and paging controls.
- `frontend/student/courses/course-detail/course-api-adapter.js` calls the existing API client with the dynamic assignment ID, normalizes course units, lessons, activities, progress and practice references, and exposes authorization/network errors. Practice launch requires the assignment, submission and activity IDs plus the published practice definition ID. Recommendations, dashboard, notes, resources and course completion use API-client methods.
- `frontend/student/courses/course-detail/index.html` contains the real video player, lesson materials, course information, activity directory, recommendations, progress and formal-practice entry. `media-controller.js` binds playback events and persists video position through `CoursePlayerState`; the player resolves imported resource playback through the existing API. Student activity completion is linked to the current activity and course submission.
- Adapter, course-practice-sync and course-shell-visibility tests exist at BASE. The adapter tests cover the nested course aggregate, IDs and safe course return context. There was no dedicated player/media unit-test file at BASE, so the dated browser record is important evidence for actual playback.
- `CURRENT_HANDOFF.md` at BASE records the Sep 8 COMP-DEMO-05 browser acceptance for Today, Courses, course detail, the course runner, report and remediation runner. Its Sep 7 COMP-DEMO-03 record documents the course-center → course-detail path, a real imported lesson's MP4 loading and playback, PDF material, a persisted exercise after refresh, and the course-practice Runner entry. These are historical acceptance records only; no production data or runtime was accessed for this task.
- The same handoff documents the original Today, course-center and detail presentation, and identifies catalog labels such as missing teacher/activity count as known presentation debt. The September implementation has a distinct course-center hero, filters and list/grid catalog, a full course-detail/player hierarchy, the established Today page and the existing Growth application. This is the product structure to retain while fixing flow and layout.

At BASE, course media fields are normalized from the top-level activity fields. T101 later identified that published `activity.content` can also hold `videoUrl`, poster, subtitle and timeline fields; that later mapping gap is a candidate for a small, tested port. It does not invalidate the Sep 8 browser evidence for the course/media shape used then.

## T098–T101 comparison

| Task | Original SHA and relationship | Value and evidence | T102 decision |
|---|---|---|---|
| T098 | `17ff508075e51ab3fabf546d711a1e22023c44e6`, Oct 21 12:13 +08:00, parent `03371f7287433dac7f09c99ff95729fb4c071652` | Reworks Today, Courses and Growth HTML/CSS only. Its own fixture evidence says routes, API renderer code, course detail and player were unchanged; 199 front-end tests and 24 fixture captures passed. The user explicitly rejects this overall visual redesign. | Do not carry its global redesign into the Sep 8 product. Review its isolated layout fixes (natural course scrolling, target sizing, decoration hit testing, long-label wrapping and Growth alignment/date anchoring) for selective use. Its fixture did not prove live API behavior. |
| T099 | `f2c28565c4c2559c842f5bdc812a37133b3f75b6`, Oct 21 12:57 +08:00, parent `03371f7287433dac7f09c99ff95729fb4c071652` | Implements partial/all-unanswered attempt submission and safe scoring while retaining identity, state, upload, idempotency and course-sync guards. Evidence reports 214 front-end tests, 58 assessment/scorer tests, 15 adjacent tests, typecheck and targeted lint passing; native authenticated E2E was `NOT_RUN`. | Preserve this explicit product requirement if it can be transplanted onto Sep 8 assessment/Runner contracts. Port narrowly with regression tests; do not merge its branch wholesale. |
| T100 | Merge `4cc14de696285c3d3f0b16f0e04e4f1a5daf9bf8` has parents `60ee77d3ab791490015a3e3c3fff7aa413168353` (UAT/T098) and T099 `f2c28565...`; integration tip `5e65f2582818387f1934d0d793056b76e402e67b` | Integrates T099 on top of UAT's T098 redesign. T100's report records 214 front-end tests and focused T099 checks passing, inherited API setup failures plus a generated-client collection blocker, native E2E `NOT_RUN`, and no PR due credential permission. | It is not a BASE. It retains the rejected visual redesign and starts from the Oct 21 UAT state. Reuse only reviewed T099 code/tests. |
| T101 | `55770e4f051c4c7b58c054f92fdf76b320ec96a1`, Oct 21 14:42 +08:00, parent T100 tip `5e65f258...` | Removes T098 overrides to restore the Oct 21 `03371f7` look and adds nested `activity.content` video metadata mapping with an adapter regression. Report records 215 front-end tests, 23 focused course tests and `git diff --check`; authenticated playback E2E and fresh visual capture were `NOT_RUN`. T101 worktree is clean and its changes are committed. | Do not use T101 as the baseline. Reapply the nested media mapping and its focused test only after checking Sep 8 contracts; its UI restoration targets Oct 21 styling, not Sep 8. |

T098's overall UI treatment is the user-confirmed presentation regression. Its source review shows no route or API logic change, so no functional regression is proven by T098 itself. T100 inherits that visual treatment by merge ancestry. T101 restores an earlier-than-T098 October style, but its own base is still Oct 21 and it cannot establish what the student product looked like on Sep 8.

## Phase boundary

The exact isolated branch is now created from the selected commit at
`/home/tian/code/work/yuzan-workspace-t102` on
`feat/yz-rd-t102-recover-2026-09-08-student-baseline`. It was absent before
creation. The T101 worktree was clean and was left unchanged. The shared
`feat/question-bank-v1` worktree has existing uncommitted T005/course bilingual
changes; those remain untouched. The Phase A review used Git history, checked-in
source/tests and historical reports only. No database or production data was
accessed, and no service was started.

Phase A is complete. Production edits may now be planned on the isolated T102
branch; later feature ports remain subject to Phase D review.
