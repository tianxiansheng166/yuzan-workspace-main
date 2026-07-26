# 前端控件静态盘点

- Source commit: `a62ee166363f1bcaff1be81d017d5d46d36f7583`
- Pages: 79
- Controls: 1882
- Unresolved controls: 962
- Handler references: 862
- Static navigation: 58

> 本报告只做源码侦察，不把 handler/API 引用声明为功能完成。

| Page | Controls | Unresolved | Handler refs | API refs | Risks |
| --- | ---: | ---: | ---: | ---: | --- |
| `frontend/admin-pages/yuzan-admin-users-roles-pixel-web/yuzan-admin-users-roles-standalone/index.html` | 103 | 79 | 24 | 1 | DIRECT_FETCH |
| `frontend/admin-pages/yuzan-admin-content-review/yuzan-admin-content-review/index.html` | 86 | 40 | 46 | 1 | DIRECT_FETCH |
| `frontend/admin-pages/yuzan-admin-curriculum-ui/yuzan-admin-curriculum-ui/index.html` | 69 | 33 | 36 | 0 | DIRECT_FETCH |
| `frontend/teacher/ai-tools/index.html` | 65 | 25 | 38 | 1 | DIRECT_FETCH, FIXED_SUBMISSION_ID |
| `frontend/teacher/classes/index.html` | 62 | 31 | 27 | 0 | FIXED_SUBMISSION_ID |
| `frontend/admin-pages/yuzan-admin-system-providers-pixel-web/yuzan-admin-system-providers-standalone/index.html` | 55 | 28 | 27 | 1 | DIRECT_FETCH |
| `frontend/volunteer-pages/yuzan-volunteer-assessment-pixel-web/yuzan-volunteer-assessment-standalone/index.html` | 53 | 5 | 48 | 0 | - |
| `frontend/student-pages/yuzan-student-community-ui/yuzan-student-community-ui/index.html` | 51 | 18 | 33 | 0 | - |
| `frontend/teacher/assessments/tasks/index.html` | 51 | 29 | 17 | 0 | FIXED_SUBMISSION_ID |
| `frontend/teacher/assessments/detail/index.html` | 48 | 25 | 23 | 0 | FIXED_SUBMISSION_ID |
| `frontend/teacher/students/demo/index.html` | 46 | 19 | 27 | 0 | FIXED_SUBMISSION_ID |
| `frontend/teacher/students/detail/index.html` | 46 | 19 | 27 | 0 | FIXED_SUBMISSION_ID |
| `frontend/admin-pages/yuzan-admin-privacy-ui/yuzan-admin-privacy-ui/index.html` | 44 | 33 | 11 | 1 | DIRECT_FETCH |
| `frontend/volunteer-pages/yuzan-volunteer-service-tasks-pixel-web-1-/yuzan-volunteer-service-tasks-standalone/index.html` | 43 | 11 | 32 | 0 | - |
| `frontend/admin-pages/yuzan-admin-product-plans-pixel/yuzan-admin-product-plans-pixel/index.html` | 42 | 35 | 7 | 1 | DIRECT_FETCH |
| `frontend/public-materials/impact/index.html` | 42 | 21 | 21 | 0 | - |
| `frontend/sections/project-impact/index.html` | 42 | 21 | 21 | 0 | - |
| `frontend/teacher/assessments/create/index.html` | 40 | 11 | 24 | 0 | FIXED_SUBMISSION_ID |
| `frontend/teacher/translation/index.html` | 38 | 31 | 6 | 1 | DIRECT_FETCH, FIXED_SUBMISSION_ID |
| `frontend/admin-pages/yuzan-school-operation-detail-standalone-v1/yuzan-school-operation-detail-standalone-v1/index.html` | 37 | 37 | 0 | 0 | - |
| `frontend/volunteer-pages/yuzan-volunteer-pairings-pixel-web-v2/yuzan-volunteer-pairings-standalone/index.html` | 37 | 4 | 33 | 0 | - |
| `frontend/student-pages/yuzan-student-offline-ui/yuzan-student-offline-ui/index.html` | 36 | 27 | 9 | 0 | - |
| `frontend/volunteer-pages/yuzan-one-to-one-support-standalone-v3/yuzan-one-to-one-support-standalone-v3/index.html` | 36 | 9 | 27 | 0 | - |
| `frontend/student-pages/yuzan-student-recommendations-pixel/yuzan-student-recommendations-pixel/index.html` | 33 | 17 | 16 | 0 | - |
| `frontend/student-pages/yuzan-student-exercise-ui/yuzan-student-exercise-ui/index.html` | 32 | 16 | 16 | 0 | - |
| `frontend/admin-pages/yuzan-admin-assessment-links-ui/yuzan-admin-assessment-links-ui/index.html` | 31 | 24 | 7 | 0 | - |
| `frontend/teacher/classes/detail/index.html` | 31 | 12 | 15 | 0 | FIXED_SUBMISSION_ID |
| `frontend/student-pages/yuzan-student-course-center/yuzan-student-course-center/index.html` | 30 | 5 | 25 | 0 | - |
| `frontend/volunteer-pages/yuzan-volunteer-emergency-report-standalone-v2/yuzan-volunteer-emergency-report-standalone-v2/index.html` | 29 | 27 | 2 | 0 | - |
| `frontend/admin-pages/yuzan-admin-assessment-content-ui/yuzan-admin-assessment-content-ui/index.html` | 28 | 18 | 10 | 0 | - |
| `frontend/volunteer-pages/yuzan-volunteer-recruitment-pixel-web/yuzan-volunteer-recruitment-standalone/index.html` | 28 | 17 | 11 | 0 | - |
| `frontend/volunteer-pages/yuzan-volunteer-training-ui/yuzan-volunteer-training-ui/index.html` | 28 | 24 | 4 | 0 | - |
| `frontend/student/courses/course-detail/index.html` | 27 | 8 | 18 | 1 | DIRECT_FETCH |
| `frontend/admin-pages/yuzan-admin-schools-pixel-web/yuzan-admin-schools-standalone/index.html` | 26 | 18 | 8 | 1 | DIRECT_FETCH |
| `frontend/teacher/assignments/index.html` | 25 | 18 | 7 | 1 | DEMO_FALLBACK, DIRECT_FETCH, FIXED_SUBMISSION_ID |
| `frontend/volunteer-links.html` | 25 | 0 | 8 | 0 | - |
| `frontend/student-pages/yuzan-student-assignments-ui-1-/yuzan-student-assignments-ui/index.html` | 24 | 14 | 10 | 0 | - |
| `frontend/teacher/courses/spring/studio/index.html` | 22 | 12 | 8 | 1 | DIRECT_FETCH, FIXED_SUBMISSION_ID |
| `frontend/public-materials/community/index.html` | 21 | 21 | 0 | 0 | - |
| `frontend/sections/language-community/index.html` | 21 | 21 | 0 | 0 | - |
| `frontend/student-pages/yuzan-student-assignments-ui/yuzan-student-assignments-ui/index.html` | 21 | 19 | 2 | 0 | - |
| `frontend/teacher-home/index.html` | 21 | 11 | 10 | 1 | DIRECT_FETCH, FIXED_SUBMISSION_ID |
| `frontend/public-materials/service-system/index.html` | 20 | 6 | 14 | 0 | - |
| `frontend/sections/service-system/index.html` | 20 | 6 | 14 | 0 | - |
| `frontend/teacher/submissions/detail/index.html` | 20 | 5 | 5 | 0 | FIXED_SUBMISSION_ID |
| `frontend/volunteer-pages/yuzan-volunteer-training-completion-standalone-v1/yuzan-volunteer-training-completion-standalone-v1/index.html` | 19 | 2 | 17 | 0 | - |
| `frontend/public-materials/support/index.html` | 18 | 9 | 9 | 0 | - |
| `frontend/sections/one-to-one/index.html` | 18 | 9 | 9 | 0 | - |
| `frontend/login/index.html` | 16 | 7 | 9 | 1 | DEMO_FALLBACK, DEMO_TOKEN, DIRECT_FETCH |
| `frontend/public-materials/cooperation/index.html` | 15 | 4 | 11 | 0 | - |
| `frontend/sections/school-cooperation/index.html` | 15 | 4 | 11 | 0 | - |
| `frontend/index.html` | 12 | 9 | 1 | 0 | - |
| `frontend/student/courses/index.html` | 9 | 1 | 7 | 1 | DIRECT_FETCH |
| `frontend/select-school/index.html` | 7 | 2 | 5 | 1 | DIRECT_FETCH |
| `frontend/teacher/reviews/submission-1/index.html` | 7 | 5 | 2 | 1 | DIRECT_FETCH, FIXED_SUBMISSION_ID |
| `frontend/student/profile/index.html` | 5 | 0 | 2 | 1 | DIRECT_FETCH |
| `frontend/student/today/index.html` | 5 | 0 | 5 | 1 | DIRECT_FETCH |
| `frontend/student/learn/spring-2/index.html` | 1 | 0 | 0 | 0 | - |
| `frontend/admin-integration.html` | 0 | 0 | 0 | 1 | DIRECT_FETCH |
| `frontend/admin.html` | 0 | 0 | 0 | 1 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/assessment/_shell.html` | 0 | 0 | 0 | 2 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/assessment/history/index.html` | 0 | 0 | 0 | 2 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/assessment/index.html` | 0 | 0 | 0 | 2 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/assessment/practice-shell.html` | 0 | 0 | 0 | 1 | DIRECT_FETCH |
| `frontend/assessment/recordings/index.html` | 0 | 0 | 0 | 2 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/assessment/sessions/SZ20250530-PT-0032/index.html` | 0 | 0 | 0 | 2 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/assessment/sessions/SZ20250530-PT-0032/processing/index.html` | 0 | 0 | 0 | 2 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/assessment/sessions/SZ20250530-PT-0032/reading/RD250530-010/index.html` | 0 | 0 | 0 | 2 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/assessment/sessions/SZ20250530-PT-0032/report/index.html` | 0 | 0 | 0 | 2 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/assessment/sessions/SZ20250530-PT-0032/submit/index.html` | 0 | 0 | 0 | 2 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/assessment/sessions/SZ20250530-PT-0032/written/WR250530-001/index.html` | 0 | 0 | 0 | 2 | DEMO_FALLBACK, DIRECT_FETCH |
| `frontend/plans.html` | 0 | 0 | 0 | 0 | DIRECT_FETCH |
| `frontend/public-page.html` | 0 | 0 | 0 | 0 | - |
| `frontend/research.html` | 0 | 0 | 0 | 0 | DIRECT_FETCH |
| `frontend/student-integration.html` | 0 | 0 | 0 | 1 | DIRECT_FETCH |
| `frontend/student/growth/index.html` | 0 | 0 | 0 | 1 | DIRECT_FETCH |
| `frontend/teacher.html` | 0 | 0 | 0 | 1 | DIRECT_FETCH, FIXED_SUBMISSION_ID |
| `frontend/tools.html` | 0 | 0 | 0 | 0 | DIRECT_FETCH, FIXED_SUBMISSION_ID |
| `frontend/volunteer.html` | 0 | 0 | 0 | 1 | DEMO_FALLBACK, DIRECT_FETCH |
