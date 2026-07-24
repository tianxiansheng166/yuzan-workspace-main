-- Reset student course progress for course 1 (声母发音与口型基础)
-- This allows re-running E2E from scratch

-- Delete recordings for this enrollment
DELETE FROM "Recording"
WHERE "enrollmentId" = 'f1111111-1111-4111-8111-111111111111';

-- Delete activity attempts for this submission
DELETE FROM "ActivityAttempt"
WHERE "submissionId" = '4cde288e-c451-415b-b369-c4a4b96ed1ac';

-- Delete activity progress for this enrollment and these activities
DELETE FROM "ActivityProgress"
WHERE "enrollmentId" = 'f1111111-1111-4111-8111-111111111111'
  AND "activityId" IN (
    '84000000-0000-4000-8000-000000000101',
    '84000000-0000-4000-8000-000000000102',
    '84000000-0000-4000-8000-000000000103',
    '84000000-0000-4000-8000-000000000104',
    '84000000-0000-4000-8000-000000000105'
  );

-- Delete course completion
DELETE FROM "CourseCompletion"
WHERE "assignmentId" = '85000000-0000-4000-8000-000000000001'
  AND "enrollmentId" = 'f1111111-1111-4111-8111-111111111111';

-- Delete the submission
DELETE FROM "Submission"
WHERE id = '4cde288e-c451-415b-b369-c4a4b96ed1ac';
