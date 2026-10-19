# YZ-RD-T031 Results

## Result contract

- `TASK_ID`: YZ-RD-T031
- `STATUS`: **DONE / WEB_ONLY**
- `ACCEPTANCE_SCOPE`: **ACCEPTED — Runner return reliability only; Commander integration remains pending. The full T005 chooser-to-T027 route is not READY_TO_MERGE_SHARED.**
- `BASE_SOURCE`: `feat/yz-rd-t027-bilingual-activity-runner-parity@deede5b767da8b067c6b51d754039e265e55fe34`
- `OUTPUT_BRANCH`: `feat/yz-rd-t031-course-runner-return-reliability`
- `COMMIT_SHA`: final Git HEAD is reported in the Commander return; an evidence commit cannot contain its own SHA.
- `PUSH`: task branch only; final remote/local alignment is reported in the Commander return. No shared merge.
- Target `AGENTS.md` has no AA-DEV-V2.2 marker. This task followed the user-supplied V2.2 rules.

## Original failure and confirmed cause

T027's retained [runner-return-proof.json](../yz-rd-t027/runner-return-proof.json) records the original browser path `/student/practices/attempts/d3a5edd7-f510-4e8d-aa53-93c05438f468/runner/` after the 60-second CourseDetail wait. The real assessment submit and course-practice complete calls both returned **201**. PostgreSQL recorded the same Attempt as `PROCESSING`, one `COURSE_PRACTICE` ActivityAttempt, and completed ActivityProgress at revision 1.

The exact T027 source made two competing navigation writes on that path: `retryCoursePracticeCompletion()` set `location.href` inside `frontend/assets/api-client.js`, then `frontend/assessment/assets/runner.js::submit()` set `location.href` again from the returned `navigateTo`. The isolated T031 baseline replay reproduced the consequence: Chromium's URL wait rejected with `net::ERR_ABORTED; maybe frame was detached?` while the page still reported the Runner URL; the main-frame event for CourseDetail arrived after that wait failure. There was no page error or `beforeunload` dialog. The captured baseline is [baseline-runner-return.json](baseline-runner-return.json), with the raw trace in [baseline-repro.txt](baseline-repro.txt).

The original T027 report describes the user-visible Runner stall. The T031 replay confirms the overlapping navigation race and also shows why the old lifecycle assertion could report failure while navigation was still settling. The final test waits on the real page URL and counts the actual destination navigation.

## Fix and recovery behavior

For the formal Course Practice Runner path, ApiClient now reads the actual AssessmentSession, PracticeAttempt linkage, and ActivityProgress before attempting any write. It only posts course completion if server progress is not already complete. After a completion error it reads server state again, so a committed 201 with a dropped browser response is confirmed without repeating submit or creating another Attempt. The return preflight reads the authorized student course and verifies Assignment, Submission, and Activity membership; its response shape places the activity tree in top-level `units`.

ApiClient returns the server-confirmed `navigateTo` in strict Runner mode and does not navigate there. Runner owns one `location.assign`. The launcher stores the dynamic Assignment, Submission, Activity, Attempt, Enrollment, user, school, and same-origin CourseDetail return URL. Strict return validation requires the exact CourseDetail path and matching `id`, `submissionId`, `activityId`, and Attempt. Invalid or cross-origin destinations fall back to `/student/courses/`.

If the Session submit succeeds but course sync cannot be confirmed, local context remains `PENDING` with `submitStatus=CONFIRMED`; the Runner says **“练习已交卷，课程同步待核实”**, keeps a clickable course return link, and offers a safe sync retry. A refresh of a submitted Runner re-reads the same Attempt and progress. A 401/403/404 or identity change clears cached course contexts plus user/school session data and offers the current course directory. A 409/network ambiguity preserves the pending context.

The API request tests cover submit 201 followed by a sync outage, later safe retry, completed progress with no duplicate POST, and a course-complete 201 whose response is dropped. Invalid return URLs (external, protocol-relative, wrong path, wrong/duplicate IDs, wrong Attempt) never leave the same-origin student course area.

## Final native proof

The final native run is [final-native-final.txt](final-native-final.txt): **1 passed / 0 failed / 0 skipped** using T031-owned Chromium 153, Node 24.20.0, pnpm 10.13.1, PostgreSQL 17.11, Redis 7.4.10, and MinIO. It runs the real seven-type Course Activity flow and the real catalog Level 1 Question Bank practice with 20 persisted Runner items. The original full T027 lifecycle test was replayed on the T031 source before fixes; the baseline and each later iteration log remain in this directory.

Final dynamic IDs:

- Assignment: `ca22b82b-7756-4e68-a615-5b9faefc8969`
- Submission: `4b949b52-1aa2-4ec5-bc78-960a1a47ed9f`
- Practice Activity: `b8b7877e-933b-4742-b30b-160216016be7`
- AssessmentSession / Attempt: `84642f46-2c00-4973-855f-9371c03bfba2`
- Active imported Level 1 practice definition: `92f440b6-537e-4e28-ba31-352c8b54a418`

The browser received one submit 201. Its first course-completion request was interrupted after submit, leaving PENDING context and visible retry. The safe retry sent no new submit. The server committed course-completion with 201 and the browser response was dropped; a fresh Session/Attempt/Progress read confirmed completion. Chromium recorded exactly one CourseDetail return URL with the same Assignment, Submission, Activity, and Attempt IDs; no `beforeunload` dialog appeared.

Post-return refresh sent no create-Attempt, submit, course-complete, or recording-init POST. SQL still shows one Attempt for the Submission/Activity, one matching `COURSE_PRACTICE` ActivityAttempt, and completed ActivityProgress revision 1. The 20-item Attempt remained `PROCESSING`; it had zero scored audio items and zero AssessmentReports. The test did not claim formal speech scoring.

Four Runner recordings are in `browser-proof.json`. Each has a unique Recording ID and idempotency key, status `COMPLETE`, one SpeechJob, and a MinIO HeadObject of 22,514 bytes with `audio/webm;codecs=opus`. All microphone evidence used Chromium's simulated device; a physical microphone was not tested.

Native negative statuses: unauthenticated Session `401`; Student B Session `403`; missing Session `404`; mismatched Practice Attempt completion `409`; wrong-school course read `403`; cross-student Submission `404`; stale note/progress revisions `409`. Browser page errors: **0**.

The retained Course Activity screenshots cover 390, 768, 1280, and 1440 pixels; the final Runner return screenshot is [runner-return-course-1280.png](screenshots/runner-return-course-1280.png). The same run checks keyboard completion, ARIA state, reduced motion, and no horizontal overflow.

## Question Bank and input integrity

The official importer first passed a dry run: 120 questions, 120/120 answer bindings, 126 media files, zero errors, zero warnings. It then wrote only to T031's own `yuzan_t031_native` database and `yz-t031-native` MinIO bucket: 120 QuestionBank items/versions, six 20-item practices and deliveries, and 126 media objects. The course test links to the dynamic active Level 1 practice returned by the real student catalog, not the four-item bootstrap fixture.

The T005 `习题课程资源/` input remained read-only. Its 178-file, 1,967,035,976-byte tree metadata and the SHA256 hashes of the three imported files match before and after; see [question-bank-source-before.json](question-bank-source-before.json), [question-bank-source-after.json](question-bank-source-after.json), and [question-bank-source-check.txt](question-bank-source-check.txt). No source asset was staged or changed.

## Verification matrix

| Check | Result |
|---|---:|
| `pnpm --filter @yuzan/frontend test` — includes T027 bilingual renderer, T012 Runner, and T031 ApiClient/Runner cases | **76 passed / 0 failed / 0 skipped** |
| API course-focused regression — student-courses, recordings, practice, curriculum publishing, assignments | **93 passed / 0 failed / 0 skipped** ([api-targeted.txt](api-targeted.txt)) |
| `pnpm --filter @yuzan/api test` — full API suite | **1082 passed / 64 skipped / 0 failed** |
| Contracts Redocly + generated-type tests | **6 passed / 0 failed / 0 skipped** |
| API and frontend typecheck | **PASS** |
| API build and frontend runtime build | **PASS** |
| Prisma schema validate | **PASS** (existing referential-action warning only) |
| JS/Python/shell syntax and `git diff --check` | **PASS** |
| Final native Chromium/API/PostgreSQL/MinIO lifecycle | **1 passed / 0 failed / 0 skipped** |
| Physical mic, calibrated/automatic scoring, school pilot, production | **NOT_RUN** |

Development iterations before final PASS are retained as `final-native.txt`, `final-native-v2.txt`, `final-native-v3.txt`, `final-native-v4.txt`, and `final-native-v5.txt`; they record the course DTO-shape correction, official 20-item import, and anonymous-request context correction. The final acceptance is the separately retained `final-native-final.txt`.

## Protected boundaries and runtime

- T005 chooser-to-T027 deep route remains blocked: the chooser still selects through its in-page `setCurrentActivity`; this test uses the authorized dynamic deep route directly. T031 does not claim the whole course funnel passed.
- `translationLocale` is still absent from the accepted upstream CourseVersion bilingual contract. `BLOCKED_UPSTREAM_T005_CONTRACT` remains; no Tibetan translation was invented and no T005 CourseDetail source was edited.
- T005 main stayed at `feat/question-bank-v1@9c77c8cd35ffd45d6a164cc7a4ec616c3345fd15` with its pre-existing dirty bilingual work and raw course resources. T027 stayed clean at the exact base SHA. T029 `b49271805899f267354d03e3f6cb8f7d416bbf53`, T030 `c085ac2f15df90ddfdf0ccde7600e53aa31e860f`, and T032 `306f57a9d3c450cf62a68e5f5e3da4b6595d6837` remained on their separate branches with clean status; T031 did not edit or stop their runtimes.
- T031 used its own database `yuzan_t031_native` / role `yz_t031`, bucket `yz-t031-native`, and ports PostgreSQL `55657`, Redis `6457`, MinIO `59006–59007`, API `4098`, Web `4298`. Runtime PIDs and exit are recorded in [runtime-status-before-stop.txt](runtime-status-before-stop.txt), [runtime-stop.txt](runtime-stop.txt), [runtime-status-after-stop.txt](runtime-status-after-stop.txt), and [runtime-ports-after-stop.json](runtime-ports-after-stop.json); all T031 listeners are free and PostgreSQL/MinIO data remain retained.
- No Docker/Compose/P1-SIM was used. L4 remains **OPEN** and was not accessed. No shared branch was merged. The feature branch is for Commander integration only.
