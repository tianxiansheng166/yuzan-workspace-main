# YZ-RD-T027 Results

## Result contract

- `TASK_ID`: YZ-RD-T027
- `STATUS`: **BLOCKED** — bilingual safety renderer and native T022 route checks are implemented, but the native browser did not return from Practice Runner to CourseDetail after server completion, and this accepted T022 API contract does not declare `translationLocale`.
- `EXACT_T022_BASE_SHA`: `e456eac9b02a5abb4851525685cc5bd130d9af91`
- `OUTPUT_BRANCH`: `feat/yz-rd-t027-bilingual-activity-runner-parity`
- `COMMIT_SHA`: final Git HEAD is reported in the Commander return; the evidence commit cannot contain its own SHA.
- `PUSH`: task branch only, verified against `origin` after push. No shared merge.

The checkout had no AA-DEV-V2.2 marker or V5.12 policy file. This run followed the Task Card’s supplied V2.2 contract. No backend, contracts, APIClient, Server, TeacherShell, T005 course-detail, or other-owner source was edited.

## Bilingual renderer and safety

- `frontend/student/learn/spring-2/bilingual-renderer.js` is an isolated adapter. Strings normalize as `originalText`; object content renders its original text only. It never uses `translation` as the primary value and writes learner text through `textContent`.
- The Tibetan panel is available only when original text and translation are nonempty, `locale` matches `zh`/`zh-*`, `translationLocale` matches `bo`/`bo-*`, `reviewStatus === "EXPERT_CONFIRMED"`, and source is exactly `EXPERT` or `COMMUNITY`.
- Pure safety tests cover `zh`/`zh-CN`, `bo`/`bo-CN`, expert/community, machine/reviewed/pending/other sources, missing fields, wrong tags, nested values, malformed objects, and hostile HTML. Browser fixtures verify the closed state, badge, `aria-expanded`, `aria-controls`, `lang="bo"`, `dir="auto"`, Enter/Space/Escape, focus, seven bilingual placements, and preservation of an answer, note, selected choice, and playing audio.
- `frontend/student/learn/spring-2/bilingual-renderer.css` uses installed `Tibetan Machine Uni` as the Tibetan fallback, plus Chinese serif fallbacks; it adds a quiet outlined control, <250ms motion, reduced-motion handling, and mobile wrapping.
- The approved-looking Tibetan in the UI screenshots is **TEST_FIXTURE_ONLY**. It is not a teacher-approved course translation or linguistic validation. Real server-backed Tibetan visibility was not claimed.
- Audio/video may show an existing Chinese caption value. Native `<track>` elements are added only for authorized `SUBTITLE` WebVTT resources with `rightsStatus=APPROVED`; Tibetan tracks also require the exact review metadata. The current native course supplied no approved subtitle resources, so no tracks or generated transcript were shown.

## Accepted API contract and upstream request

The real authorized call was `GET /api/v1/schools/{schoolId}/student/courses/{assignmentId}` for published CourseVersion `e5669ac6-0614-4a0a-8f9c-6b824e89fd0b`, version 1. `courseVersion.objectives[0]` and `Activity.instruction` returned `originalText`, `locale`, `translationSource`, and `reviewStatus`; the T022 TEXT paragraph was a string. There was no `translationLocale` in the student response or accepted `BilingualContent` interface. No approved subtitle ResourceRefs were returned for AUDIO or VIDEO.

**`API_REQUEST` to the T005/data owner:** add and validate `translationLocale` on the published CourseVersion bilingual value contract and return it unchanged from the student-course GET for objectives, instruction, student notes, and supported content values. Declare the bilingual shape for `content.body`, `instruction`, paragraphs, prompt, options, and feedback instead of returning the tested paragraph as a plain string. For subtitles, preserve authorized `SUBTITLE` ResourceRefs and return the exact zh→bo source/review metadata with `rightsStatus=APPROVED`. The current `ResourceRef` mapper omits those review fields. Until that contract is committed and real reviewed content is available, server-bilingual full E2E is `NOT_RUN / BLOCKED_UPSTREAM_T005_CONTRACT`.

**`HANDOFF_REQUEST` after T005’s protected changes are safely committed:** keep CourseDetail as the long-term shell and its existing bilingual preview. Add a tested URL builder from the real `assignmentId`, `submissionId`, and `activityId` to `/student/courses/{assignmentId}/submissions/{submissionId}/activities/{activityId}`. Do not redirect every chooser click until parity and the three-way integration are certified; retain a safe fallback for blocked bilingual content. Keep server ActivityProgress canonical, and verify the course return from Practice Runner.

## CourseDetail handoff and Runner return

- The native CourseDetail click test selected an activity through `CoursePlayerState.setCurrentActivity(activityId)` and stayed at `/student/courses/course-detail/`. The T005 chooser-to-T022 route is **still blocked and not fixed here**. The separate dynamic T022 route opened directly with its real Assignment, Submission, and Activity IDs; this does not claim that the user funnel works.
- The full T022 lifecycle test reached the real Practice Runner, submitted the real Attempt, and received HTTP 201 from both `POST /assessments/sessions/{attemptId}/submit` and the course `practice-attempts/{attemptId}/complete` endpoint. PostgreSQL shows the Attempt `PROCESSING`, one `COURSE_PRACTICE` ActivityAttempt, and completed ActivityProgress. Chromium nevertheless remained at `/student/practices/attempts/{attemptId}/runner/` after the 60-second CourseDetail URL wait. This is recorded in [runner-return-proof.json](runner-return-proof.json). The return failure is outside this task’s allowed source set (`frontend/assessment/assets/runner.js` and `frontend/assets/api-client.js`); it remains a blocker for G2 and for the complete course journey.

## Persistence and native evidence

- The separate T027 native handoff test passed with a real published CourseVersion, Assignment, Student A Submission, Student B, NestJS, PostgreSQL 17, Redis 7, MinIO, and Chromium. Student B did not receive A’s Submission, Note, or ActivityProgress.
- The T022 lifecycle E2E exercised Note revision concurrency/reload, TEXT/CHOICE/FILL_BLANK/AUDIO/VIDEO/SPEECH/Practice progress, MinIO recording retry, and the Runner submit. Its final assertion failed only at the automatic Runner return; it is reported as **FAIL**, not PASS. The passing, focused current native proof is [native-handoff-proof.json](native-handoff-proof.json).
- Native Note: revision 8, reloaded from the server. PostgreSQL ActivityProgress is complete for all seven activity types. Speech Recording `4f32b507-a00e-4517-8fb3-2184e0bbccb9` is `COMPLETE`, uses key `recordings/4f32b507-a00e-4517-8fb3-2184e0bbccb9/full`, has idempotency key `course:<submissionId>:<speechActivityId>`, and MinIO HeadObject returned 30,331 bytes with `audio/webm;codecs=opus`.
- API JSON field details and the contract gap are in [api-contract-proof.json](api-contract-proof.json). The actual CourseVersion response and protected T005 chooser screenshot are in [native-handoff-proof.json](native-handoff-proof.json) and [chooser-remains-in-page-1280.png](screenshots/chooser-remains-in-page-1280.png).

## Verification

- `pnpm --filter @yuzan/frontend test`: **68 passed, 0 failed, 0 skipped**.
- Focused API read-only suite (student-courses, recordings, practice, curriculum publishing, assignments): **93 passed across 5 files, 0 skipped**.
- `node --test frontend/tests/assessment/t027-bilingual-renderer.test.mjs`: **5 passed, 0 skipped** (included in the 68 frontend tests).
- Browser UI parity fixture `test_yz_rd_t027_reviewed_tibetan_ui_gate_and_media_preservation`: **1 passed, 0 skipped**. It is an isolated fixture, not server-backed bilingual E2E. The code-only original, fixture-expanded Tibetan, 390px, and 1280px screenshots are [bilingual-original-1280.png](screenshots/bilingual-original-1280.png), [bilingual-approved-1280.png](screenshots/bilingual-approved-1280.png), and [bilingual-approved-390.png](screenshots/bilingual-approved-390.png).
- Native authorized T027 CourseDetail/API/Note/media/persistence test `test_yz_rd_t027_native_authorized_handoff_and_course_state`: **1 passed, 0 skipped**. It verifies 390/768/1280/1440 widths in the accepted T022 lifecycle run; see [activity-text-390.png](screenshots/activity-text-390.png), [activity-text-768.png](screenshots/activity-text-768.png), [activity-text-1280.png](screenshots/activity-text-1280.png), and [activity-text-1440.png](screenshots/activity-text-1440.png).
- Native full T022 lifecycle/automatic Runner return: **FAIL**, not skipped. Both relevant API requests returned 201 and PostgreSQL progress synchronized, but the browser did not reach CourseDetail. No automatic Runner return PASS is claimed.
- `node --check` for `player.js` and `bilingual-renderer.js`, Python syntax checks, and `git diff --check`: PASS.
- `NOT_RUN`: real server-approved Tibetan course E2E (contract gap and no verified translation sample), physical microphone, calibrated speech scoring, pilot, and production launch.

## Noninterference, runtime, and next gaps

- T005 dirty main checkout still has the same pre-existing course-detail and bilingual files plus the same untracked course resource directory; none was edited or staged. T025 was a separate, dirty worktree at startup and was clean at its independently advanced `c085ac2f15df90ddfdf0ccde7600e53aa31e860f` final HEAD; T027 did not write or stage it. The T026 worktree/branch appeared during this run; T027 did not read or modify its source or stop its services. T022 stayed at the exact accepted SHA and T024 remained separate.
- No Docker/Compose, P1SIM, `scripts/dev-native-web.py` edits, API/Prisma/contracts changes, force push, stash, reset, or clean were used. L4 remains **OPEN**.
- T027 owned PostgreSQL `yuzan_t027_native`, user `yz_t027`, bucket `yz-t027-native`, and ports PG 55656 / Redis 6456 / MinIO 59004–59005 / API 4097 / Web 4297. Final stop returned PASS: Web PID 2014520, API 2014503, MinIO 2014558, Redis 2014535, PostgreSQL 2014365 exited; all owned ports are free. Database and MinIO objects remain retained under ignored `runtime-local/native-web-t027`; screenshots and logs are in task evidence.
- This branch is for Commander handoff only and is not merged. Next gaps: T005/data owner commits the bilingual response contract and supplies real reviewed zh→bo content; the owner of Runner/APIClient resolves the observed auto-return path; Commander runs a later controlled T005→T022 integration without replacing the CourseDetail shell.
