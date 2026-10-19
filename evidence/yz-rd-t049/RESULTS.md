# YZ-RD-T049 — Teacher course practice authoring contract

| Field                  | Result                                                       |
| ---------------------- | ------------------------------------------------------------ |
| `TASK_ID`              | `YZ-RD-T049`                                                 |
| `STATUS`               | `ACCEPTANCE VERIFIED`                                        |
| `REPO`                 | `/home/tian/code/yuzan-workspace-main`                       |
| `EXACT_LOCAL_WORKTREE` | `/home/tian/code/work/yuzan-workspace-t049`                  |
| `BRANCH`               | `feat/yz-rd-t049-teacher-course-practice-authoring-contract` |
| `BASE`                 | `cd17360e67356dcdd04062b69b94e253ef5a7468`                   |
| `FINAL_SHA`            | Returned in the task response; Git HEAD is authoritative.    |
| `READY_TO_MERGE`       | `NO` — inherited API lint debt remains unwaived.             |
| `L4_OPEN`              | `OPEN / untouched`                                           |

## Contract and model

The existing course-version API was reused for draft creation, full-tree edits, metadata edits and publication:

- `POST /schools/{schoolId}/course-versions`
- `PATCH /schools/{schoolId}/course-versions/{courseVersionId}` with `expectedUpdatedAt`
- `POST /schools/{schoolId}/course-versions/{courseVersionId}/publish`

`CourseActivityPractice` already exists in Prisma; no schema or migration change was needed. It stores `id`, `schoolId`, unique `activityId`, `practiceDefinitionId`, `required` and `createdAt`, with school/activity cascade relations and a restrictive practice-definition relation.

The new teacher contract adds:

- `GET /schools/{schoolId}/course-versions/{courseVersionId}/practice-options` for school-visible published practices that have a published version.
- `PUT /schools/{schoolId}/course-versions/{courseVersionId}/activities/{activityId}/practice` with `practiceDefinitionId`, `required` and `expectedUpdatedAt`.

The write is school-scoped, author/admin-authorized and limited to `DRAFT` or `CHANGES_REQUESTED` course versions. It checks the activity belongs to the version, rejects unavailable practice definitions, protects activities with student state, and uses the course version timestamp for optimistic concurrency. Repeating the same association returns the same relation. `GET` course-version detail returns `practiceReference`; student course detail returns the same reference under the authorized activity in `units`.

The teacher studio now selects from API-returned published practices and saves the relation through the writer API. Ordinary course edits use the existing course-version PATCH. Metadata-only saves preserve the activity tree; full-tree saves retain the association and reject replacing a tree with existing student state.

## Teacher → API → database → student

Native Chromium exercised teacher login, course draft creation and activity authoring through APIs, the real teacher studio association control, course save, reload and association read-back, publication, and class assignment `DRAFT → SCHEDULED → OPEN`. The published course remained version `1`.

The authorized student opened the published course, saw the linked `停顿与节奏专项训练`, started it in the unified practice runner, submitted it, synchronized course progress and returned to the same course Submission. The course’s existing AUDIO and SPEECH activities also remained functional: audio playback completed; a Chromium `SIMULATED_MIC` recording was previewed, uploaded to MinIO, and retried with the same Recording ID after an injected PUT failure.

The task bootstrap seed supplied the published practice definition and its active class delivery. The isolated E2E wrote no `CourseActivityPractice` row through SQL. The test-only second student identity/enrollment was created as a fictional fixture; course creation, activity edits, relation write, publication, Assignment/Attempt/Recording writes, submission and completion used their normal APIs.

## Authorization, concurrency and parity

The real API/browser checks returned:

| Case                                  |                           Result |
| ------------------------------------- | -------------------------------: |
| Unauthenticated relation write        |                            `401` |
| Student relation write / options read |                            `403` |
| Cross-school relation write           |                            `403` |
| Unknown activity                      |                            `404` |
| Stale timestamp / edit after publish  |                            `409` |
| Same relation repeated                | `200`, same relation, one DB row |
| Same practice Attempt submitted again |  `201`, same Attempt, one DB row |

PostgreSQL confirmed one `CourseActivityPractice` row with the expected `schoolId`, `activityId`, definition and `required=true`. The API read-back matched the database. The course remained the same `CourseVersion` ID at version `1`, published; after the student flow it stayed linked to the same activity. A pre-existing standalone Attempt for the same practice definition remained byte-for-byte equivalent in its checked fields (`id`, status, definition and null course context). The course Attempt is separately linked to the correct Submission and activity, remains `PROCESSING`, and completes the course activity.

## Native runtime and speech safety

**PASS: 1/1 Chromium E2E, 0 failed, 0 skipped.** Chrome 153 used the task-owned NestJS API, PostgreSQL 17.11, Redis and MinIO. The final run’s owned-service shutdown passed; all six task ports are free. Docker/Compose and Worker were not used.

The course Recording was read back from MinIO as a 32,931-byte `audio/webm;codecs=opus` object. Its `SpeechJob` remained `CREATED` with `result=null`; the practice Attempt remained `PROCESSING`. No automatic speech score, transcription or report was produced. Browser audio capture used `SIMULATED_MIC`, not a physical microphone. No Tibetan subtitle or unreviewed translation was added.

## Tests and quality gates

- `pnpm --filter @yuzan/api typecheck` — PASS.
- API build in the native runtime — PASS.
- Curriculum API tests — 55 passed.
- API contract tests — 38 passed.
- `pnpm --filter @yuzan/contracts test` — 6 passed; OpenAPI lint, deterministic generation and formatting passed.
- `pnpm --filter @yuzan/frontend test` — 133 passed; runtime verification passed.
- Python E2E syntax, JavaScript syntax and `git diff --check` — PASS.
- Full `pnpm --filter @yuzan/api lint` — 1201 errors / 1 warning, matching the inherited T033 baseline; not waived. `READY_TO_MERGE=NO` until the API owner resolves or waives it.

## Evidence files

- [Native browser/API/database proof](native-flow-proof.json)
- [Native E2E log](native-e2e.log)
- [Native runtime and shutdown evidence](native-runtime-evidence.json)
- [Teacher editor after reload](screenshots/teacher-course-practice-reopened-1440.png)
- [Student authorized course](screenshots/today-authorized-course-1440.png)
- [Course listening activity](screenshots/course-listening-1440.png)
- [Course speech activity at desktop](screenshots/course-speech-1440.png) and [390px](screenshots/course-speech-390.png)

## Policy and scope

The target checkout lacks the `AA-DEV-V2.2-20261017` marker, and the Task Card supplied no Lane policy reference. The supplied `/home/tian/code/AGENTS.md` safety baseline and accepted T040 audio/scoring constraints governed this work. T005 protected source, unreviewed Tibetan subtitles, automatic scoring, Docker/Compose, Worker, shared-branch merge and L4 were not used or modified. `L4_OPEN=OPEN`.
