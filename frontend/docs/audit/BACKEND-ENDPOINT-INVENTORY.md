# 后端接口全量清单

> 审计时间：2026-07-18
> 审计范围：backend/api/src/modules 下所有 Controller
> 端点总数：约 165 个

## 一、接口总览

| 指标 | 数值 |
|------|------|
| Controller 文件数 | 35 |
| @Controller 装饰器总数 | 42 |
| 有Prisma持久化 | 16 |
| 无Prisma(纯stub/Repository) | 11 |
| 重复路由 | 1 (teacher-tools 重复注册) |
| PERSISTENCE_PENDING端点 | 4 (research-stub) |

---

## 二、按模块分组

### Auth & Identity

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /auth/login | identity.controller.ts | login | 是 | @Public |
| POST | /auth/register | identity.controller.ts | register | 是 | @Public |
| POST | /auth/refresh | identity.controller.ts | refresh | 是 | @Public |
| POST | /auth/logout | identity.controller.ts | logout | 是 | 需认证 |
| GET | /me | identity.controller.ts | me | 是 | 需认证 |
| POST | /auth/select-school | identity.controller.ts | selectSchool | 是 | @Public |
| POST | /auth/invitations/redeem | invite-redeem.controller.ts | redeem | 是 | @Public, MVP Gap |

---

### Health & Operations

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /health/live | health.controller.ts | live | 否 | 存活探针 |
| GET | /health/ready | health.controller.ts | ready | 否 | 就绪探针, DB检查待实现 |
| GET | /operations/status | operations.controller.ts | getStatus | 是 | @Public |

---

### Internal (Worker回调)

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /internal/storage/download-url | internal.controller.ts | getDownloadUrl | 是 | @Public, X-Internal-Key |
| PUT | /internal/speech-jobs/:jobId/result | internal.controller.ts | updateSpeechJobResult | 是 | @Public, X-Internal-Key |
| PUT | /internal/assessment-items/:itemId/auto-result | internal.controller.ts | updateAssessmentItemAutoResult | 是 | @Public, X-Internal-Key |
| PUT | /internal/recordings/:recordingId/status | internal.controller.ts | updateRecordingStatus | 是 | @Public, X-Internal-Key |

---

### Organizations (School)

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools | organizations.controller.ts | listSchools | 是 | PLATFORM_ADMIN |
| GET | /schools/:schoolId | organizations.controller.ts | getSchool | 是 | |
| GET | /schools/:schoolId/members | organizations.controller.ts | listMembers | 是 | |
| GET | /schools/:schoolId/members/me | organizations.controller.ts | getMyMembership | 是 | |

---

### Classes

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/classes | classes.controller.ts | listClasses | 是 | |
| POST | /schools/:schoolId/classes | classes.controller.ts | createClass | 是 | |
| GET | /schools/:schoolId/classes/:classId | classes.controller.ts | getClass | 是 | |
| POST | /schools/:schoolId/classes/:classId | classes.controller.ts | updateClass | 是 | |
| DELETE | /schools/:schoolId/classes/:classId | classes.controller.ts | deleteClass | 是 | |
| GET | /schools/:schoolId/classes/:classId/detail | classes.controller.ts | getClassDetail | 是 | |
| GET | /schools/:schoolId/classes/:classId/pending-stats | classes.controller.ts | getClassPendingStats | 是 | |
| GET | /schools/:schoolId/classes/:classId/export | classes.controller.ts | exportClassData | 是 | |
| GET | /schools/:schoolId/classes/:classId/members | classes.controller.ts | listClassMembers | 是 | |
| GET | /schools/:schoolId/classes/teachers/me | classes.controller.ts | listMyTeacherClasses | 是 | |
| GET | /schools/:schoolId/classes/students/me | classes.controller.ts | listMyStudentClasses | 是 | |
| GET | /schools/:schoolId/classes/:classId/enrollments | classes.controller.ts | listEnrollments | 是 | |
| POST | /schools/:schoolId/classes/:classId/supplementary-practice | classes.controller.ts | createSupplementaryPractice | 是 | |
| POST | /schools/:schoolId/classes/:classId/assessments | classes.controller.ts | createClassAssessment | 是 | |
| POST | /schools/:schoolId/classes/:classId/enrollments | classes.controller.ts | addEnrollment | 是 | |
| POST | /schools/:schoolId/classes/:classId/students/import | classes.controller.ts | importStudents | 是 | |
| DELETE | /schools/:schoolId/classes/:classId/enrollments/:enrollmentId | classes.controller.ts | removeEnrollment | 是 | |

---

### Assignments

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/assignments | assignments.controller.ts | listAssignments | 是 | |
| POST | /schools/:schoolId/assignments | assignments.controller.ts | createAssignment | 是 | |
| GET | /schools/:schoolId/assignments/:assignmentId | assignments.controller.ts | getAssignment | 是 | |
| GET | /schools/:schoolId/assignments/:assignmentId/stats | assignments.controller.ts | getAssignmentStats | 是 | |
| POST | /schools/:schoolId/assignments/:assignmentId | assignments.controller.ts | updateAssignment | 是 | |
| POST | /schools/:schoolId/assignments/:assignmentId/open | assignments.controller.ts | openAssignment | 是 | |
| POST | /schools/:schoolId/assignments/:assignmentId/close | assignments.controller.ts | closeAssignment | 是 | |
| POST | /schools/:schoolId/assignments/:assignmentId/cancel | assignments.controller.ts | cancelAssignment | 是 | |
| DELETE | /schools/:schoolId/assignments/:assignmentId | assignments.controller.ts | deleteAssignment | 是 | |

---

### Submissions

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/submissions | submissions.controller.ts | createSubmission | 是 | |
| GET | /schools/:schoolId/submissions/me | submissions.controller.ts | listMySubmissions | 是 | |
| GET | /schools/:schoolId/submissions/:submissionId | submissions.controller.ts | getSubmission | 是 | |
| POST | /schools/:schoolId/submissions/:submissionId/submit | submissions.controller.ts | submitSubmission | 是 | |
| POST | /schools/:schoolId/submissions/:submissionId/upload-urls | submissions.controller.ts | getUploadUrls | 是 | |
| GET | /schools/:schoolId/assignments/:assignmentId/submissions | submissions.controller.ts | listAssignmentSubmissions | 是 | |

---

### Feedback

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/submissions/:submissionId/feedback | feedback.controller.ts | createFeedback | 是 | |
| GET | /schools/:schoolId/submissions/:submissionId/feedback | feedback.controller.ts | listFeedback | 是 | |
| GET | /schools/:schoolId/feedback/pending | feedback.controller.ts | listPendingFeedback | 是 | |

---

### Assessment (Sessions)

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/assessments/sessions | assessment.controller.ts | createSession | 是 | |
| GET | /schools/:schoolId/assessments/sessions | assessment.controller.ts | listSessions | 是 | |
| GET | /schools/:schoolId/assessments/sessions/:sessionId | assessment.controller.ts | getSession | 是 | |
| POST | /schools/:schoolId/assessments/sessions/:sessionId/start | assessment.controller.ts | startSession | 是 | |
| POST | /schools/:schoolId/assessments/sessions/:sessionId/submit | assessment.controller.ts | submitSession | 是 | |
| GET | /schools/:schoolId/assessments/sessions/:sessionId/reading/:itemId | assessment.controller.ts | getReadingItem | 是 | |
| POST | /schools/:schoolId/assessments/sessions/:sessionId/reading/:itemId/recording | assessment.controller.ts | attachRecording | 是 | |
| GET | /schools/:schoolId/assessments/sessions/:sessionId/written | assessment.controller.ts | getWrittenItems | 是 | |
| PUT | /schools/:schoolId/assessments/sessions/:sessionId/items/:itemId/answer | assessment.controller.ts | saveWrittenAnswer | 是 | |
| POST | /schools/:schoolId/assessments/sessions/:sessionId/items/:itemId/answer/finalize | assessment.controller.ts | finalizeAnswer | 是 | |
| GET | /schools/:schoolId/assessments/sessions/:sessionId/report | assessment.controller.ts | getReport | 是 | |
| POST | /schools/:schoolId/assessments/sessions/:sessionId/report/generate | assessment.controller.ts | generateReport | 是 | |
| PUT | /schools/:schoolId/assessments/sessions/:sessionId/items/:itemId/review | assessment.controller.ts | reviewItem | 是 | |
| GET | /schools/:schoolId/assessments/sessions/:sessionId/items/:itemId/recording | assessment.controller.ts | getItemRecordingEvidence | 是 | |
| POST | /schools/:schoolId/assessments/sessions/:sessionId/retest | assessment.controller.ts | scheduleRetest | 是 | |
| POST | /schools/:schoolId/assessments/device-check | assessment.controller.ts | deviceCheck | 是 | |
| GET | /schools/:schoolId/assessments/history | assessment.controller.ts | getAssessmentHistory | 是 | |
| GET | /schools/:schoolId/assessments/history/events | assessment.controller.ts | getAssessmentHistoryEvents | 是 | |
| POST | /schools/:schoolId/assessments/sessions/:sessionId/export | assessment.controller.ts | exportReport | 是 | |

---

### Curriculum (Course Versions)

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/course-versions | curriculum.controller.ts | listCourseVersions | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/course-versions | curriculum.controller.ts | createCourseDraft | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/course-versions/:courseVersionId | curriculum.controller.ts | getCourseDraft | 否 | 无Prisma, Repository接口 |
| PATCH | /schools/:schoolId/course-versions/:courseVersionId | curriculum.controller.ts | updateCourseDraft | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/course-versions/:courseVersionId/publish | curriculum.controller.ts | publishCourseVersion | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/course-versions/:courseVersionId/submit-review | curriculum.controller.ts | submitForReview | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/course-versions/:courseVersionId/resources | curriculum.controller.ts | attachResource | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/course-versions/:courseVersionId/resources | curriculum.controller.ts | listResources | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/course-versions/:courseVersionId/offline-packages | curriculum.controller.ts | attachOfflinePackage | 否 | 无Prisma, Repository接口 |

---

### Learning

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/learning/tasks | learning.controller.ts | listTasks | 是 | |
| GET | /schools/:schoolId/learning/tasks/:assignmentId | learning.controller.ts | getTaskDetail | 是 | |
| GET | /schools/:schoolId/learning/activities/:activityId/progress | learning.controller.ts | getProgress | 是 | |
| PUT | /schools/:schoolId/learning/activities/:activityId/progress | learning.controller.ts | updateProgress | 是 | |

---

### Student Dashboard

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/student/courses-dashboard | student-dashboard.controller.ts | getCoursesDashboard | 是 | |
| GET | /schools/:schoolId/student/recommendations | student-dashboard.controller.ts | getRecommendations | 是 | |
| GET | /schools/:schoolId/student/teacher-advice | student-dashboard.controller.ts | getTeacherAdvice | 是 | |
| GET | /schools/:schoolId/student/today | student-dashboard.controller.ts | getTodayTasks | 是 | |
| GET | /schools/:schoolId/student/profile | student-dashboard.controller.ts | getProfile | 是 | |

---

### Teacher端

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/teacher/dashboard | teacher.controller.ts | getDashboard | 是 | |
| GET | /schools/:schoolId/teacher/students/at-risk | teacher.controller.ts | getAtRiskStudents | 是 | |
| GET | /schools/:schoolId/teacher/class/pronunciation-clusters | teacher.controller.ts | getPronunciationClusters | 是 | |
| GET | /schools/:schoolId/notifications | teacher.controller.ts | listNotifications | 是 | |
| PATCH | /schools/:schoolId/notifications/:notificationId/read | teacher.controller.ts | markNotificationRead | 是 | |

---

### Teacher Tools (teacher-tools/ 模块)

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/teacher-tools/state | teacher-tools/teacher-tools.controller.ts | getToolsState | 是 | |
| GET | /schools/:schoolId/teacher-tools/drafts | teacher-tools/teacher-tools.controller.ts | listDrafts | 是 | |
| POST | /schools/:schoolId/teacher-tools/drafts | teacher-tools/teacher-tools.controller.ts | createDraft | 是 | |
| GET | /schools/:schoolId/teacher-tools/invite-code | teacher-tools/teacher-tools.controller.ts | getInviteCode | 是 | |
| POST | /schools/:schoolId/teacher-tools/generate-plan | teacher-tools/teacher-tools.controller.ts | generatePlan | 是 | PROVIDER_NOT_CONFIGURED |

---

### Tools (tools/ 模块) -- 含重复 teacher-tools 路由

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/tools/integrations | tools.controller.ts | listIntegrations | 是 | |
| GET | /schools/:schoolId/tools/integrations/:key | tools.controller.ts | getIntegration | 是 | |
| PATCH | /schools/:schoolId/tools/integrations/:key | tools.controller.ts | updateIntegration | 是 | |
| POST | /schools/:schoolId/tools/mindgraph/jobs | tools.controller.ts | createMindGraphJob | 是 | |
| GET | /schools/:schoolId/tools/mindgraph/jobs | tools.controller.ts | listMyJobs | 是 | |
| GET | /schools/:schoolId/tools/mindgraph/jobs/:jobId | tools.controller.ts | getJobStatus | 是 | |
| POST | /schools/:schoolId/tools/click-audit | tools.controller.ts | auditClick | 是 | |
| GET | /schools/:schoolId/teacher-tools/state | tools/teacher-tools.controller.ts | getTeacherToolsState | 是 | **重复路由!** |
| POST | /schools/:schoolId/teacher-tools/generate-plan | tools/teacher-tools.controller.ts | generatePlan | 是 | **重复路由!**, PROVIDER_NOT_CONFIGURED |
| GET | /schools/:schoolId/teacher-tools/drafts | tools/teacher-tools.controller.ts | listDrafts | 是 | **重复路由!** |
| POST | /schools/:schoolId/teacher-tools/drafts | tools/teacher-tools.controller.ts | saveDraft | 是 | **重复路由!** |
| GET | /schools/:schoolId/teacher-tools/invite-code | tools/teacher-tools.controller.ts | getInviteCode | 是 | **重复路由!** |
| GET | /schools/:schoolId/external-services | tools/teacher-tools.controller.ts | listExternalServices | 是 | |

---

### Speech Jobs

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/speech-jobs | speech-job.controller.ts | createSpeechJob | 是 | |
| GET | /schools/:schoolId/speech-jobs/:jobId | speech-job.controller.ts | getSpeechJob | 是 | |
| GET | /schools/:schoolId/speech-jobs/by-item/:assessmentItemId | speech-job.controller.ts | listSpeechJobsByItem | 是 | |
| PUT | /schools/:schoolId/speech-jobs/:jobId/result | speech-job.controller.ts | updateSpeechJobResult | 是 | Worker回调 |

---

### Recordings

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/recordings | recordings.controller.ts | initRecording | 是 | |
| POST | /schools/:schoolId/recordings/simple | recordings.controller.ts | initSimpleRecording | 是 | |
| POST | /schools/:schoolId/recordings/:recordingId/parts/:partNumber/upload-url | recordings.controller.ts | uploadPart | 是 | |
| POST | /schools/:schoolId/recordings/:recordingId/complete | recordings.controller.ts | completeRecording | 是 | |
| GET | /schools/:schoolId/recordings/:recordingId | recordings.controller.ts | getRecordingStatus | 是 | |
| GET | /schools/:schoolId/recordings/:recordingId/evidence | recordings.controller.ts | getRecordingEvidence | 是 | |

---

### Reporting

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/reports | reporting.controller.ts | listReports | 是 | |
| POST | /schools/:schoolId/reports | reporting.controller.ts | createReport | 是 | |
| GET | /schools/:schoolId/reports/:reportId | reporting.controller.ts | getReport | 是 | |
| GET | /schools/:schoolId/student-growth/:enrollmentId | reporting.controller.ts | getStudentGrowthProfile | 是 | |
| GET | /schools/:schoolId/student-growth/:enrollmentId/learning-plan | reporting.controller.ts | getLearningPlan | 是 | |
| POST | /schools/:schoolId/student-growth/:enrollmentId/learning-plan | reporting.controller.ts | saveLearningPlan | 是 | |

---

### Sync

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/sync/batches | sync.controller.ts | createBatch | 是 | |
| GET | /schools/:schoolId/sync/batches | sync.controller.ts | listBatches | 是 | |
| GET | /schools/:schoolId/sync/batches/:batchId | sync.controller.ts | getBatch | 是 | |
| POST | /schools/:schoolId/sync/batches/:batchId | sync.controller.ts | updateBatch | 是 | |
| GET | /schools/:schoolId/sync/devices/:deviceId/cursors | sync.controller.ts | getCursors | 是 | |
| POST | /schools/:schoolId/sync/devices/:deviceId/cursors | sync.controller.ts | upsertCursor | 是 | |

---

### Offline

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/offline-packages | offline.controller.ts | listPackages | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/offline-packages | offline.controller.ts | createPackage | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/offline-packages/:packageId | offline.controller.ts | getPackage | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/offline-packages/:packageId/download | offline.controller.ts | authorizeDownload | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/sync-batches | offline.controller.ts | createSyncBatch | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/sync-batches/:batchId | offline.controller.ts | getSyncBatch | 否 | 无Prisma, Repository接口 |

---

### Support Pairings

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/support-pairings | support-pairings.controller.ts | createPairing | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/support-pairings | support-pairings.controller.ts | listPairings | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/support-pairings/me/pairings | support-pairings.controller.ts | listMyPairings | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/support-pairings/:pairingId | support-pairings.controller.ts | getPairing | 否 | 无Prisma, Repository接口 |
| PATCH | /schools/:schoolId/support-pairings/:pairingId/consent | support-pairings.controller.ts | updateConsent | 否 | 无Prisma, Repository接口 |
| PATCH | /schools/:schoolId/support-pairings/:pairingId/status | support-pairings.controller.ts | updateStatus | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/support-pairings/:pairingId/sessions | support-pairings.controller.ts | createSession | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/support-pairings/:pairingId/sessions | support-pairings.controller.ts | listSessions | 否 | 无Prisma, Repository接口 |
| PATCH | /schools/:schoolId/support-pairings/:pairingId/sessions/:sessionId/review | support-pairings.controller.ts | reviewSession | 否 | 无Prisma, Repository接口 |

---

### Community

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/community/posts | community.controller.ts | createPost | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/community/posts | community.controller.ts | listPosts | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/community/posts/:postId | community.controller.ts | getPost | 否 | 无Prisma, Repository接口 |
| PATCH | /schools/:schoolId/community/posts/:postId | community.controller.ts | updatePost | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/community/posts/:postId/submit | community.controller.ts | submitForReview | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/community/posts/:postId/review | community.controller.ts | reviewPost | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/community/posts/:postId/comments | community.controller.ts | addComment | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/community/posts/:postId/comments | community.controller.ts | listComments | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/community/reports | community.controller.ts | createReport | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/community/reports | community.controller.ts | listReports | 否 | 无Prisma, Repository接口 |
| PATCH | /schools/:schoolId/community/reports/:reportId | community.controller.ts | reviewReport | 否 | 无Prisma, Repository接口 |

---

### Cooperation

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/cooperation/leads | cooperation.controller.ts | submitLead | 否 | @Public, 无Prisma |
| GET | /schools/:schoolId/cooperation/leads | cooperation.controller.ts | listLeads | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/cooperation/leads/:leadId | cooperation.controller.ts | getLead | 否 | 无Prisma, Repository接口 |
| PATCH | /schools/:schoolId/cooperation/leads/:leadId/status | cooperation.controller.ts | updateLeadStatus | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/cooperation/support-applications | cooperation.controller.ts | submitSupportApplication | 否 | @Public, 无Prisma |
| GET | /schools/:schoolId/cooperation/support-applications | cooperation.controller.ts | listSupportApplications | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/cooperation/support-applications/:applicationId | cooperation.controller.ts | getSupportApplication | 否 | 无Prisma, Repository接口 |
| PATCH | /schools/:schoolId/cooperation/support-applications/:applicationId/review | cooperation.controller.ts | reviewSupportApplication | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/cooperation/volunteer-applications | cooperation.controller.ts | submitVolunteerApplication | 否 | @Public, 无Prisma |
| GET | /schools/:schoolId/cooperation/volunteer-applications | cooperation.controller.ts | listVolunteerApplications | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/cooperation/volunteer-applications/:applicationId | cooperation.controller.ts | getVolunteerApplication | 否 | 无Prisma, Repository接口 |
| PATCH | /schools/:schoolId/cooperation/volunteer-applications/:applicationId/review | cooperation.controller.ts | reviewVolunteerApplication | 否 | 无Prisma, Repository接口 |

---

### Volunteers

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/volunteers | volunteers.controller.ts | apply | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/volunteers | volunteers.controller.ts | listVolunteers | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/volunteers/me | volunteers.controller.ts | getMyProfile | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/volunteers/:volunteerId | volunteers.controller.ts | getVolunteer | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/volunteers/:volunteerId/transition | volunteers.controller.ts | transitionStatus | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/volunteers/:volunteerId/service-tasks | volunteers.controller.ts | listMyServiceTasks | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/volunteers/service-tasks | volunteers.controller.ts | listServiceTasks | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/volunteers/service-tasks/:taskId/assign | volunteers.controller.ts | assignServiceTask | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/volunteers/service-tasks/:taskId/start | volunteers.controller.ts | startMyServiceTask | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/volunteers/service-tasks/:taskId/complete | volunteers.controller.ts | completeMyServiceTask | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/volunteers/incidents | volunteers.controller.ts | reportIncident | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/volunteers/incidents | volunteers.controller.ts | listIncidents | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/volunteers/incidents/:incidentId | volunteers.controller.ts | getIncident | 否 | 无Prisma, Repository接口 |

---

### Training

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /schools/:schoolId/training | training.controller.ts | listPrograms | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/training/programs/:programId | training.controller.ts | getProgram | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/training | training.controller.ts | createProgram | 否 | 无Prisma, Repository接口 |
| PUT | /schools/:schoolId/training/:programId | training.controller.ts | updateProgram | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/training/:programId/enroll | training.controller.ts | enroll | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/training/enrollments/me | training.controller.ts | getMyEnrollments | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/training/enrollments | training.controller.ts | listEnrollments | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/training/:programId/progress | training.controller.ts | updateProgress | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/training/:programId/progress | training.controller.ts | getProgress | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/training/exams | training.controller.ts | scheduleExam | 否 | 无Prisma, Repository接口 |
| POST | /schools/:schoolId/training/exams/:examId/attempt | training.controller.ts | submitAttempt | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/training/exams/:examId | training.controller.ts | getExamResults | 否 | 无Prisma, Repository接口 |

---

### Translations

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /schools/:schoolId/translations/jobs | translations.controller.ts | createTranslation | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/translations/jobs/me | translations.controller.ts | listMyJobs | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/translations/jobs | translations.controller.ts | listJobs | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/translations/jobs/:jobId | translations.controller.ts | getJobStatus | 否 | 无Prisma, Repository接口 |
| GET | /schools/:schoolId/translations/glossary | translations.controller.ts | getGlossary | 否 | 无Prisma, Repository接口 |

---

### Admin端 (admin-stub.controller.ts -- 完整实现, 非stub)

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /admin/dashboard | admin-stub.controller.ts | dashboard | 是 | |
| GET | /admin/schools | admin-stub.controller.ts | listSchools | 是 | |
| POST | /admin/schools | admin-stub.controller.ts | createSchool | 是 | |
| GET | /admin/schools/:id | admin-stub.controller.ts | getSchool | 是 | |
| GET | /admin/schools/:id/overview | admin-stub.controller.ts | schoolOverview | 是 | |
| PATCH | /admin/schools/:id | admin-stub.controller.ts | updateSchool | 是 | |
| DELETE | /admin/schools/:id | admin-stub.controller.ts | deleteSchool | 是 | |
| GET | /admin/schools/:id/subscription | admin-stub.controller.ts | getSchoolSubscription | 是 | |
| GET | /admin/schools/:id/quota-usage | admin-stub.controller.ts | getSchoolQuotaUsage | 是 | |
| POST | /admin/schools/:id/quota-usage/events | admin-stub.controller.ts | recordQuotaUsageEvent | 是 | |
| POST | /admin/schools/:id/subscription | admin-stub.controller.ts | createSchoolSubscription | 是 | |
| POST | /admin/schools/import | admin-stub.controller.ts | importSchools | 是 | |
| GET | /admin/schools/import-jobs | admin-stub.controller.ts | listSchoolImportJobs | 是 | |
| POST | /admin/schools/import-jobs/:id/run | admin-stub.controller.ts | runSchoolImportJob | 是 | |
| GET | /admin/users | admin-stub.controller.ts | listUsers | 是 | |
| GET | /admin/users/:id | admin-stub.controller.ts | getUser | 是 | |
| GET | /admin/users/:id/privacy-export | admin-stub.controller.ts | privacyExportUser | 是 | |
| POST | /admin/users/invitations | admin-stub.controller.ts | inviteUser | 是 | |
| GET | /admin/users/invitations | admin-stub.controller.ts | listInvitations | 是 | |
| POST | /admin/users/invitations/:id/revoke | admin-stub.controller.ts | revokeInvitation | 是 | |
| PATCH | /admin/users/:id/membership | admin-stub.controller.ts | updateMembership | 是 | |
| GET | /admin/curriculum | admin-stub.controller.ts | listCurriculum | 是 | |
| GET | /admin/curriculum/:id | admin-stub.controller.ts | getCurriculum | 是 | |
| PATCH | /admin/curriculum/:id | admin-stub.controller.ts | updateCurriculum | 是 | |
| POST | /admin/curriculum/:id/publish | admin-stub.controller.ts | publishCurriculum | 是 | |
| POST | /admin/curriculum/:id/assignments | admin-stub.controller.ts | createCurriculumAssignment | 是 | |
| PATCH | /admin/curriculum/:versionId/activities/batch | admin-stub.controller.ts | batchUpdateCurriculumActivities | 是 | |
| PATCH | /admin/curriculum/:versionId/activities/:activityId | admin-stub.controller.ts | updateCurriculumActivity | 是 | |
| POST | /admin/curriculum/:versionId/activities | admin-stub.controller.ts | createCurriculumActivity | 是 | |
| PATCH | /admin/curriculum/:versionId/activities/:activityId/reorder | admin-stub.controller.ts | reorderCurriculumActivity | 是 | |
| DELETE | /admin/curriculum/:versionId/activities/:activityId | admin-stub.controller.ts | deleteCurriculumActivity | 是 | |
| POST | /admin/curriculum/:versionId/activities/:activityId/questions | admin-stub.controller.ts | createCurriculumQuestion | 是 | |
| PATCH | /admin/curriculum/:versionId/questions/:questionId/reorder | admin-stub.controller.ts | reorderCurriculumQuestion | 是 | |
| DELETE | /admin/curriculum/:versionId/questions/:questionId | admin-stub.controller.ts | deleteCurriculumQuestion | 是 | |
| PATCH | /admin/curriculum/:versionId/questions/batch | admin-stub.controller.ts | batchUpdateCurriculumQuestions | 是 | |
| PATCH | /admin/curriculum/:versionId/questions/:questionId | admin-stub.controller.ts | updateCurriculumQuestion | 是 | |
| GET | /admin/content-review/queue | admin-stub.controller.ts | listContentReviewQueue | 是 | |
| GET | /admin/content-review/:id | admin-stub.controller.ts | getContentReview | 是 | |
| POST | /admin/content-review/:id/decision | admin-stub.controller.ts | reviewContent | 是 | |
| GET | /admin/assessment-links | admin-stub.controller.ts | listAssessmentLinks | 是 | |
| POST | /admin/assessment-links | admin-stub.controller.ts | createAssessmentLink | 是 | |
| POST | /admin/assessment-links/:id/revoke | admin-stub.controller.ts | revokeAssessmentLink | 是 | |
| GET | /admin/assessment-links/:id/accesses | admin-stub.controller.ts | listAssessmentLinkAccesses | 是 | |
| GET | /admin/product-plans | admin-stub.controller.ts | listProductPlans | 是 | |
| POST | /admin/product-plans | admin-stub.controller.ts | createProductPlan | 是 | |
| PATCH | /admin/product-plans/:id | admin-stub.controller.ts | updateProductPlan | 是 | |
| PATCH | /admin/subscriptions/:id | admin-stub.controller.ts | updateSubscription | 是 | |
| POST | /admin/subscriptions/:id/renew | admin-stub.controller.ts | renewSubscription | 是 | |
| GET | /admin/assessment/overview | admin-stub.controller.ts | assessmentOverview | 是 | |
| GET | /admin/privacy/policies | admin-stub.controller.ts | listDataPolicies | 是 | |
| POST | /admin/privacy/policies | admin-stub.controller.ts | createDataPolicy | 是 | |
| POST | /admin/privacy/policies/:id/activate | admin-stub.controller.ts | activateDataPolicy | 是 | |
| GET | /admin/privacy/retention-jobs | admin-stub.controller.ts | listRetentionJobs | 是 | |
| POST | /admin/privacy/retention-jobs | admin-stub.controller.ts | createRetentionJob | 是 | |
| POST | /admin/privacy/retention-jobs/:id/run | admin-stub.controller.ts | runRetentionJob | 是 | |
| GET | /admin/privacy/requests | admin-stub.controller.ts | listPrivacyRequests | 是 | |
| POST | /admin/privacy/requests | admin-stub.controller.ts | createPrivacyRequest | 是 | |
| POST | /admin/privacy/requests/:id/decision | admin-stub.controller.ts | decidePrivacyRequest | 是 | |
| POST | /admin/privacy/requests/:id/execute | admin-stub.controller.ts | executePrivacyRequest | 是 | |
| POST | /admin/privacy/requests/:id/revoke | admin-stub.controller.ts | revokePrivacyFreeze | 是 | |

---

### Audit (audit-stub.controller.ts -- 完整实现, 非stub)

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /audit/logs/export | audit-stub.controller.ts | exportLogs | 是 | CSV导出 |
| POST | /audit/logs | audit-stub.controller.ts | createLog | 是 | |
| GET | /audit/logs | audit-stub.controller.ts | searchLogs | 是 | |
| GET | /audit/providers | audit-stub.controller.ts | listProviders | 是 | |
| POST | /audit/providers | audit-stub.controller.ts | createProvider | 是 | |
| GET | /audit/providers/:id/health | audit-stub.controller.ts | checkProviderHealth | 是 | |
| PATCH | /audit/providers/:id | audit-stub.controller.ts | updateProvider | 是 | |

---

### Assessment Link (assessment-link.controller.ts)

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| POST | /assessment-links/resolve | assessment-link.controller.ts | resolve | 是 | MVP Gap |

---

### Plans (plans-stub.controller.ts)

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /plans | plans-stub.controller.ts | listPublicPlans | 是 | @Public |

---

### MVP Gap Stubs (PERSISTENCE_PENDING)

| HTTP方法 | 路由 | Controller文件 | 方法名 | Prisma持久化 | 备注 |
|----------|------|----------------|--------|-------------|------|
| GET | /research/governance/versions | research-stub.controller.ts | listGovernanceVersions | 否 | PERSISTENCE_PENDING |
| GET | /research/governance/versions/:id | research-stub.controller.ts | getGovernanceVersion | 否 | PERSISTENCE_PENDING |
| POST | /research/governance/versions/:id/reviews | research-stub.controller.ts | submitReview | 否 | PERSISTENCE_PENDING |
| GET | /research/governance/versions/:id/reviews | research-stub.controller.ts | listReviews | 否 | PERSISTENCE_PENDING |
| GET | /assessments | assessment-stub.controller.ts | list | 否 | PERSISTENCE_PENDING (503) |
| GET | /assessments/:id | assessment-stub.controller.ts | findById | 否 | PERSISTENCE_PENDING (503) |
| POST | /assessments/:id/responses | assessment-stub.controller.ts | submitResponse | 否 | PERSISTENCE_PENDING (503) |
| GET | /assessments/:id/results | assessment-stub.controller.ts | getResults | 否 | PERSISTENCE_PENDING (503) |

---

## 三、重复路由详情

| 路由前缀 | 文件A | 文件B | 冲突端点 |
|----------|-------|-------|----------|
| `schools/:schoolId/teacher-tools` | `teacher-tools/teacher-tools.controller.ts` | `tools/teacher-tools.controller.ts` | `GET state`, `POST generate-plan`, `GET drafts`, `POST drafts`, `GET invite-code` |

两个文件均注册 `@Controller("schools/:schoolId/teacher-tools")`，NestJS 路由解析取决于模块注册顺序，后注册者覆盖先注册者的同路径端点。实际生效的可能是 `tools/teacher-tools.controller.ts`（取决于模块 import 顺序）。

---

## 四、Stub/占位符详情

### PERSISTENCE_PENDING (503 SERVICE_UNAVAILABLE)

| 文件 | 端点数 | 状态码 | 说明 |
|------|--------|--------|------|
| research-stub.controller.ts | 4 | 503 | Research governance 持久化未实现 |
| assessment-stub.controller.ts | 4 | 503 | Assessment 旧接口(非session模式)未实现 |

### 返回空数组 [] 的方法

| 文件 | 行号 | 方法 | 说明 |
|------|------|------|------|
| feedback.service.ts | 102 | listPendingFeedback | 返回空数组 |
| learning.service.ts | 149 | listTasks | 返回空数组 |
| learning.service.ts | 173 | getTaskDetail | 返回空数组 |

### PROVIDER_NOT_CONFIGURED

| 文件 | 方法 | 说明 |
|------|------|------|
| teacher-tools.service.ts | mindgraph | AI提供商未配置时抛出 |
| teacher-tools.service.ts | translation | AI提供商未配置时抛出 |
| teacher-tools.service.ts | generatePlan | AI提供商未配置时抛出 |

### 命名含"stub"但实际已完整实现

| 文件 | Prisma持久化 | 说明 |
|------|-------------|------|
| admin-stub.controller.ts | 是 | 完整Prisma实现,约50+端点,名不副实 |
| audit-stub.controller.ts | 是 | 完整Prisma实现,7端点,名不副实 |

---

## 五、关键风险

1. **重复路由**: `schools/:schoolId/teacher-tools` 被两个 Controller 同时注册，NestJS 模块加载顺序决定哪个生效，属于运行时不确定性风险。建议合并为一个 Controller 或修改路由前缀。

2. **Stub命名误导**: `admin-stub.controller.ts` 和 `audit-stub.controller.ts` 均已包含完整 Prisma 持久化实现，但文件名含 "stub"，可能误导开发者认为这些端点未实现，应重命名。

3. **PERSISTENCE_PENDING 端点无降级**: `research-stub.controller.ts` 和 `assessment-stub.controller.ts` 的端点直接返回 503，前端若未做优雅降级会导致用户可见错误。

4. **空数组占位**: `feedback.service.ts` 和 `learning.service.ts` 部分方法返回空数组而非真实数据，前端可能误以为数据为空而非未实现。

5. **PROVIDER_NOT_CONFIGURED 暴露内部状态**: `teacher-tools.service.ts` 在 AI 提供商未配置时抛出 PROVIDER_NOT_CONFIGURED，该错误码暴露了内部基础设施状态，可能被用于信息探测。

6. **Internal API 认证弱**: `internal.controller.ts` 仅通过 `X-Internal-Key` header 做认证，无 IP 白名单或 mTLS，在公网可达部署下有被伪造请求的风险。

7. **health/ready 探针不完整**: `health.controller.ts` 的 `ready` 端点始终返回 ok，未检查数据库连接状态，K8s 就绪探针可能误判。

8. **无Prisma模块的持久化黑盒**: community, cooperation, curriculum, offline, organizations, support-pairings, training, translations, volunteers 等 9 个模块通过 Repository 接口抽象，未直接使用 PrismaService，其底层实现需进一步验证是否已有真实 Prisma 实现。
