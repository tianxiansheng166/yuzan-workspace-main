# YZ-RD-T101 — Student UI baseline restoration and course video contract fix

| Field | Result |
|---|---|
| `TASK_ID` | `YZ-RD-T101` |
| `STATUS` | `IMPLEMENTED_OFFLINE_VERIFIED` |
| `BASE` | `5e65f2582818387f1934d0d793056b76e402e67b` (T100 integration branch) |
| `VISUAL_BASELINE` | `03371f7287433dac7f09c99ff95729fb4c071652` (pre-T098) |
| `BRANCH` | `feat/yz-rd-t101-restore-student-ux-course-player` |
| `READY_TO_MERGE` | `NO` |
| `HISTORICAL_L4_INCIDENT_OPEN` | `YES` |

## User outcome

This task restores the existing student visual design instead of proposing another redesign. It also fixes a concrete media-contract gap that could make the course video player disappear even when a published activity's API-backed `content` contained a video URL.

## UI restoration

- Restored the original course-centre sunrise hero and the original Today/Courses/Growth theme tokens from the pre-T098 baseline.
- Removed T098's added visual override blocks (the bright blue/purple palette, contour masthead, and editorial grid treatments).
- Kept only 15 lines of targeted layout safeguards on top of the old CSS: natural scrolling, a 44px list-view favorite target, non-interactive decorative overlay, long-label wrapping in Today, Growth stage alignment, and final chart date-label anchoring.
- The six Today/Courses/Growth production HTML/CSS files differ from the pre-T098 baseline only by those targeted CSS layout safeguards; no route, API, data, course player, practice, recommendation, or report logic was rolled back.

## Course player root cause and fix

Teacher course authoring hydrates media fields from `activity.content` and saves them back inside that JSON object. The student-course API returns `content`, but the student `course-api-adapter.js` previously normalized `videoUrl`, `posterUrl`, and subtitle URLs only from top-level aliases. The player hides its video card when there is no linked VIDEO resource and the normalized `activity.videoUrl` is empty. Therefore nested published video metadata could be present in the real API response but be invisible to the player.

The adapter now maps `videoUrl`, `posterUrl`, `subtitleZhUrl`, `subtitleBoUrl`, and `timelineMarkers` from `activity.content` when no top-level value is present. A regression test covers the API response shape. This uses the existing server-backed course contract; no hardcoded course/video record was added.

## Verification

- `node --test frontend/student/courses/course-detail/course-api-adapter.test.mjs frontend/student/courses/course-detail/course-player-state.test.mjs frontend/student/courses/course-detail/media-controller.test.mjs frontend/student/courses/course-detail/course-practice-sync.test.mjs frontend/student/courses/course-detail/course-shell-visibility.test.mjs`: **23 PASS / 0 FAIL / 0 SKIP**.
- `corepack pnpm --filter @yuzan/frontend test`: **215 PASS / 0 FAIL / 0 SKIP**; includes the 100-file business-JS syntax gate and frontend runtime verifier.
- `git diff --check`: **PASS**.
- The adapter test proves that nested server video URL, poster, zh/bo subtitle URLs, and timeline markers reach the normalized student player contract.
- Native authenticated course Browser/API/PostgreSQL/MinIO E2E: **NOT_RUN**. Fresh screenshots/browser visual capture: **NOT_RUN**. No authorized isolated runtime was available in this task, so no live course record or media URL was accessed.

## Scope and safety

- Worktree is isolated at `/home/tian/.devspace/worktrees/yuzan-workspace-t072-55f78385`.
- T099 and T100 ancestry is preserved; no shared UAT/main changes, no deployment, and no PR merge.
- No Docker/Compose, database, importer, `local_sources/`, protected T005 paths, or Level 4 material was opened or modified.
- `L4_SOURCE_READ=NO`; `L4_IMPORT_APPLIED=NO`; `L4_RUNTIME_OPENED=NO`; `HISTORICAL_L4_INCIDENT_OPEN=YES`.
- Remaining blocker: confirm video playback against an authorized real course record in an already-authorized isolated Browser/API/PostgreSQL/MinIO runtime before any merge decision.
