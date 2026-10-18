# YZ-RD-T018 Results

## Status

**DONE / PASS** — Web-only teacher review queue and scoring experience, verified in an isolated native runtime.

- Baseline: `feat/yz-rd-t014-teacher-class-remediation@0596a9b8256c1d674b93eb2afd4de7306c768129`
- Output branch: `feat/yz-rd-t018-teacher-review-queue-ux`
- API changes: none. `API_REQUESTS: NONE`.
- Runtime: Node 24.20.0, pnpm 10.13.1, PostgreSQL 17.11, Redis 7.4.10, MinIO, NestJS API, Web, Chromium 153.
- Native E2E: **PASS 1 / FAIL 0 / SKIPPED 0**.

## Score safety and saved result

- Blank and whitespace-only input, nonnumeric input, negative values, values above the item’s returned `maxScore`, and precision above one decimal are rejected before a PUT. The score input receives focus and an explicit error.
- With a blank score, the browser sent **0 PUTs** and PostgreSQL retained **0 rows with a score** for the selected item.
- The teacher explicitly entered `0`. The server response confirmed the dynamic item ID, `REVIEWED` state, and saved score. PostgreSQL recorded `scoredScore=0`, reviewer, comment, revision `2`, and status `REVIEWED`.
- A transport failure preserved the score and comment; retry saved them. A double click issued one request for that retry. Repeating the same score returned `200` without incrementing revision; changing a saved score returned `409`.
- Other necessary items received positive scores through the UI. PostgreSQL contained no report through the penultimate review; the final review returned the server-generated report. The student read that report and the same overall score.

## Authorized queue, evidence, and result access

- The teacher queue came from `getAssessmentReviewQueue()` and contained real server-authorized item IDs. Student name, returned strategy, and returned domain filters matched the corresponding server fields. The UI distinguishes server queue total from client-filtered matches and from a genuinely empty authorized queue.
- “Continue next” fetched the authorized queue again. The next detail URL used a fresh ID from that response. All six reviewed item IDs were absent from the updated queue.
- A real published practice attempt created four uploaded recording objects in the T018 MinIO bucket. The session stayed `PROCESSING` and had no report before human review.
- An authorized image-address failure appeared in the page; retry obtained a fresh server-authorized URL and loaded the image (`naturalWidth > 0`). An audio-address failure appeared in the page; retry fetched a fresh URL and Chromium played the student recording past `0.2s`.
- The student could read their own report and teacher feedback. The report payload contained no `reviewerUserId`, `referenceAnswer`, `deductionRules`, or `scoringSpec`.
- API status proof: anonymous `401`; student queue/review `403`; missing item `404`; invalid and over-maximum scores `400`; cross-class and cross-school detail `403`; changed duplicate score `409`; another student’s report/history denied (`403`).

## Layout and accessibility

Chromium checked horizontal overflow, shell/sidebar/page bounds, player and score-button bounds, and player/button overlap at each requested viewport. The evidence column precedes the score form at mobile/tablet widths.

| Viewport | Result | Evidence |
| --- | --- | --- |
| 390px | PASS | [Queue](queue-390.png), [detail](review-confirmed-390.png) |
| 768px | PASS | [Queue](queue-768.png), [detail](review-confirmed-768.png) |
| 1280px | PASS | [Queue](queue-1280.png), [detail](review-confirmed-1280.png) |
| 1440px | PASS | [Queue](queue-1440.png), [detail](review-confirmed-1440.png) |

Keyboard Enter submitted the form path, and invalid submission focused the score input with `aria-invalid`. Reduced-motion emulation reduced the completion mark animation duration. State and media errors use live status/alert regions and visible retry actions. Queue status art and detail controls use authored SVG paths and CSS.

## Tests

- Frontend unit tests and runtime verifier: **PASS 32 / FAIL 0 / SKIPPED 0**.
- `AssessmentReviewService` focused tests: **PASS 2 / FAIL 0 / SKIPPED 0**.
- OpenAPI lint and contract generator tests: **PASS 6 / FAIL 0 / SKIPPED 0**.
- Native Chromium + real API + PostgreSQL + MinIO flow: **PASS 1 / FAIL 0 / SKIPPED 0**.
- JavaScript checks, Python `py_compile`, bucket-preparation Node check, and `git diff --check`: **PASS**.
- Full unrelated API suite: **NOT_RUN**.
- Physical microphone/device, live speech provider, school pilot, and production launch: **NOT_RUN**. The native attempt used the retained fixture’s `SIMULATED_MIC`; recording upload, persistence, authorized playback URL, and Chromium playback were real.

Full native browser/API/database output: [t018-native-playwright.log](t018-native-playwright.log).

## Runtime, ownership, and handoff

- T018 owns database `yuzan_t018_native` / user `yz_t018`, bucket `yz-t018-native`, and ports PostgreSQL `55641`, Redis `6441`, MinIO `59212–59213`, API `4109`, Web `4309`.
- Every T018 service stopped through the T018 process-identity checks; final status was stopped and all six ports were free. The T018 database, MinIO bucket, recordings, screenshots, and logs remain retained as evidence. No Worker, Docker, or Compose was used.
- Source changes are limited to the five authorized teacher review files, T018 unit/E2E/runtime test files, and this evidence directory. No backend API, Prisma, OpenAPI, generated client, API client, server, shared teacher shell, student, assessment, class, student, or assignment source was modified.
- T005’s dirty shared workspace and T015/T016/T017 worktrees and resources were not changed. The source T011 runtime remained stopped and unchanged; only its retained fixture data was copied into T018-owned storage. L4 remains OPEN.
- T018 is **not merged** to the shared development branch. Commit SHA and push receipt are in the task return.
- Next web gaps: none within this review queue task. Device validation and pilot work remain NOT_RUN.
