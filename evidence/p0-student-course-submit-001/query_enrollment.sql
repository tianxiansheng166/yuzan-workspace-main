SELECT e.id, e."userId", e."schoolId", e.role, e.status
FROM "Enrollment" e
WHERE e."userId" = '22222222-2222-4222-8222-222222222222'
  AND e.role = 'STUDENT'
  AND e.status = 'ACTIVE'
LIMIT 5;
