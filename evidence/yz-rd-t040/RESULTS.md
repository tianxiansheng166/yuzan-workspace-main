# YZ-RD-T040 — Course-to-speech player

| Field | Result |
|---|---|
| `TASK_ID` | `YZ-RD-T040` |
| `STATUS` | `ACCEPTANCE VERIFIED` |
| `REPO` | `/home/tian/code/yuzan-workspace-main` |
| `EXACT_LOCAL_WORKTREE` | `/home/tian/.devspace/worktrees/yuzan-workspace-main-t040` |
| `BRANCH` | `feat/yz-rd-t040-course-to-speech-player` |
| `START_SHA` | `0f6ea3710797612aa08f37944a9ab9d92f033da1` |
| `PRE_EXISTING_T040` | No T040 branch/worktree or local T040 changes were found; the primary workspace’s unrelated changes were preserved. |
| `FINAL_SHA` | Returned in the task response; this evidence file is part of the final commit. |
| `READY_TO_MERGE` | `NO` — inherited API lint debt is not waived (details below). |
| `L4_OPEN` | `OPEN / untouched` |

## Course activity flow

The authenticated Today course list exposed the API-authorized course assignment. Clicking that course opened Course Detail and created or resumed its real student `Submission`. The course directory now renders keyboard-accessible links into the focused activity player, with the exact server-issued `assignmentId`, `submissionId`, and `activityId`. A wrong-school course read returned 403.

The browser flow followed Today → authorized Course Detail → the course directory → the actual AUDIO activity. The activity page retained the existing paper, green, red, and highland visual language. Course activity URLs and back links retained their original course and submission context.

## Listening, recording, and attempts

- The browser loaded and played the checked-in course MP3 (`2.064s`) to `ended`. The first completed-progress PUT was deliberately failed with HTTP 503. The page showed the save failure, the database did not mark the activity complete, and retry persisted the AUDIO `ActivityAttempt` and completed `ActivityProgress`.
- The SPEECH activity used Chromium’s native `MediaRecorder` with the explicitly labelled `SIMULATED_MIC` input. The student completed the recording, previewed and stopped playback, then submitted it. The first signed MinIO PUT was deliberately failed. Retry reused the same idempotent Recording ID; PostgreSQL linked its `ActivityAttempt` and completed `ActivityProgress`, and MinIO `HeadObject` read back 32,931 bytes of `audio/webm;codecs=opus`.
- The linked `SpeechJob` stayed `CREATED` with `result=null`; the course practice Attempt stayed `PROCESSING`. No worker, AI transcription, automatic speech score, or report was produced.
- The formal course practice used one submit request. Its real Attempt and `COURSE_PRACTICE` ActivityAttempt were persisted, and the browser returned to the same course assignment, activity, and Submission with the submitted Attempt ID in the URL.

## Bilingual safety and layout

The course response contained no published Tibetan subtitle. The student player rendered no Tibetan subtitle track or unreviewed translation toggle. The existing bilingual renderer tests passed within the frontend suite: Tibetan assist requires expert-confirmed zh→bo metadata, and subtitles require an approved licensed WebVTT resource with matching review metadata. No unreviewed Tibetan subtitle was added or published.

The 390px SPEECH screenshot shows the course title and progress badge without overlap, the recorder, the explicit “完成录音” and “试听录音” steps, and the separate upload/complete action. The browser reported `documentWidth=390` at `innerWidth=390`.

## Native browser/API/database E2E

**PASS: 1 passed, 0 failed, 0 skipped.** Chrome 153 exercised the real web server and NestJS API against isolated PostgreSQL 17.11, Redis, and MinIO. The browser proof checks the API responses and PostgreSQL rows for the Submission, AUDIO/SPEECH ActivityAttempts, course progress, Recording, SpeechJob, formal practice Attempt, and course return. Browser errors: 0. Runtime service exit checks: all five owned services stopped; isolated database and MinIO data retained.

The teacher API created, published, scheduled, and opened the `TEST_FIXTURE_ONLY` course used by this E2E. The test inserted its `CourseActivityPractice` link directly into the task-owned database because the current API has no writer for that relation. All student identities, course content, assignments, Attempts, Recordings, and progress rows were isolated test fixtures.

The T040 flow did not need a bulk Question Bank import: it used the task-seeded course practice version and checked-in audio. A preliminary generic importer invocation had a clean read-only preflight (120 items, 126 media, 0 errors/warnings) but its apply step hit `PracticeSection_versionId_fkey`; that optional importer is not part of this acceptance path. No original source files were modified.

## Checks and evidence

- Frontend: `pnpm --filter @yuzan/frontend test` — 133 passed, 0 failed, 0 skipped; runtime verification passed.
- Native E2E: `python3 tests/e2e/assessment/run_yz_rd_t040_native.py` — 1 passed, 0 failed, 0 skipped. API build, migrations, and seed completed in the task-owned runtime.
- JavaScript/Python syntax and `git diff --check` — passed.
- Full API lint was not rerun for T040. The accepted T046 checkpoint records the inherited T033 baseline as 1201 errors / 1 warning; it remains unwaived, so `READY_TO_MERGE=NO`.
- Screenshots: [`today-authorized-course-1440.png`](screenshots/today-authorized-course-1440.png), [`course-listening-1440.png`](screenshots/course-listening-1440.png), [`course-speech-1440.png`](screenshots/course-speech-1440.png), [`course-speech-390.png`](screenshots/course-speech-390.png).
- Structured browser/API/database proof: [`native-flow-proof.json`](native-flow-proof.json). Test output: [`native-e2e.log`](native-e2e.log). Runtime and owned-port shutdown proof: [`native-runtime-evidence.json`](native-runtime-evidence.json).

## Policy and scope

The target checkout’s `AGENTS.md` has no `AA-DEV-V2.2-20261017` marker, and the Task Card supplied no Lane policy reference. The user-provided `/home/tian/code/AGENTS.md` safety baseline and the accepted T046 runtime/scoring constraints governed this work. No T005 source, shared API contract, schema, or original course material was changed. No Docker/Compose, Worker, shared-branch merge, L4 access, or calibrated speech scoring was used. Physical microphone/device, school pilot, and production remain `NOT_RUN`.
