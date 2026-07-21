# P0 course learning closure contract change request

User-authorized shared-fact change for `P0-COURSE-LEARNING-CLOSURE-001`.

## Existing-model decision

The implementation continues to use `Course`, `CourseVersion`, `Unit`, `Lesson`, `LearningActivity`, `Assignment`, `AssignmentTarget`, `Submission`, `ActivityAttempt`, `ActivityProgress`, `Recording`, `AudioAsset`, `SpeechJob`, and `AssessmentSession`. It will not create `CourseAttempt`, `LessonProgress`, or `CourseRecording`.

## Schema changes

- Add published catalog metadata to `CourseVersion` and assignment source metadata to `Assignment`.
- Add `StudentActivityNote`, scoped by school, enrollment, and activity, with optimistic `revision` updates.
- Add an explicit course-activity-to-practice reference without copying practice questions into course content.
- Link a reusable `AssessmentSession` practice attempt back to the owning course activity and course `Submission`.
- Link course `ActivityAttempt` evidence to a `Recording` where appropriate while retaining the existing Submission relation.

All new relations are tenant-checked in the student course service. Published student payloads exclude draft versions, `teacherNotes`, answer keys, and private authoring data.

## API changes

Add student-only endpoints under `/schools/{schoolId}/student/courses` for catalog, aggregate detail, create/resume submission, activity progress/attempts, completion, and submission. Add private note GET/PUT endpoints at `/schools/{schoolId}/learning/activities/{activityId}/note` with revision conflicts. Extend the reusable practice create/resume endpoint to accept optional course context and validate the course activity, submission, student enrollment, and referenced published practice.

## Completion semantics

Learning completion is based on required activities and required course practices. Attainment is independently derived as `PENDING`, `PASSED`, `NEEDS_PRACTICE`, `NEEDS_REVIEW`, or `PROVIDER_UNAVAILABLE`. Pending speech processing does not reduce learning completion from 100%.

## Bootstrap and rollback

The four initial courses are inserted only by the development/test seed and are idempotent by stable UUIDs and course stable keys. Bootstrap creates no completed progress, recordings, scores, reports, or speech results. Rollback removes the added columns/tables/foreign keys; seeded rows can be deleted by their `p0-course-*` stable keys in development/test only.
