SELECT e.id AS enrollment_id, e."schoolId", a.id AS assignment_id, cv.title
FROM "Enrollment" e
JOIN "Assignment" a ON a."schoolId" = e."schoolId" AND a.source = 'TEACHER_ASSIGNED'
JOIN "CourseVersion" cv ON cv.id = a."courseVersionId"
WHERE e."userId" = '22222222-2222-4222-8222-222222222222'
  AND e.role = 'STUDENT'
  AND e.status = 'ACTIVE'
ORDER BY a.id;
