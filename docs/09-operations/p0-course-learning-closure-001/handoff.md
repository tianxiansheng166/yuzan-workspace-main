# P0 Course Learning Closure Handoff

## Delivered journey

`/student/courses` → routed course detail → create/resume `Submission` → dynamic activity player → course points/private notes → reusable Practice Attempt → course submission → completion and attainment.

The fixed `spring-2` content is no longer a runtime data source. The directory is retained only as the static host for the dynamic player bundle.

## Catalog and bootstrap

- Primary categories: 全部、发音基础、听说理解、朗读表达、阅读写作、古诗文。
- Auxiliary filters: 学段、难度、来源、状态。
- Sources: `TEACHER_ASSIGNED`, `RECOMMENDED`, `SELF_STUDY`.
- States: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `RESULT_PENDING`.
- Idempotent development/test bootstrap courses:
  1. 声母发音与口型基础
  2. 韵母、声调与普通话节奏
  3. 古诗文朗读：停顿与情感
  4. 现代文听说：信息提取与复述

Each course has a published `CourseVersion`, `Unit`, `Lesson`, real `LearningActivity` records, an `Assignment`/`AssignmentTarget`, metadata and a `CourseActivityPractice` reference. Bootstrap does not create progress, recordings, scores or reports.

## APIs and routes

- `GET /schools/:schoolId/student/courses`
- `GET /schools/:schoolId/student/courses/:assignmentId`
- `POST /schools/:schoolId/student/courses/:assignmentId/submissions`
- `PUT .../submissions/:submissionId/activities/:activityId/attempt`
- `POST .../activities/:activityId/recordings/:recordingId/link`
- `POST .../activities/:activityId/practice-attempts/:attemptId/complete`
- `POST .../submissions/:submissionId/submit`
- `GET|PUT /schools/:schoolId/learning/activities/:activityId/note`

Student routes:

- `/student/courses`
- `/student/courses/:assignmentId`
- `/student/courses/:assignmentId/submissions/:submissionId/activities/:activityId`

## Model and record boundaries

Reused models: `Course`, `CourseVersion`, `Unit`, `Lesson`, `LearningActivity`, `Assignment`, `AssignmentTarget`, `Submission`, `ActivityAttempt`, `ActivityProgress`, `Recording`, `AudioAsset`, `SpeechJob`, and `AssessmentSession`.

Added only:

- `StudentActivityNote`: enrollment-scoped private note with optimistic `revision`.
- `CourseActivityPractice`: explicit published Activity → PracticeDefinition reference.
- Course linkage fields on `AssessmentSession` and `Recording`.

No `CourseAttempt`, `LessonProgress`, or `CourseRecording` model was added.

## Completion semantics

- Learning completion counts required Activities and required Practice Attempts independently of asynchronous scoring.
- Practice completion requires the linked `AssessmentSession` to be `SUBMITTED`, `PROCESSING`, or `COMPLETED`.
- Speech upload creates/links `Recording`, `ActivityAttempt`, `SpeechJob`, and `ActivityProgress` using the real `submissionId`.
- A course may be 100% complete while attainment is `PENDING`.
- Attainment values: `PENDING`, `PASSED`, `NEEDS_PRACTICE`, `NEEDS_REVIEW`, `PROVIDER_UNAVAILABLE`.

## Verification evidence

- Catalog: 4 database courses; category filtering and routed detail refresh verified.
- Private note: autosave, backend-confirmed saved state and refresh recovery verified.
- Speech: real object upload and links verified; test record reached `Recording.PROCESSING` with a linked `SpeechJob.PROCESSING`.
- Practice: two oral and two written items submitted through existing Assessment/Recording APIs; linked Activity completed.
- Course: required Activities `4/4`, required Practices `1/1`, completion `100%`, attainment `PENDING`, Submission `SUBMITTED`.
- Security: cross-school `403`, cross-assignment Submission `404`, unit coverage for cross-student denial.
- Responsive screenshots: catalog, detail and player at 1440/1024/390.

## Migration and rollback

Apply with `pnpm --filter @yuzan/database migrate:deploy` after a database backup.

Rollback is intentionally manual because it removes student notes and course-practice links. Before rollback, export `StudentActivityNote` and `CourseActivityPractice`, then drop their foreign keys/indexes/tables; drop the new `AssessmentSession` and `Recording` foreign keys/columns; finally drop the CourseVersion metadata columns and `Assignment.source`. Mark the migration rolled back only after schema verification. Do not run a destructive rollback against production without an approved data-retention plan.

## Runtime states

Catalog and player provide loading, empty, error, offline and permission-denied states. Upload and note failures remain visibly unsynced; no API failure is presented as saved.
