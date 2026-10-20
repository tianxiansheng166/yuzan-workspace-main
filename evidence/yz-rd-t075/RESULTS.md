# YZ-RD-T075 Results

| Field | Result |
|---|---|
| TASK_ID | `YZ-RD-T075` |
| BASE | `d6fbf670bb6997cae0e841d8f9a397f0da785a42` |
| REPO | `/home/tian/code/yuzan-workspace-main` (resolved from the linked project Lane page) |
| WORKTREE | `/home/tian/code/yuzan-workspace-t075` |
| BRANCH | `feat/yz-rd-t075-student-course-continuity-web` |
| SOURCE_SCOPE | `frontend/student/courses/**` and its tests; no backend or shared student-player files changed |
| COURSE_CONTINUITY | `PASS_UNIT_AND_TEST_FIXTURE_ONLY; NATIVE_API_E2E_NOT_RUN` |
| NEXT_ACTIVITY | Deep link uses the server list's `nextActivity.id`; player selects the requested activity and chapter from the same course detail response |
| RESUME_ID | `TEST_FIXTURE_ONLY: fixture-submission`; no authorized runtime Submission was available |
| PROGRESS_PARITY | `PASS_UNIT_AND_TEST_FIXTURE_ONLY; CONTRACT_REQUEST_OPEN` |
| SUBMIT_IDEMPOTENCE | `PASS_UNIT_AND_TEST_FIXTURE_ONLY` — one in-flight submit request, submitted status reused after refresh |
| ERROR_AUTH | `PASS_UNIT_403_PROPAGATION; MEDIA_PERMISSION_UI_IMPLEMENTED; NO_RUNTIME_AUTH_E2E` |
| DESKTOP_CHROME | `PASS_FIXTURE_ONLY` at 1280×900 and 1440×1000; screenshots linked below |
| MEDIA_RUNTIME | `NOT_RUN` |
| API_LINT | `NOT_RERUN; 733 inherited API test lint findings recorded by accepted T068 evidence` |
| READY_TO_MERGE | `NO` |

## Implementation

- The course list preserves the server's progress value, displays “进度暂不可用” when that value is absent, and links directly to the server-provided next activity when present.
- Course detail restores a valid `activityId` from the URL before choosing the first incomplete activity. The hero and breadcrumb show the activity's unit and lesson.
- Activity completion and course percentages now follow persisted server progress. Client clicks no longer mark activities complete locally. Required course counts use the server aggregate; optional activities use their own server progress row.
- Video and audio save fractional positions, resume from the authorized server position, and mark completion only after media ends. Saves are serialized; a 409 refreshes course state and waits for a deliberate retry.
- Resource playback uses the existing authorized playback URL API. Expired media links retry once and can be retried from the page; a 403 displays a permission message.
- The formal “提交课程” button is enabled only at 100% server-confirmed required progress. Duplicate clicks share one request; a 409 reloads submission state before the student can retry.
- Unsupported activity types show an explanatory status without a completion action. The accepted backend `ActivityType` union is `TEXT`, `VIDEO`, `AUDIO`, `CHOICE`, `FILL_BLANK`, and `SPEECH`; `READING` is not currently part of that contract.
- Optional recommendations and statistics failures no longer block the authorized course detail. Missing statistics are not filled with zeroes or a fixed weekly goal.

## Route and contract audit

The existing student course controller scopes reads and writes to the authenticated student's school, active enrollment, and an open assignment using a published course version. The current API routes cover list/detail, create-or-resume Submission, activity attempt save, recording link, practice completion, and formal course submit. The work reuses these routes and the existing player/controllers.

The service computes completion from required activities and required practice sessions. It returns aggregate required-practice counts but not a `completedPracticeActivityIds` list. List `nextActivity` is selected from activity progress IDs; detail `nextActivity` is selected from each activity's `progress.completed`. Those fields do not identify which required practice activity remains incomplete if aggregate practice completion and activity progress diverge.

`CONTRACT_REQUEST`: include per-activity required-practice completion IDs in the existing course detail/list projection, or make the server's `nextActivity` use the same required-practice completion rule as `courseCompletion`. The front end cannot infer that mapping reliably from aggregate counts alone. No production API contract or backend code was changed in this task.

## Verification

- Node `v24.20.0`, pinned pnpm `10.13.1`.
- `corepack pnpm --filter @yuzan/frontend test`: **141 passed, 0 failed**; frontend runtime verifier passed.
- Targeted course adapter/player/media tests: **19 passed, 0 failed**.
- Changed JavaScript and the course-detail inline script parsed; `git diff --check` passed.
- Chrome `153.0.8010.52` ran the browser fixture. The fixture confirmed one activity-progress write returning 25%, directory selection of the speech activity with the matching URL activity ID, and one formal submit request returning `SUBMITTED`.
- Screenshots use only synthetic `TEST_FIXTURE_ONLY` content: [1280×900](desktop-course-1280x900.png), [1440×1000](desktop-course-1440x1000.png). Machine-readable fixture results are in [browser-fixture-results.json](browser-fixture-results.json).
- A subsequent parallel screenshot recapture stalled in headless Chrome. Only that rerun's task-owned Chrome processes and temporary profiles were stopped/removed; the earlier successful browser dump and screenshots remain the recorded fixture evidence.

The required native Nest/PostgreSQL E2E was **not run**: ports 4000, 4175, 55432, 6380, 59000, and 59001 had no listeners; `postgres`, `initdb`, `pg_ctl`, and `psql` were unavailable; no authorized course/activity records were accessible. No Docker, Compose, Worker, or media service was started. The browser fixture does not count as a native API/PG E2E. Media upload/readback is `NOT_RUN`.

Accepted T068 evidence records 733 inherited API test lint findings. This task changed no API source and did not rerun API lint. Both the inherited lint gate and the missing native E2E keep `READY_TO_MERGE=NO`.

## Policy note

The target checkout's `AGENTS.md` at BASE lacks the AA-DEV-V2.2 marker. The root `/home/tian/code/AGENTS.md` baseline and the Task Card's frozen scope/runtime rules governed the work; the checkout policy-version mismatch remains recorded here.

`FINAL_SHA` is reported in the task return after the evidence commit; the commit does not include its own SHA.
