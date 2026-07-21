# P0 practice catalog scope correction

User-authorized change request for `P0-REUSABLE-PRACTICE-GOLDEN-CLOSURE-001 / PRACTICE-CATALOG-SCOPE-CORRECTION`.

## Shared-domain extension

- `PracticeDefinition` gains catalog metadata: grade band, ability categories, culture tags, catalog type, recording requirement, and immediate-feedback capability.
- `PracticeFavorite` stores a student's school-scoped favorites without duplicating a PracticeVersion or creating an Attempt.
- Existing published PracticeVersion and AssessmentItem snapshot behavior remain immutable.

## Student API extension

- `GET /schools/{schoolId}/practices` accepts query, abilityCategory, gradeBand, difficulty, duration, itemType, cultureTag, mode, completionStatus, sort, and cursor.
- It returns catalog items, real facets, nextCursor, total, per-student Attempt/favorite state, and deterministic recommendation reasons.
- Detail includes visible metadata, oral/written counts, recent result when one exists, and the same recommendation reason.
- Add school/student-scoped favorite create/delete endpoints. They never expose another student's state.

## Safety and compatibility

- Every practice, favorite, Attempt, and report query remains scoped to the active student enrollment and school.
- `/assessment` compatibility and existing practice Attempt APIs remain available.
- No catalog filter, count, card, score, history, or recommendation is hardcoded into frontend JavaScript.

## Development/test bootstrap

- Run `P0_BOOTSTRAP_ONLY=true` with `infra/database/prisma/seed.ts` in a development or test environment to provision the fictional school, teacher/student memberships, active enrollment, six published practices, sections, item references, and visible deliveries.
- The isolated path exits before unrelated course/demo setup and creates no completed recordings, scores, or assessment reports.
