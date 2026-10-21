# YZ-RD-T105 Results — Student Course Playback Acceptance

## Status

- **STATUS:** `BLOCKED_RUNTIME`
- **READY_TO_MERGE:** `NO`
- **BASE:** `375cef8cffcb955dc6dc76f6685ff41f96e3fbc8`
- **SOURCE_BRANCH:** `feat/yz-rd-t103-course-player-native-acceptance`
- **OUTPUT_BRANCH:** `test/yz-rd-t105-real-course-playback-acceptance`
- **WORKTREE:** `/home/tian/.devspace/worktrees/yuzan-workspace-t105`
- **DEPLOY / merge to UAT or main:** not performed
- **Product source changes:** none

T105 was not found in local task text/branch searches. The requested output
branch and target worktree path were absent before creation. The isolated
worktree was created at the exact T103 tip above. The T103 source worktree was
clean at preflight and was left untouched. T102, T104, T101, the shared main
worktree, UAT, and T005 files were not modified.

The repo and parent instructions plus `README-FIRST.md`, `CURRENT_HANDOFF.md`,
`CURRENT_TASK.md`, T102 `BASELINE.md` / `RESULTS.md`, and T103 `RESULTS.md` were
read. The three T102 Codex-only execution rules were followed. No plugin,
connector, MCP, application endpoint, database, object store, or production
data was used.

## Environment readiness

All checks in this section were read-only. No service was started, stopped,
inspected beyond the process/container listing, or contacted.

| Dependency | Observation | T105 readiness |
| --- | --- | --- |
| Node.js | v24.20.0 exists at `/home/tian/.nvm/versions/node/v24.20.0/bin/node`; `node` is not on the task shell's `PATH`. | Available by absolute path. |
| pnpm | 10.13.1. | Available. |
| Backend API | Repo default is port 4000; no listener. | Not running. |
| Frontend | Repo default is port 4175; no listener. | Not running. |
| PostgreSQL | Repo example port is 55432; no listener, no `.env`, and no `DATABASE_URL` variable name present. | No isolated DB identified or authorized. |
| Redis | Repo example port is 6380; no listener and no `REDIS_URL` variable name present. Worker/readiness code uses Redis. | Not running for T105. |
| MinIO / object storage | Example ports are 59000 / 59001; no listeners, no `.env`, and no endpoint variable name present. | No isolated endpoint or bucket identified or authorized. |
| Browser | Google Chrome 153.0.8010.52 and Firefox binaries are installed. | Browser binary available. |
| Automation driver | Python Playwright is absent; package manifests/lockfile declare no Playwright or Puppeteer driver. | No configured browser automation driver found. |
| Student test account | No T105 account or permission scope was supplied. | Not available for authorized login. |
| Real course / video resource | Requires the authenticated API and assigned student context. | Current course/resource availability is `NOT_RUN`. |

`docker ps` showed an unrelated T104-named container (`aa-int-t104-native`)
with no published ports in the listing. It was left untouched and was not
treated as T105 infrastructure. A listener exists on port 4001, while the repo
configures API port 4000; its owner and purpose were not established, so it was
not contacted.

### Required isolated environment to resume

The Owner must provide or authorize a dedicated T105 runtime with:

- A unique PostgreSQL instance/database and explicit connection scope.
- Dedicated Redis if required by API readiness/worker startup.
- A dedicated MinIO instance or bucket and explicit storage scope, populated
  only with an approved non-L4 course resource.
- Backend API and frontend bound to dedicated ports; the repository defaults
  are API 4000 and frontend 4175.
- Chrome plus a configured Playwright or equivalent browser driver.
- A student test account whose school/class scope is documented, an assigned
  published course containing a VIDEO activity, and the permitted assignment,
  activity, and resource IDs.
- Confirmation that the selected course and its media are authorized for this
  acceptance run.

Do not point T105 at the example `yuzan_dev` database, a shared MinIO bucket,
the T104 container, the unrelated 4001 listener, or any historic test runtime.
No environment provisioning was attempted because no resource names or Owner
authorization were supplied.

## Runtime acceptance results

| Required field | Result | Evidence / reason |
| --- | --- | --- |
| `API_TESTS` | `NOT_RUN` | No T105 API runtime was available; no test command was run. |
| `FRONTEND_TESTS` | `NOT_RUN` | Not rerun in T105. T103's prior evidence recorded 54/54 passing at its final source tip; this is historical evidence, not a T105 run. |
| `COURSE_PLAYER_TESTS` | `NOT_RUN` | Not rerun in T105. T103 previously recorded 18/18 fixture tests passing; no live browser/API behavior was covered. |
| `MEDIA_PLAYBACK` | `NOT_RUN` | No authorized API, signed playback URL, course resource, or browser test session. |
| `PROGRESS_SAVE` | `NOT_RUN` | No authenticated API/PostgreSQL write was made. Source has periodic/pause/end save calls, but no persistence result was observed. |
| `PROGRESS_RESTORE` | `FAIL` (source audit) | Saved position is retained in player state but is not applied to the video after metadata loads; see defect 1 below. Live playback was not run. |
| `RECOMMENDATIONS` | `NOT_RUN` | Fixture coverage exists for optional API failures; no live API response was observed. |
| `PRACTICE_ENTRY` | `NOT_RUN` | Fixture coverage exists for IDs and sync; no assigned course or live runner was available. |
| `AUTHENTICATED_BROWSER_E2E` | `NOT_RUN` | No authorized student account or app runtime. |
| `POSTGRESQL_E2E` | `NOT_RUN` | No authorized isolated database. |
| `MINIO_E2E` | `NOT_RUN` | No authorized isolated storage endpoint/bucket. |
| `NATIVE_E2E` | `NOT_RUN` | Blocked by the missing isolated runtime, credentials, assigned course, and browser driver. |

No API or browser error logs were generated because no request or playback was
attempted. The T103 fixture tests and the historical September browser record
are not represented as T105 real playback evidence. Course/activity/resource
IDs and account details are therefore unavailable; no historic credentials or
IDs were reused.

## Historical product reference

The September 8 baseline is `0a7b931a8dfd005eb7ba97aa0fe68e81169d61e8`.
T102's historical record describes the original catalog, course detail/player,
recommendations, progress and practice entry, and a September 7 browser run in
which `《春》生字认读与易错音纠正` played an imported MP4 for 3.1 seconds. That is
historic evidence only, not a current T105 course or resource check.

The T105 source tree retains the catalog/detail page structure, player, course
cover assets (`frontend/assets/cover-spring.png` and
`frontend/assets/course-bg/cover-spring.png`), recommendations, and practice
entry from the T103 branch. This was checked from files; no live visual or
interaction acceptance was performed. No redesign or product source edit was
made in T105.

## Test inventory audit

The inventory was read from Git trees and test files; **no test suite was run in
T105**.

### Current T103/T105 frontend inventory — 11 files

```text
frontend/login/auth-fail-closed.test.mjs
frontend/student/courses/courses.test.mjs
frontend/student/courses/course-detail/course-api-adapter.test.mjs
frontend/student/courses/course-detail/course-player-state.test.mjs
frontend/student/courses/course-detail/course-practice-sync.test.mjs
frontend/student/courses/course-detail/course-shell-visibility.test.mjs
frontend/student/courses/course-detail/media-controller.test.mjs
frontend/student/growth/growth-api-adapter.test.mjs
frontend/student/today/today.test.mjs
frontend/tests/assessment/comp-demo-04.test.mjs
frontend/tests/assessment/t102-unanswered-submit.test.mjs
```

### Historical inventories

| Snapshot | Frontend test files | Recorded test cases | Notes |
| --- | ---: | ---: | --- |
| Sep 8 product BASE `0a7b931...` | 4 | Not recorded in T102 evidence | `course-api-adapter`, `course-practice-sync`, `course-shell-visibility`, `comp-demo-04`. |
| T102 final source `f28a146...` | 10 | 51 | Adds login, course route, player state, Today, Growth, and unanswered-submit fixtures to the Sep 8 inventory. |
| T103 final source `375cef8...` | 11 | 54 | Adds `media-controller.test.mjs` with three media-event cases; T103 recorded 18 focused course cases and 54 full frontend cases. |
| T098 `17ff508...` | 30 | 199 | Oct 21 redesigned-tree fixtures; not the Sep 8 product tree. |
| T101 `55770e4...` | 31 | 215 | T098-era tree plus the T099 unanswered-submit test; its authenticated playback E2E was `NOT_RUN`. |

The four Sep 8 test paths were:

```text
frontend/student/courses/course-detail/course-api-adapter.test.mjs
frontend/student/courses/course-detail/course-practice-sync.test.mjs
frontend/student/courses/course-detail/course-shell-visibility.test.mjs
frontend/tests/assessment/comp-demo-04.test.mjs
```

T102's ten-file inventory is the current list above without
`frontend/student/courses/course-detail/media-controller.test.mjs`.
T103 added that file and three cases; the recorded 51-to-54 increase is not a
claim that live acceptance improved.

The T098 30-file inventory is the following T101 inventory without
`frontend/tests/assessment/t099-unanswered-submit.test.mjs`. The T101 paths
beyond the six same-name course/player and `comp-demo-04` files were:

```text
frontend/teacher-home/dashboard-model.test.mjs
frontend/teacher/submissions/detail/playback.test.mjs
frontend/tests/assessment/assignment-api.test.mjs
frontend/tests/assessment/recorder-truth.test.mjs
frontend/tests/assessment/student-history.test.mjs
frontend/tests/assessment/student-practice-runner-t012.test.mjs
frontend/tests/assessment/student-practice-state.test.mjs
frontend/tests/assessment/t013-growth-live.test.mjs
frontend/tests/assessment/t013-student-today.test.mjs
frontend/tests/assessment/t025-growth-feedback.test.mjs
frontend/tests/assessment/t027-bilingual-renderer.test.mjs
frontend/tests/assessment/t028-teacher-invitation-revocation.test.mjs
frontend/tests/assessment/t031-course-runner-return.test.mjs
frontend/tests/assessment/t032-roster-csv-export.test.mjs
frontend/tests/assessment/t034-roster-filter.test.mjs
frontend/tests/assessment/t037-student-showcase.test.mjs
frontend/tests/assessment/t038-practice-journey.test.mjs
frontend/tests/assessment/t045-mobile-catalog-hierarchy.test.mjs
frontend/tests/assessment/t076-practice-journey.test.mjs
frontend/tests/assessment/t081-practice-attempt-scope.test.mjs
frontend/tests/assessment/t099-unanswered-submit.test.mjs
frontend/tests/assessment/teacher-review-validation.test.mjs
frontend/tests/assessment/teacher-student-ux-polish.test.mjs
frontend/tests/assessment/teacher-studio-responsive.test.mjs
frontend/tests/assessment/today.test.mjs
```

The 199/215 case counts are not a quality ranking. Those branches test a later
Oct 21 tree with additional teacher, assessment, roster, practice, responsive,
and redesigned page behavior. T102 intentionally returned to the Sep 8 product
tree and carried only scoped behavior/tests; T101's T099 test was reauthored as
`t102-unanswered-submit.test.mjs` on this branch. The media and player-state
files share names across snapshots but their test bodies differ.

Current fixture coverage that remains relevant includes dynamic catalog and
detail IDs, nested published media mapping, fractional progress payloads,
optional recommendation/stat failure states, course-practice IDs and retry,
player visibility, native media error, video-end completion, and activity-bound
pause writes. It does not prove server authorization, actual media delivery,
database persistence, or activity progress restoration.

### Follow-up coverage to restore

- Add a course-player regression that seeds server progress, loads media
  metadata, and verifies the video seeks to the saved fractional position.
- Restore a partial-progress/timeupdate test and verify server position after
  re-entry.
- Add a failed progress-write test that verifies visible state and a safe retry
  or pending-write recovery path.
- Add a delayed-save activity-switch test that proves the old activity write is
  completed or retained before the learner leaves the current page.
- Retain a regression for server-authoritative `completed=false`, revision
  conflict refresh, and deliberate retry where those behaviors remain part of
  the current course contract.
- Run real authenticated Browser/API/PostgreSQL/MinIO E2E only after the Owner
  provides an isolated environment and approved course/account scope.

## Source-level defects recorded; not fixed in T105

These are source findings, not runtime observations. No test, API request,
browser session, or error log was generated for them.

### 1. Saved video position is not restored

- **Reproduction scenario:** return a VIDEO activity with server
  `progress.position = 0.4`, open the course, and load a 100-second video. The
  course state records `activityProgressMap[activityId].position = 0.4`, but
  `MediaController.onLoadedMetadata()` only records duration and updates the
  duration labels; no code assigns the saved position to `video.currentTime`.
  The expected resume point is 40 seconds; source leaves the video at its
  default position.
- **Location:** `frontend/student/courses/course-detail/course-player-state.js`
  lines 108–123 and `frontend/student/courses/course-detail/media-controller.js`
  lines 105–109.
- **Runtime/log status:** not reproduced in a browser; no logs, because the
  authorized runtime is unavailable.
- **Suggested repair scope:** consume the server's current activity position
  after metadata loads, clamp it to the valid duration, and add a focused
  media-controller restore test. Do not infer or fabricate progress.

### 2. Client can mark activity complete against an incomplete server response

- **Reproduction scenario:** have the save API return
  `progress.completed = false` and omit this activity from
  `courseCompletion.completedActivityIds`, then call
  `saveActivityAttempt(..., completed=true)`. The returned progress is stored,
  but the later `if (completed)` branch sets `activity.isCompleted = true`.
  The current T103 `course-player-state.test.mjs` does not contain the older
  server-authoritative completion regression.
- **Location:** `frontend/student/courses/course-detail/course-player-state.js`
  lines 365–380, especially 377–380.
- **Runtime/log status:** source-only reproduction scenario; not executed and
  no logs generated.
- **Suggested repair scope:** update local completion only from the server's
  returned progress/course-completion facts, and retain a regression where the
  server declines completion.

### 3. Failed video progress writes are silently discarded

- **Reproduction scenario:** reject `CoursePlayerState.saveActivityAttempt()`
  during a periodic save, pause, or end event. The media controller's catch
  handler is empty, so there is no student-visible failure, retry, or retained
  pending-write signal.
- **Location:** `frontend/student/courses/course-detail/media-controller.js`
  line 120.
- **Runtime/log status:** not injected or executed; no logs generated.
- **Suggested repair scope:** surface a persistent save status/error and retain
  a safe retry path without rebinding a pending write to a different activity.

The existing activity-switch code binds a pause write to the previous media
activity, but it does not await or track the write promise before clearing that
media. The pending-save/switch scenario remains unverified and should be covered
alongside the failure-recovery work above.

## Rollback

This task changes only `evidence/yz-rd-t105/RESULTS.md` and the factual T105
entry in `CURRENT_HANDOFF.md`. Revert the T105 documentation checkpoint commit
to remove this task's evidence. No product source, database, object storage,
shared worktree, or deployment state was changed.
