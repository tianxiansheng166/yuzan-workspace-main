# YZ-RD-T048 — teacher speech review and feedback UX

| Field | Result |
|---|---|
| `TASK_ID` | `YZ-RD-T048` |
| `STATUS` | `VERIFIED` |
| `BASE` | `0f6ea3710797612aa08f37944a9ab9d92f033da1` (accepted T046 checkpoint) |
| `BRANCH` | `feat/yz-rd-t048-teacher-speech-review-feedback-ux` |
| `FINAL_SHA` | Returned in the task response; this evidence commit cannot contain its own SHA. |
| `REAL_AUDIO_REVIEW` | `PASS` — original Attempt recording retrieved through its authorized URL and played, paused, and replayed from T048 MinIO; capture source was `SIMULATED_MIC`. |
| `MANUAL_FEEDBACK` | `PASS` — teacher-entered multiline feedback persisted in the existing `comment` field and was visible with line breaks in the formal student report. |
| `REPORT_SOURCE` | `PASS` — server-generated `AssessmentReport` after all required manual reviews; the same student opened the report for the same Attempt from History. |
| `PERMISSION_ISOLATION` | `PASS` — student review, cross-class, cross-school, and other-student report/history access were denied. |
| `NATIVE_E2E` | `PASS 1 / FAIL 0 / SKIPPED 0` — Google Chrome + NestJS API + PostgreSQL 17.11 + MinIO (Redis enabled). |
| `READY_TO_MERGE` | `NO` — inherited full API lint baseline remains unresolved (1201 errors / 1 warning, per T046); no waiver. |
| `L4_OPEN` | `OPEN / untouched` |

## Delivered

- Reused the existing authorized teacher review queue, item detail, manual score/comment API, and server-generated assessment report. No API, database, OpenAPI, generated contract, or score policy changes were made.
- Promoted the real question and original student recording in the review evidence hierarchy. Removed the duplicate reading-text and empty-written-answer placeholders, kept optional diagnostic evidence collapsed, and added an explicit “从头重听” action beside the browser player.
- Kept the existing single `comment` field. Added teaching-focused prompts, a live character count, and a whitespace-preserving preview of the comment as it will appear in the student's report.
- Kept explicit score entry and validation. Blank input sends no review request; entering `0` is a valid formal score. A failed save preserves the teacher's score and feedback for retry.

## Acceptance evidence

**Native E2E: PASS 1 / FAIL 0 / SKIPPED 0.** Real Google Chrome 153.0.8010.52 exercised the student practice flow, NestJS API, PostgreSQL 17.11, Redis, and a T048-owned MinIO bucket. The complete run output is in [`t048-native-playwright.log`](t048-native-playwright.log), with structured proof in [`proof.json`](proof.json).

- The browser opened the server-authorized pending review item, rendered its returned reading text and rubric, and retrieved the original recording's authorized MinIO URL. Chromium played the recording past 0.2 seconds, paused it, and replayed from the start. One injected playback failure recovered through a fresh authorized URL; one image URL failure also recovered and rendered a nonzero natural width.
- Four real WebM/Opus recording objects were uploaded by the browser and verified with MinIO `HeadObject` (22,514 bytes each). Capture used `SIMULATED_MIC`; no physical microphone or calibrated speech scoring is claimed.
- Before teacher review, PostgreSQL showed `PROCESSING`, no formal report, and zero scored recording items. Blank score input caused zero PUT requests and left the score `NULL`. Explicitly entering `0` saved `scoredScore=0`, reviewer, multiline teaching feedback, revision `2`, and `REVIEWED`. A transport failure retained both inputs; retry saved them. Same-score retry returned `200`; a changed duplicate returned `409`.
- Five remaining manual items were reviewed through the UI. The server generated one `COMPLETED` formal report only after the final required item. The student opened that exact Attempt's “查看正式报告” route and saw the teacher feedback with line breaks preserved. The report API returned the matching overall score (`57`) and comments, without private rubric or reviewer fields.
- Permissions passed: anonymous queue `401`; student queue/review `403`; missing review `404`; invalid and over-maximum scores `400`; cross-class teacher and cross-school teacher `403`; another student's report/history `403`.
- Queue and detail layouts passed 390, 768, 1280, and 1440 pixel widths with no horizontal overflow or audio/submit overlap. See [`queue-390.png`](queue-390.png), [`queue-1440.png`](queue-1440.png), [`review-confirmed-390.png`](review-confirmed-390.png), and [`review-confirmed-1440.png`](review-confirmed-1440.png).

## Checks and runtime

- Frontend test suite and runtime verifier: **133 passed / 0 failed / 0 skipped**.
- `@yuzan/database` client generation/build, PostgreSQL migrations, and API Nest build: **PASS** during the native runner.
- Full API Vitest and full API lint were not rerun; no backend code changed. The inherited T033/T046 API lint count is 1201 errors / 1 warning and remains unwaived, so `READY_TO_MERGE=NO`.
- All browser users, classes, attempts, and recordings were dynamic `TEST_FIXTURE_ONLY` data in `yuzan_t048_native` / `yz_t048`, with bucket `yz-t048-native`. Worker stayed stopped and `SPEECH_PROVIDER=disabled`; no automatic score was generated.
- T048 API/Web/PostgreSQL/Redis/MinIO services stopped after E2E. Ports 4148, 4348, 55648, 6448, 59248, and 59249 are free. T048 database, MinIO objects, proof, and screenshots remain for audit. No Docker/Compose, shared-branch merge, T005 edit, or L4 access occurred.
- The target checkout `AGENTS.md` has no AA-DEV-V2.2 marker, and this Task Card supplied no separate Lane policy reference. The user-provided `/home/tian/code/AGENTS.md` safety baseline governed. The card omitted `REPO` and `WORKSPACE`; the exact base commit identified `yuzan-workspace-main`, and work was isolated in this T048 worktree.
