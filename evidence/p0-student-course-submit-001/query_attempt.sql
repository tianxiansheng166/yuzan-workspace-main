SELECT id, "submissionId", "activityId", kind, value, "createdAt"
FROM "ActivityAttempt"
WHERE "activityId" = '84000000-0000-4000-8000-000000000404'
ORDER BY "createdAt" DESC LIMIT 3;

SELECT "activityId", "enrollmentId", completed, position, revision
FROM "ActivityProgress"
WHERE "activityId" = '84000000-0000-4000-8000-000000000404';
