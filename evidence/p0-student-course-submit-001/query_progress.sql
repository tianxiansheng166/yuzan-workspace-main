-- Check submission and progress for course 1 (声母发音与口型基础)
SELECT s.id, s.status, s.revision, s."submittedAt"
FROM "Submission" s
WHERE s."assignmentId" = '85000000-0000-4000-8000-000000000001'
  AND s."enrollmentId" = 'f1111111-1111-4111-8111-111111111111'
  AND s."deletedAt" IS NULL
ORDER BY s."createdAt" DESC
LIMIT 5;

-- Check activity progress
SELECT ap."activityId", ap.completed, ap.revision
FROM "ActivityProgress" ap
WHERE ap."enrollmentId" = 'f1111111-1111-4111-8111-111111111111'
ORDER BY ap."activityId";

-- Check activity types for course 1
SELECT la.id, la.type, la.title, la.required
FROM "LearningActivity" la
JOIN "Lesson" l ON la."lessonId" = l.id
JOIN "Unit" u ON l."unitId" = u.id
WHERE u."courseVersionId" IN (
  SELECT "courseVersionId" FROM "Assignment" WHERE id = '85000000-0000-4000-8000-000000000001'
)
AND la.type IN ('TEXT', 'AUDIO', 'SPEECH', 'CHOICE', 'FILL_BLANK')
ORDER BY la."sortOrder";
