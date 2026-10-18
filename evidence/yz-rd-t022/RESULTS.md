# YZ-RD-T022 Results

## Status

`NEEDS_DECISION` — T022’s owned deep activity route passes the persistence, activity, media recovery, isolation, and native browser checks. The student course-detail chooser still does not link to that route. The route handoff belongs to T005’s protected `frontend/student/courses/course-detail/` files, which T022 did not modify. See the handoff note below.

## Git and ownership

- Exact base: `feat/yz-rd-t015-student-web-rollup@4475f418078e5800678a55b05d418d216962732e`.
- Output branch: `feat/yz-rd-t022-course-activity-learning-experience`.
- Isolated worktree: `/home/tian/code/yuzan-workspace-t022`.
- T022 owns the changes in `frontend/student/learn/spring-2/index.html`, `player.js`, `style.css`, and its own `evidence/yz-rd-t022/` artifacts.
- The target checkout does not contain an AA-DEV-V2.2 marker. T022 followed the task card and the supplied local safety baseline.
- T005’s shared checkout and protected course-detail files were not changed. T019, T020, and T021 files were not changed. No merge into the shared checkout was performed.

## Real course and database evidence

The E2E teacher created and published CourseVersion `4d3f7385-a06d-4624-88ab-93021535262a` through the existing API. The teacher created Assignment `3260f261-43ef-4b1e-89b8-e7f093e49a57`, then transitioned it DRAFT → SCHEDULED → OPEN through the existing APIs; PostgreSQL records revision 3. Student A’s real Submission is `4811dd3f-bddb-443f-97c8-18b62681847a`, using seeded fictional Enrollment `f1111111-1111-4111-8111-111111111111`. Dynamic Activity IDs and SQL projections are in [browser-proof.json](browser-proof.json).

The final PostgreSQL `StudentActivityNote` for Activity `2af33387-19df-4d7b-b6a7-5ae4faf0d1da` contains `断网时的草稿：重新联网后保存到 PostgreSQL。` at revision 5. The browser held the first save while the student entered the final text; both writes completed and the final value survived refresh. A 12-second pending request displayed an error state until its response arrived. Two tabs surfaced the actual server version and preserved the losing draft until the student chose the cloud version. Offline edits stayed visibly unsaved, the leave prompt appeared, reconnect saved the draft, and logout/sign-in restored it from the API. A stale note revision returned 409 without changing the row. The browser confirmed that note text did not appear in localStorage.

PostgreSQL `ActivityProgress` is complete for TEXT, CHOICE, FILL_BLANK, AUDIO, VIDEO, SPEECH, and the practice-linked activity. The ActivityAttempt rows contain the real acknowledgement, selected answer, fill text, Recording ID, and Practice Attempt ID. A stale progress revision returned 409 without changing the row. A no-resource video activity showed an error and remained incomplete.

## Speech and formal Runner

The speech flow used the existing recorder, Signed PUT, MinIO bucket `yz-t022-native`, Recording, SpeechJob, and course-recording link APIs. The browser test injected a network PUT failure, then a Signed URL 403. It also injected a course-link failure after MinIO upload and Recording completion. Each retry reused Recording `84456ab4-3f48-4e6c-82af-7c65c62509e0`; no second Recording was created. PostgreSQL records status `COMPLETE`, object key `recordings/84456ab4-3f48-4e6c-82af-7c65c62509e0/full`, one SpeechJob, and the linked course ActivityAttempt. MinIO `HeadObject` returned 30,331 bytes both before and after link recovery; the ETag and content type are in [browser-proof.json](browser-proof.json).

The practice activity used the existing `CourseActivityPractice` relation to published PracticeDefinition `70000000-0000-4000-8000-000000000003`, its real open Delivery, `createOrResumePractice()`, and the formal Runner. The server Attempt ID was `005484ed-7578-4fb1-8061-30744de1b526`; PostgreSQL links its existing Delivery ID, Course Activity ID, and Submission ID. The Runner submitted once and returned to course detail with the Assignment, Submission, Activity, and Practice Attempt IDs. The relation was inserted only as isolated E2E fixture setup because the current public teacher API has no writer for `CourseActivityPractice`; no schema or foreign key was added.

Audio and video used real existing project media files referenced by the teacher-created CourseVersion and returned in the authorized student course response. Their playback ended in Chromium before the page enabled completion, and the server persisted playback completion. Speech used Chromium’s fake media device to exercise MediaRecorder. The browser permission-denial error path was injected and created no Recording or progress; the physical microphone and OS permission dialog were not run. The worker remained stopped. No fake transcript or fallback media is shown when a resource is absent. The existing public upload API creates resources with `rightsStatus=UNKNOWN`, while the publisher rejects unknown rights; T022 therefore did not attach a new `ActivityResource` or bypass that rights check.

## Authorization and UI evidence

- Anonymous course read: 401.
- Wrong school: 403.
- Student B could not read Student A’s Submission (404), ActivityProgress (403), Note (B’s empty scoped note only), or Recording (403), or write A’s Submission activity (404). B’s course read returned only B’s own note/submission scope.
- Missing Assignment: 404.
- Stale Note and ActivityProgress revisions: 409.
- Responsive overflow checks and screenshots passed at 390, 768, 1280, and 1440 pixels. Keyboard completion used Space and Enter; choice navigation used the arrow key. ARIA course progress and activity navigation were checked, as was reduced motion.
- Screenshots: [390px](screenshots/activity-text-390.png), [768px](screenshots/activity-text-768.png), [1280px](screenshots/activity-text-1280.png), [1440px](screenshots/activity-text-1440.png), and [Runner return](screenshots/runner-return-course-1280.png).

## Verification

- Frontend suite: `pnpm --filter @yuzan/frontend test` — PASS, 63/63, 0 skipped.
- API targeted regression: student-courses, recordings, practice, curriculum publishing, and assignment services — PASS, 5 files / 93 tests, 0 skipped.
- Native browser E2E: `evidence/yz-rd-t022/run-e2e.sh` — PASS, 1 test / 0 skipped, Chromium 153 + NestJS API + PostgreSQL 17 + Redis 7 + MinIO.
- `node --check frontend/student/learn/spring-2/player.js`, Python compile checks, shell syntax, and `git diff --check` — PASS.
- Runtime: Node 24.20.0, pnpm 10.13.1, PostgreSQL 17.11, Redis 7.4.10, MinIO RELEASE.2025-10-15, Chrome 153.0.8010.52.
- No Docker or Compose was used. T022 database and objects are retained. L4 remains OPEN and its historical database volume was not accessed.

## Runtime ownership

T022 used its own database `yuzan_t022_native`, role `yz_t022`, MinIO bucket `yz-t022-native`, and ports PostgreSQL 55654, Redis 6452, MinIO 59000–59001, API 4092, and Web 4292. PostgreSQL was moved from port 55652 to 55654 after a bind collision on restart; the isolated database directory, credentials, and stored evidence were retained. The private config is ignored and mode 0600. Final PID exit and port status are recorded after T022’s owner-checked stop below.

- Stop: PASS. T022 PostgreSQL PID 607173, API PID 607662, Web PID 607758, Redis PID 607800, and MinIO PID 607811 exited through the identity-checked owner stop.
- Final status: PostgreSQL/API/Web/Redis/MinIO stopped; ports 55654, 4092, 4292, 6452, 59000, and 59001 free. No T022 Chromium/Playwright process remained. Database, bucket objects, SQL rows, logs, and screenshots remain retained.
- No Docker/Compose or other task’s services were stopped.

## T005 handoff decision

The existing course-detail page allows the student to select an activity, and the deep route `/student/courses/{assignmentId}/submissions/{submissionId}/activities/{activityId}` loads and persists the same dynamic records. The current T005-owned course-detail code does not navigate from its chooser into this deep route. T022 left that protected owner’s files unchanged. Commander should decide whether T005 will add that link or whether the existing in-page course-detail player remains the canonical entry. This is the remaining product-flow handoff represented by `NEEDS_DECISION`.
