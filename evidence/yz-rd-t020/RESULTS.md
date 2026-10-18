# YZ-RD-T020 Results

## Status

**DONE / NATIVE WEB E2E PASS.** Work stayed on `feat/yz-rd-t020-teacher-home-action-center`, created from the accepted T018 baseline `feat/yz-rd-t018-teacher-review-queue-ux@73bb949b22f38b66f92edaa741aa042e504d2d7f`.

T018's checkout did not contain the AA-DEV-V2.2 marker. The supplied Task Card and local safety baseline were applied. No T018 review implementation was replaced, and no API, Prisma, OpenAPI, generated type, shared shell, assignment, class, student, assessment, or server source was changed.

## Teacher action center

The home now reads Dashboard, Classes, per-class Student Summaries, and the Assessment Review Queue independently. The action cards clearly separate:

- **教学任务提交待查看** — Dashboard `workflow.review.count` and `reviews[].submissionId`, linked to `/teacher/submissions/{submissionId}`.
- **题库人工评分待复核** — `getAssessmentReviewQueue().total` and `items[].itemId`, linked to `/teacher/reviews/{itemId}`.

The final teacher A fixture returned **1** teaching submission and **6** assessment review items. After saving one assessment review, the refreshed API and home showed **1** teaching submission and **5** assessment items. SQL confirmed the reviewed item as `REVIEWED`, score `2`, reviewer `d34e4a58-aaa3-4df8-a879-b4faff06d9b9`, comment saved, revision `2`. No formal report existed after this partial review.

Unknown statistics render as `—` or `暂无有效统计`; a confirmed zero remains `0`. The real student with `courseProgress=null` displayed `暂无有效统计`, not `0%`. The empty teacher's authorized student count was server-confirmed `0`.

## Dynamic navigation and authorization

The final real IDs are recorded in [proof.json](proof.json) and the actual navigation events in [click-log.json](click-log.json). Chromium clicked the home priority assignment card, the assignment row, the teaching submission, an authorized class, the enrollment detail, and an assessment review item.

- The hero priority action opened Assignment `045ec90e-9dca-4d85-bbf8-c6c65ed3b65d` using `/teacher/assignments/?assignmentId=...`; the page showed its real one-student target and submission count. The separate task row opened Assignment `36da8830-f758-42b2-9364-9d5cd960cc7e`, its actual target student, and `1 / 1` submitted.
- Submission `1d890eb2-fece-446d-8a79-238f7293f45d` opened its submission detail. Class `d1730e62-d278-4c38-8a59-ebfbc5289c27` opened with `schoolId=11111111-1111-4111-8111-111111111111`; student enrollment `c7bfad9e-bc99-464d-bfbb-95b9271fe635` opened with that school and class ID.
- Review item `bdd02da7-971e-4a5e-902c-c40ec3dc272f` opened the real evidence page, played a T020 MinIO recording, and saved a valid score and comment through the existing T018 review API.
- Teacher B could not read Teacher A's student (`403`). Teacher A could not read Teacher B's class (`404`, scoped not-found response) or another school's dashboard (`403`). The empty teacher saw no authorized classes or tasks. An invalid Assignment deep link showed an actionable error; direct API probes returned `401`, `403`, and `404` as expected.

## Isolation, errors, and accessibility

Each data area has its own status and retry. Browser fault injection aborted Assessment Review Queue, Classes, and Student Summary requests individually; each area recovered through its own retry while the other successful areas remained available. A controlled browser `503` response to the queue request produced an error state and recovered through queue retry. This `503` was a frontend fault-injection probe; the primary business flows used the live NestJS API.

The identity test logged Teacher C into a different school while Teacher A's real Dashboard response was delayed. The old response arrived after the switch and did not overwrite Teacher C's task, class, or student data. Fast repeated refresh also finished with the latest real response.

The dashboard state uses `aria-live="polite"`; the class selector has an accessible name; keyboard selection changed the active class; Tab focus remained on an interactive control. Reduced-motion styles and visible focus styles are present.

## Visual evidence

The highland hero background and warm paper styling remain. Responsive Chromium checks passed without horizontal overflow or sidebar overlap at all requested sizes:

| Viewport | Result | Screenshot |
| --- | --- | --- |
| 390px | PASS | [teacher-home-390.png](teacher-home-390.png) |
| 768px | PASS | [teacher-home-768.png](teacher-home-768.png) |
| 1280px | PASS | [teacher-home-1280.png](teacher-home-1280.png) |
| 1440px | PASS | [teacher-home-1440.png](teacher-home-1440.png) |

Interaction evidence: [home before scoring](teacher-home-review-before-1280.png), [review evidence before score](review-item-before-score-1280.png), [review saved](review-item-after-score-1280.png), and [home after server refresh](teacher-home-review-after-1280.png). Assignment, Submission, student, empty-teacher, and Teacher B screenshots are also retained in this directory.

## Verification

- Frontend dashboard model tests: **8 passed, 0 failed, 0 skipped**.
- Frontend runtime verifier: **PASS**.
- API directional tests: **12 passed, 0 failed** across Teacher Dashboard, class teacher scope, assessment review service, and review queue.
- Native Chromium + NestJS API + PostgreSQL 17 + MinIO: **1 passed, 0 failed, 0 skipped**. Full click/API/SQL evidence is in [t020-native-playwright.log](t020-native-playwright.log), [api-responses.json](api-responses.json), and [proof.json](proof.json).
- `py_compile`, JavaScript syntax checks, and `git diff --check`: **PASS**.
- Docker/Compose: **not used**. Worker, physical microphone, pilot, and production launch: **not run**.

## Runtime and noninterference

T020 used database `yuzan_t020_native` / user `yz_t020`, bucket `yz-t020-native`, and ports PostgreSQL `55660`, Redis `6460`, MinIO `59260–59261`, API `4120`, and Web `4320`. The isolated T020 processes stopped successfully; all T020 ports were free at final verification. The database, bucket, recordings, screenshots, and logs remain retained. The T011 fixture was copied read-only into T020 storage.

No API requests were sent to T019. T005's existing dirty bilingual worktree remained unchanged. T018 remained clean at its accepted baseline. T019 advanced independently during this run to `538babca9d35327d6fbbdd9216e2b37f8d5cdcff` and was clean at final inspection; T020 did not edit its worktree or stop its processes. L4 remains **OPEN**.

## Merge state

**Ready to merge; not merged.** The output branch is not merged into `feat/question-bank-v1`. No remaining web gap was found within the T020 scope.
