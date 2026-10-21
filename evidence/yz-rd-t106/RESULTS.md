# YZ-RD-T106 — Course Video Progress Reliability

## Status

- **STATUS:** `PASS`
- **READY_TO_MERGE:** `NO`
- **DEPLOY / shared merge:** not performed; forbidden by the task
- **HISTORICAL_L4_INCIDENT_OPEN:** `YES`; no Level 4 content was read or used
- **BASE:** `78de341e4fcebf930173a9b40e93cbc5c6c10526`
- **OUTPUT_BRANCH:** `fix/yz-rd-t106-course-video-progress-reliability`
- **WORKTREE:** `/home/tian/.devspace/worktrees/yuzan-workspace-t106`
- **FINAL_SHA:** `89d6b9273b76be08d0a66344852c7aba2d8d5a42` — product source and regression-test commit; the final evidence checkpoint commit is reported in the execution receipt
- **REMOTE_SHA_MATCH:** `YES` — verified against the final pushed branch tip; the exact tip is in the execution receipt
- **WORKTREE_CLEAN:** `YES` — verified after the final evidence commit

The exact BASE equals the remote T105 branch tip. The local task search, target path, and output branch were unoccupied before T106 creation. T105 changed only `CURRENT_HANDOFF.md` and its T105 evidence file.

The repository and parent `AGENTS.md`, `README-FIRST.md`, `CURRENT_HANDOFF.md`, `CURRENT_TASK.md`, T102 baseline/results, T103 results, and T105 results were read. All three T102 Codex-only execution rules were followed. No project development, test, or Git operation used a plugin, connector, or MCP tool. The supplied Notion policy/routing/lane URLs were inaccessible in the available web reader; the target checkout also lacks the V2.2 marker. The local root/repository rules and the task card remained the operative instructions.

### Protected workspaces

- T101, T103, and T105 worktrees remained clean and untouched.
- The T102 path currently contains the independent T104 branch; it was clean and untouched.
- The shared `feat/question-bank-v1` workspace remains dirty with its pre-existing T005/course-authoring changes. None of those changes were staged or modified.
- No T104 package or lockfile, backend code, OpenAPI/contracts, migration/schema, `local_sources/`, or protected L4 material was changed.

## File ownership

Product changes are limited to the course player state, media controller, their browser-visible progress feedback, and their tests:

- `frontend/student/courses/course-detail/course-player-state.js`
- `frontend/student/courses/course-detail/course-player-state.test.mjs`
- `frontend/student/courses/course-detail/media-controller.js`
- `frontend/student/courses/course-detail/media-controller.test.mjs`
- `frontend/student/courses/course-detail/index.html`
- `frontend/student/courses/course-detail/style.css`

Acceptance evidence is in this directory. `CURRENT_HANDOFF.md` receives only a factual T106 checkpoint. No product-wide UI redesign or unrelated flow changes were made.

## Defects and fixes

### A. Saved video position was not restored

The course adapter and player state receive `ActivityProgress.position` as a fraction from 0 to 1, but `loadedmetadata` only updated the duration display. The saved fraction was never applied to `video.currentTime`.

The media controller now reads the server-backed progress map after finite duration metadata is available, clamps the fraction and resulting position, and restores once per activity/source. It ignores metadata for a media activity that no longer matches the selected activity. Zero position remains a normal start. No local storage value is used as learning progress.

### B. A client completion flag could override an incomplete server response

After storing `result.progress`, `saveActivityAttempt(..., completed=true)` unconditionally set `activity.isCompleted = true`. A response with `progress.completed=false` could therefore appear complete in the page.

The local completion state now follows server progress and server course-completion data. A 409 response is recognized by HTTP status as well as the legacy conflict code; the page refreshes server state and notifies subscribers. Sequence guards prevent an older save response from replacing a newer course-completion response or a state refreshed after a conflict. Video, audio, speech, and practice completion rules and API contracts were not changed.

### C. Progress save failures were silently discarded

The media controller used an empty promise catch. Save errors were invisible and there was no safe retry path.

Media writes now serialize and deduplicate per activity while retaining the captured `activityId` and the newest local position. A failed write stays visible in an accessible player alert. Retry first reloads that activity's server progress. It treats an already-confirmed write as saved, preserves a later server position, and only retries when the server state shows that the pending value is still safe. Failures do not trigger an automatic retry loop. A retry for one activity cannot write to the activity selected later.

## Regression and code-gate results

| Check | Result | Details |
| --- | --- | --- |
| Pre-fix defect reproduction | **FAIL, expected red** | The initial 16-test run showed six failures directly matching the reported bugs: server-incomplete completion override, saved-position restore/clamp, repeated `ended` writes, invisible save failure, and lost-response reconciliation. One activity-switch failure in that first run was caused by the fixture setting `currentTime` before `loadedmetadata`; the fixture was corrected to model the browser reset. The stale-server retry case was also made to enter the failure path before being accepted. |
| Focused course tests | **PASS, 34/34** | Catalog route 2, Course API adapter 7, player state 8, media controller 14, practice synchronization 2, shell visibility 1. |
| Player state + media controller | **PASS, 22/22** | Includes server-confirmed true/false, 409 refresh notification, stale concurrent responses, fractional restore/clamp, duplicate `ended`, 403/503/network/response loss, 200/201 acknowledgements, checked retry, and activity switch. |
| Full frontend tests | **PASS, 70/70** | `pnpm --filter @yuzan/frontend test`; 0 failed, 0 skipped. |
| Frontend runtime verifier | **PASS** | Ran through the full frontend test command and separately with `pnpm --filter @yuzan/frontend build`. |
| Business JS syntax gate | **PASS** | `node --check` on both changed product JS files and both changed test modules, using Node `v24.20.0`. |
| `git diff --check` | **PASS** | No whitespace errors. |
| Standalone backend API test suite | **NOT_RUN** | Backend/API source was not changed. Real authenticated API routes were exercised by the isolated browser/API/PostgreSQL/MinIO run below. |

### Acceptance status

| Area | Result | Evidence boundary |
| --- | --- | --- |
| API_TESTS | **NOT_RUN** | Standalone backend API suite was not run; authenticated real API endpoints were exercised during native E2E. |
| FRONTEND_TESTS | **PASS** | Full frontend suite `70/70`. |
| COURSE_PLAYER_TESTS | **PASS** | Focused course flow `34/34`; player state and media controller `22/22`. |
| MEDIA_PLAYBACK | **PASS** | Chrome decoded and displayed frames from the signed MinIO media object during actual playback. |
| PROGRESS_SAVE | **PASS** | Native API persisted partial and ended progress; failure and retry cases are regression-tested in isolation. |
| PROGRESS_RESTORE | **PASS** | Reloaded course restored the saved server fraction to the corresponding media time. |
| RECOMMENDATIONS | **PASS** | Real recommendation API response opened its dynamic course detail route. |
| PRACTICE_ENTRY | **PASS** | Student action created/resumed an attempt through the real API and loaded the preparation route. |
| AUTHENTICATED_BROWSER_E2E | **PASS** | Dedicated student login and real course journey in Chrome. |
| POSTGRESQL_E2E | **PASS** | Fresh T106 database; migrations, published test course, and activity progress were read/written through the API. |
| MINIO_E2E | **PASS** | Approved CC0 video stored in the dedicated T106 bucket; signed range requests returned HTTP 206. |
| Fault-injected browser E2E | **NOT_RUN** | 403, 409, 503, network loss, response loss, and activity-switch races are covered by focused automated tests; the browser runtime did not inject these failures. |

## Isolated runtime and real playback acceptance

The owner explicitly authorized a fresh T106-only runtime. Docker Compose project `yz-rd-t106` uses dedicated PostgreSQL, Redis, MinIO, API, and frontend services. Published host ports are all bound to `127.0.0.1`; the application containers share only the T106 Docker network. PostgreSQL and MinIO use distinct volumes `yz-rd-t106-postgres-data` and `yz-rd-t106-minio-data`. All 32 repository migrations applied successfully. PostgreSQL and Redis health checks passed; MinIO readiness returned HTTP 200; the student site returned HTTP 200. API and frontend ran on Node `v24.22.0` inside their containers.

The test database contains one school, one active student membership and enrollment, one disabled teacher author with no active membership, two courses, three assignments, and one approved video resource. The login used a dedicated T106 student account with `STUDENT` role only. Passwords and tokens are held in mode-600 runtime files outside the repository and are not included in evidence.

The media object is MDN's `flower.mp4` from its `cc0-videos` path. The [MDN interactive-examples repository](https://github.com/mdn/interactive-examples) is licensed CC0-1.0; the [asset URL](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4) was copied into the dedicated T106 MinIO bucket and stored as a school-scoped `VIDEO` resource with `rightsStatus=APPROVED`. SHA-256: `0cd83d944a6ca7822b4a8306cecc60a36e859b041f6702c6a1ad9ead78924451` (1,128,375 bytes). No hardcoded media URL was added to product code.

### Authenticated browser flow

- **Authenticated browser:** `PASS`. Chrome `153.0.8010.52` logged in with the dedicated student account and opened the course center.
- **Course detail:** `PASS`. The student selected a published T106 assignment returned by the student-courses API; the detail page used its dynamic assignment ID and returned activities and a school-scoped resource ID.
- **Actual video playback:** `PASS`. The page received a signed URL from the resource playback API. Chrome loaded the object from `minio:9000`; MinIO served HTTP 206 range responses. A decoded 960×540 frame was observed at media time 1.468 seconds; video duration was 5.055 seconds. Screenshot: [real-video-playback.png](real-video-playback.png).
- **Progress save and restore:** `PASS`. A partial position was saved by a real API PUT (HTTP 200), persisted in the isolated PostgreSQL row with `completed=false`, then restored after reloading the course. In the final-source browser run, saved fraction `0.687` restored to `3.472` seconds of the 5.055-second video.
- **Activity isolation and completion:** `PASS`. Progress is stored under separate activity IDs. The first activity remained partial/incomplete; the second activity's server-confirmed position was 1 and completion was true. Course completion remained 50%, reflecting the other required activity still incomplete. The full journey run observed HTTP 200 for the ended-progress PUT.
- **Recommendations:** `PASS`. The recommendation API returned the assigned same-school course, and its real dynamic detail link opened successfully.
- **Practice entry:** `PASS`. The course CTA created or resumed an attempt through the real API (HTTP 201); the authenticated browser opened the attempt preparation route and loaded attempt/items data.
- **Browser/API/storage errors:** 0 API HTTP errors, 0 media failures, and 0 browser console errors. Media requests canceled with `net::ERR_ABORTED` during deliberate source replacement/page navigation were observed (two in the final-source run); no failed media response occurred.

The sanitized run details, activity ID prefixes, database/storage names, response counts, and progress rows are in [native-e2e-summary.json](native-e2e-summary.json). The course and student records were created only in this isolated database through the repository's Prisma data models; this was not a fixture response. This acceptance does not claim that a production or pre-existing school course is available.

The exception paths (permission denial, conflict, temporary server failure, lost response, and retry) were validated with focused automated regression tests. They were not artificially induced in the real browser/API runtime, so the native E2E claims apply to the successful authorized playback and save journey.

## Known limits and unresolved blockers

- `READY_TO_MERGE` remains `NO` per the task card. This branch has not been merged or deployed.
- The native playback run used a published T106 test assignment and approved CC0 resource in an isolated environment. It does not validate production course availability or production authorization data.
- The historical L4 incident remains open and was not accessed.
- Policy, routing, and lane Notion pages were inaccessible in the available web reader; no repo or policy changes were made to compensate.

## Rollback

Revert product/source commit `89d6b9273b76be08d0a66344852c7aba2d8d5a42` to roll back the code and tests. The evidence/handoff checkpoint is a separate commit and its ID is reported in the final execution receipt. The T106 database and object-store volumes are separate; no shared database or storage resource needs rollback.
