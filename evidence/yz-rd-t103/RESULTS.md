# YZ-RD-T103 Results

- **STATUS:** focused implementation and fixture verification complete; real
  playback acceptance remains open
- **READY_TO_MERGE:** `NO`
- **DEPLOY:** forbidden; not performed
- **SHARED_BRANCH_MERGE:** forbidden; not performed
- **PRODUCTION_DATA_ACCESS:** not performed

## Baseline, branch, and ownership

- **Task BASE:** `f28a1461930642bf33010beeedd67b3d88f28851`
- **Product-history baseline:** `0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8`
- **Final functional commit SHA:** `cd3dad299e0e0de28024a0a15bc9c6c4ff4724f3`
- **Branch:** `feat/yz-rd-t103-course-player-native-acceptance`
- **Worktree:** `/home/tian/code/work/yuzan-workspace-t103`
- This worktree was created from the exact T102 task BASE. The requested output
  branch and worktree path were absent before creation; neither was reset or
  overwritten.
- At preflight, T102 was clean on
  `feat/yz-rd-t102-recover-2026-09-08-student-baseline` at the requested BASE.
  A later read-only status check found that worktree on a T104 branch with
  uncommitted `backend/api/package.json` and `pnpm-lock.yaml` changes. Those
  concurrent changes were left untouched.
- T101 was inspected at
  `/home/tian/.devspace/worktrees/yuzan-workspace-t072-55f78385`; its
  `feat/yz-rd-t101-restore-student-ux-course-player` worktree was clean and was
  not modified.
- The target `AGENTS.md` has no `AA-DEV-V2.2` marker. The task-specific contract
  and `/home/tian/code/AGENTS.md` were followed. The shared-file ownership list
  was checked; no shared contract, schema, backend, protected source, or T005
  file was changed.
- The shared `feat/question-bank-v1` worktree was status-checked and remains
  dirty with existing course/bilingual work and the untracked
  `习题课程资源/` directory. It was not staged or modified.

## Flow audit

The student catalog calls the authenticated student-courses API and routes each
card with its returned `assignmentId`. The detail route loads that dynamic ID;
the API controller requires the student role, and the service checks the active
student enrollment plus an open assignment targeting that enrollment or class.
The detail response supplies the actual unit, lesson, activity, resource,
progress, and practice-reference IDs.

The T102 adapter maps published media fields from `activity.content` when
top-level aliases are absent. When a linked VIDEO resource exists, the page
passes its returned `resourceId` to the existing authenticated, school-scoped
playback-URL endpoint and loads the server-returned signed URL.
The published `videoUrl` field remains the existing fallback when no linked
VIDEO resource is present. No fixed course, media, assignment, submission,
activity, practice ID, or video URL was added to production code. The service
and API contract were not changed.

`CoursePlayerState` sends the dynamic assignment, submission, activity, and
expected progress revision. The API DTO accepts `videoPosition` from 0 to 1;
the service stores that fraction and uses an explicit `completed` value. The
existing recommendation and course-practice flows remain present and covered by
the course-state/adapter tests.

## Defects reproduced and fixes

Three new media-controller regression tests failed before the fix:

1. A browser `video` error after a playback URL was returned left a black player
   with no durable explanation; only playback-URL request failures had a toast.
2. The `ended` handler reset the display to `0:00` and did not save the final
   position. Periodic and pause saves always sent `completed: false`, so the
   server could not mark a fully watched video activity complete.
3. Activity selection updated player state before asynchronous media resolution
   finished. A pause from the previous video could therefore be written using
   the newly selected activity ID, and an older playback-URL response could
   replace the newer activity's media.

The minimal player changes add an accessible in-player error region for native
load and play failures, clear the empty HTML source placeholder, show an
unavailable message when an activity has no video, save final position `1` with
completion on `ended`, retain the ended progress display, bind pause writes to
the media's activity ID/type, clear the old media during activity changes, and
ignore stale playback-URL responses. Resource playback still goes through the
existing signed-URL API; no hardcoded URL or authorization bypass was added.

## Changed files

- `frontend/student/courses/course-detail/index.html`
- `frontend/student/courses/course-detail/media-controller.js`
- `frontend/student/courses/course-detail/media-controller.test.mjs`
- `frontend/student/courses/course-detail/style.css`
- `CURRENT_HANDOFF.md`
- `evidence/yz-rd-t103/RESULTS.md`

No backend API, database schema, contract, shared branch, deployment, or
protected source file was changed.

## Tests and checks

| Check | Result | Details |
| --- | --- | --- |
| Existing focused course tests before fix | **PASS** | 15/15 catalog, adapter, state/progress, practice-sync, and shell-visibility tests. |
| New media regression tests before fix | **FAIL, expected red** | 3/3 failed: native error stayed hidden; end-completion and activity-binding cases exposed missing player support. Source review confirmed `ended` did not save final progress. |
| Focused course tests after fix | **PASS** | 18/18, including all three media regressions. |
| Full frontend test command `pnpm --filter @yuzan/frontend test` | **PASS** | 54 passed, 0 failed, 0 skipped; runtime verifier passed. |
| `git diff --check` | **PASS** | No whitespace errors. |
| Failures in final focused/full runs | **0** | The three expected pre-fix failures are documented above. |
| Skipped tests in final focused/full runs | **0** |  |
| Browser/API/PostgreSQL/MinIO E2E | **NOT_RUN** | No authorized isolated runtime was available. |
| Actual video playback | **NOT_RUN** | Unit tests exercise media events only; they are not real playback acceptance. |

## Runtime readiness and known issues

`docker ps` showed no running containers. The repo's example API/PostgreSQL/
MinIO ports (`4000`, `55432`, `59000`, and `59001`) had no listeners. No API,
database, or storage service was started or contacted, and no production or
shared runtime was used. Consequently, authenticated course entry, current
resource authorization, signed-media delivery, browser playback, persisted
progress, and live practice/recommendation actions remain unverified.

The media-controller tests use a DOM/event fixture and prove the local player
state transitions only. They must not be treated as real Browser/API/Postgres/
MinIO E2E. **Keep `READY_TO_MERGE=NO` until the authorized real-course playback
acceptance passes.**

## Rollback

Revert the evidence/handoff checkpoint commit first, then revert functional
commit `cd3dad299e0e0de28024a0a15bc9c6c4ff4724f3`. The evidence/handoff commit
SHA is reported in the final task return. No deployment or shared merge needs to
be rolled back.
