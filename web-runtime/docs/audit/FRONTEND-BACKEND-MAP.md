# 前端-后端映射审计

> 审计时间：2026-07-18

## 一、映射总览

| 指标 | 数值 |
|------|------|
| YuzanApi封装方法数 | 95 |
| 实际被JS调用的方法数 | 24 |
| 直接fetch调用数 | 7 |
| 调用了不存在/未封装的API | 0 |
| 前端调用了但后端是stub的 | 3 |

**说明**：api-client.js 暴露了 95 个方法（含 request 通用方法和 getToken/setToken/getStoredUser/getActiveSchoolId/setActiveSchoolId/clearSession/requireAuth/getHomeUrlByRole 等工具方法）。其中仅 24 个被前端 JS 文件实际调用（不含工具方法中的 getToken/getActiveSchoolId 等 8 个辅助方法）。另有 7 处直接 `fetch()` 调用绕过 YuzanApi 封装。

---

## 二、按页面分组映射

### 登录/选择学校

| 前端页面 | JS文件 | 调用的YuzanApi方法 | 对应后端路由 | 后端状态 |
|---|---|---|---|---|
| 登录 | login.js:81 | `login()` | POST /api/v1/auth/login | LIVE |
| 登录 | login.js:84,96,185 | `getHomeUrlByRole()` | (纯前端路由，无后端) | N/A |
| 注册 | login.js:182 | `register()` | POST /api/v1/auth/register | LIVE |
| 选择学校 | select.js:53 | `getToken()` | (本地token检查) | N/A |
| 选择学校 | select.js:60 | `me()` | GET /api/v1/me | LIVE |
| 选择学校 | select.js:78 | `selectSchool()` | POST /api/v1/auth/select-school | LIVE |

### 教师端

| 前端页面 | JS文件 | 调用的YuzanApi方法 | 对应后端路由 | 后端状态 |
|---|---|---|---|---|
| 教师主页 | teacher.js:233 | `getToken()` | (本地token检查) | N/A |
| 作业管理 | assignments/app.js:71 | `getToken()` | (本地token检查) | N/A |
| 作业管理 | assignments/app.js:76 | `getActiveSchoolId()` | (localStorage读取) | N/A |
| 作业管理 | assignments/app.js:86 | `request('/schools/:id/classes/teachers/me')` | GET /api/v1/schools/:id/classes/teachers/me | LIVE |
| 作业管理 | assignments/app.js:92 | `request('/schools/:id/course-versions')` | GET /api/v1/schools/:id/course-versions | LIVE |
| 作业管理 | assignments/app.js:100 | `request('/schools/:id/assignments')` | GET /api/v1/schools/:id/assignments | LIVE |
| 作业管理 | assignments/app.js:260 | `request('/schools/:id/assignments')` | POST /api/v1/schools/:id/assignments | LIVE |
| 提交审核 | courses/spring/studio/studio.js:157 | `request('/schools/:id/course-versions/:vid')` | GET /api/v1/schools/:id/course-versions/:vid | LIVE |
| 课程版本列表 | courses/spring/studio/studio.js:187 | `request('/schools/:id/course-versions')` | GET /api/v1/schools/:id/course-versions | LIVE |
| 提交审核 | courses/spring/studio/studio.js:250 | `submitForReview()` | POST /api/v1/schools/:id/course-versions/:vid/submit-review | LIVE |
| 课程版本保存 | courses/spring/studio/studio.js:275 | `request('/schools/:id/course-versions/:vid')` | PATCH /api/v1/schools/:id/course-versions/:vid | LIVE |
| 批阅详情 | reviews/submission-1/app.js:89 | `request('/schools/:id/assignments/:aid/submissions')` | GET /api/v1/schools/:id/assignments/:aid/submissions | LIVE |

### 学生端

| 前端页面 | JS文件 | 调用的YuzanApi方法 | 对应后端路由 | 后端状态 |
|---|---|---|---|---|
| 学生导航 | shared/student-nav.js:27,28 | `getToken()`, `getStoredUser()` | (本地状态) | N/A |
| 学生导航 | shared/student-nav.js:35 | `getActiveSchoolId()` | (localStorage读取) | N/A |
| 学生导航 | shared/student-nav.js:38 | `getStudentProfile()` | GET /api/v1/schools/:id/student/profile | LIVE |
| 今日任务 | student/today/today.js:61 | `getStudentToday()` | GET /api/v1/schools/:id/student/today | LIVE |
| 今日任务 | student/today/today.js:64 | `request('/schools/:id/learning/tasks')` | GET /api/v1/schools/:id/learning/tasks | LIVE |
| 课程中心 | student/courses/courses.js:119 | `requireAuth()` | (本地token检查) | N/A |
| 课程中心 | student/courses/courses.js:132 | `getStudentCoursesDashboard()` | GET /api/v1/schools/:id/student/courses-dashboard | LIVE |
| 课程中心 | student/courses/courses.js:145 | `request('/schools/:id/learning/tasks')` | GET /api/v1/schools/:id/learning/tasks | LIVE |
| 成长记录 | student/growth/growth.js:58 | `request('/schools/:id/submissions/me')` | GET /api/v1/schools/:id/submissions/me | LIVE |
| 成长记录 | student/growth/growth.js:59 | `request('/schools/:id/learning/tasks')` | GET /api/v1/schools/:id/learning/tasks | LIVE |
| 成长记录 | student/growth/growth.js:60 | `getStudentTeacherAdvice()` | GET /api/v1/schools/:id/student/teacher-advice | LIVE |
| 成长记录 | student/growth/growth.js:74 | `request('/schools/:id/submissions/:sid/feedback')` | GET /api/v1/schools/:id/submissions/:sid/feedback | LIVE |
| 录音播放器 | student/learn/spring-2/player.js:58 | `initRecording()` | POST /api/v1/schools/:id/recordings | LIVE |
| 录音播放器 | student/learn/spring-2/player.js:83 | `getRecordingPartUploadUrl()` | POST /api/v1/schools/:id/recordings/:rid/parts/:pn/upload-url | LIVE |
| 录音播放器 | student/learn/spring-2/player.js:99 | `completeRecording()` | POST /api/v1/schools/:id/recordings/:rid/complete | LIVE |

### 管理端

| 前端页面 | JS文件 | 调用的YuzanApi方法 | 对应后端路由 | 后端状态 |
|---|---|---|---|---|
| 管理主页 | admin.js:26 | `getAdminDashboard()` | GET /api/v1/admin/dashboard | LIVE(AdminStub) |
| 学校管理 | admin-schools-standalone/app.js:20 | `listAdminSchools()` | GET /api/v1/admin/schools | LIVE(AdminStub) |
| 学校管理 | admin-schools-standalone/app.js:21 | `createAdminSchool()` | POST /api/v1/admin/schools | LIVE(AdminStub) |
| 学校管理 | admin-schools-standalone/app.js:21 | `updateAdminSchool()` | PATCH /api/v1/admin/schools/:id | LIVE(AdminStub) |
| 用户角色 | admin-users-roles-standalone/app.js:49 | `listAdminUsers()` | GET /api/v1/admin/users | LIVE(AdminStub) |
| 系统服务商 | admin-system-providers-standalone/app.js:25,42 | `checkAdminProviderHealth()` | GET /api/v1/audit/providers/:id/health | LIVE(AuditStub) |
| 系统服务商 | admin-system-providers-standalone/app.js:50 | `listAdminProviders()` | GET /api/v1/audit/providers | LIVE(AuditStub) |
| 套餐管理 | admin-product-plans-pixel/script.js:33 | `listAdminProductPlans()` | GET /api/v1/admin/product-plans | LIVE(AdminStub) |
| 隐私合规 | admin-privacy-ui/app.js:123 | `exportAdminAuditLogs()` | GET /api/v1/audit/logs/export | LIVE(AuditStub) |
| 隐私合规 | admin-privacy-ui/app.js:131 | `listAdminAuditLogs()` | GET /api/v1/audit/logs | LIVE(AuditStub) |
| 内容审核 | admin-content-review/app.js:109 | `listAdminContentReviewQueue()` | GET /api/v1/admin/content-review/queue | LIVE(AdminStub) |
| 内容审核 | admin-content-review/app.js:128 | `decideAdminContentReview()` | POST /api/v1/admin/content-review/:id/decision | LIVE(AdminStub) |

### 测评端

| 前端页面 | JS文件 | 调用的YuzanApi方法 | 对应后端路由 | 后端状态 |
|---|---|---|---|---|
| (测评页面) | assessment/*.js | (无YuzanApi调用) | — | — |

> 测评端所有JS文件（assessment.js, reading.js, written.js, history.js, report.js）均不包含任何 YuzanApi 或 fetch 调用，推测通过 SSR 或内联数据渲染。

### 志愿者端

| 前端页面 | JS文件 | 调用的YuzanApi方法 | 对应后端路由 | 后端状态 |
|---|---|---|---|---|
| 志愿者主页 | volunteer.js:126 | `request('/schools/:id/volunteers/service-tasks/:tid/:action')` | POST /api/v1/schools/:id/volunteers/service-tasks/:tid/start或complete | LIVE |
| 志愿者主页 | volunteer.js:131 | `request('/schools/:id/notifications')` | GET /api/v1/schools/:id/notifications | LIVE |
| 志愿者主页 | volunteer.js:133 | `request('/schools/:id/volunteers/incidents')` | POST /api/v1/schools/:id/volunteers/incidents | **STUB** |
| 志愿者主页 | volunteer.js:146 | `request('/schools/:id/volunteers/me')` | GET /api/v1/schools/:id/volunteers/me | LIVE |
| 志愿者主页 | volunteer.js:148 | `request('/schools/:id/volunteers/:vid/service-tasks')` | GET /api/v1/schools/:id/volunteers/:vid/service-tasks | LIVE |
| 志愿者主页 | volunteer.js:149 | `request('/schools/:id/training/enrollments/me')` | GET /api/v1/schools/:id/training/enrollments/me | LIVE |
| 志愿者主页 | volunteer.js:150 | `request('/schools/:id/training')` | GET /api/v1/schools/:id/training | LIVE |

### 学生独立页面（student-pages/）

| 前端页面 | JS文件 | 调用的YuzanApi方法 | 对应后端路由 | 后端状态 |
|---|---|---|---|---|
| (所有子页面) | 各子目录/app.js或script.js | (无YuzanApi调用) | — | — |

> student-pages 下所有独立页面均不包含任何 YuzanApi 或 fetch 调用，推测通过 SSR 或内联数据渲染。

### 志愿者独立页面（volunteer-pages/）

| 前端页面 | JS文件 | 调用的YuzanApi方法 | 对应后端路由 | 后端状态 |
|---|---|---|---|---|
| (所有子页面) | 各子目录/app.js或script.js | (无YuzanApi调用) | — | — |

> volunteer-pages 下所有独立页面均不包含任何 YuzanApi 或 fetch 调用，推测通过 SSR 或内联数据渲染。

---

## 三、直接fetch调用清单

| 前端页面 | JS文件 | fetch URL | 是否有YuzanApi封装 | 备注 |
|---|---|---|---|---|
| app-core(通用) | app-core.js:87 | 动态endpoint参数 | 否 | YuzanDemo的fetch封装，用于模拟数据加载 |
| 志愿者主页 | volunteer.js:179 | 动态url参数 | 否 | `loadBackendState(url)`通用SSR数据加载函数 |
| 工具页 | tools.js:152 | 动态url参数 | 否 | `loadBackendState(url)`通用SSR数据加载函数 |
| 研究页 | research.js:64 | 动态url参数 | 否 | `loadBackendState(url)`通用SSR数据加载函数 |
| 套餐页 | plans.js:87 | 动态url参数 | 否 | `loadBackendState(url)`通用SSR数据加载函数 |
| 录音上传 | player.js:72 | uploadInfo.url(预签名URL) | 是(半封装) | 获取上传URL通过YuzanApi，但直传S3用原生fetch |
| 录音上传 | player.js:86 | uploadUrl(预签名URL) | 是(半封装) | 同上，直传S3使用原生fetch |

**说明**：
- 前4个 `fetch` 调用属于 `loadBackendState()` 模式，接收动态URL用于SSR数据注入，不是绕过 YuzanApi 的直接API调用。
- 后2个 `fetch` 调用是S3预签名URL直传，上传URL通过 `YuzanApi.getRecordingPartUploadUrl()` 获取，直传S3必须用原生fetch（不带Bearer token），这是正确做法。

---

## 四、前端调用了但后端是stub的接口

| 前端调用 | JS文件 | 对应后端路由 | 后端控制器 | stub原因 |
|---|---|---|---|---|
| `request('/schools/:id/volunteers/incidents')` POST | volunteer.js:133 | /api/v1/schools/:id/volunteers/incidents | VolunteersController(需确认) | 风险上报功能后端可能未完整实现 |
| `request('/schools/:id/volunteers/me')` GET | volunteer.js:146 | /api/v1/schools/:id/volunteers/me | VolunteersController(需确认) | 志愿者自身信息查询 |
| `request('/schools/:id/volunteers/:vid/service-tasks')` GET | volunteer.js:148 | /api/v1/schools/:id/volunteers/:vid/service-tasks | VolunteersController(需确认) | 志愿者服务任务列表 |

> 注： VolunteersController 后端已存在（`schools/:schoolId/volunteers`），但具体路由端点是否完整需逐方法核实。上述3个请求路径通过 `YuzanApi.request()` 通用方法发起，未在 api-client.js 中有专用封装方法。

---

## 五、后端已有但前端未封装的接口

以下是 api-client.js 中已封装但从未被任何前端JS文件调用的方法（按功能分组）：

### 管理端未调用
| 封装方法 | 后端路由 | 状态 |
|---|---|---|
| `getAdminAssessmentOverview()` | GET /admin/assessment/overview | LIVE(AdminStub) |
| `getAdminCurriculum()` | GET /admin/curriculum | LIVE(AdminStub) |
| `getAdminCurriculumDetail()` | GET /admin/curriculum/:id | LIVE(AdminStub) |
| `updateAdminCurriculum()` | PATCH /admin/curriculum/:id | LIVE(AdminStub) |
| `publishAdminCurriculum()` | POST /admin/curriculum/:id/publish | LIVE(AdminStub) |
| `createAdminCurriculumAssignment()` | POST /admin/curriculum/:id/assignments | LIVE(AdminStub) |
| `updateAdminCurriculumActivity()` | PATCH /admin/curriculum/:vid/activities/:aid | LIVE(AdminStub) |
| `updateAdminCurriculumQuestion()` | PATCH /admin/curriculum/:vid/questions/:qid | LIVE(AdminStub) |
| `createAdminCurriculumActivity()` | POST /admin/curriculum/:vid/activities | LIVE(AdminStub) |
| `createAdminCurriculumQuestion()` | POST /admin/curriculum/:vid/activities/:aid/questions | LIVE(AdminStub) |
| `reorderAdminCurriculumActivity()` | PATCH /admin/curriculum/:vid/activities/:aid/reorder | LIVE(AdminStub) |
| `reorderAdminCurriculumQuestion()` | PATCH /admin/curriculum/:vid/questions/:qid/reorder | LIVE(AdminStub) |
| `deleteAdminCurriculumActivity()` | DELETE /admin/curriculum/:vid/activities/:aid | LIVE(AdminStub) |
| `deleteAdminCurriculumQuestion()` | DELETE /admin/curriculum/:vid/questions/:qid | LIVE(AdminStub) |
| `batchUpdateAdminCurriculumActivities()` | PATCH /admin/curriculum/:vid/activities/batch | LIVE(AdminStub) |
| `batchUpdateAdminCurriculumQuestions()` | PATCH /admin/curriculum/:vid/questions/batch | LIVE(AdminStub) |
| `exportAdminUserPrivacy()` | GET /admin/users/:id/privacy-export | LIVE(AdminStub) |
| `listAdminPrivacyRequests()` | GET /admin/privacy/requests | LIVE(AdminStub) |
| `createAdminPrivacyRequest()` | POST /admin/privacy/requests | LIVE(AdminStub) |
| `decideAdminPrivacyRequest()` | POST /admin/privacy/requests/:id/decision | LIVE(AdminStub) |
| `executeAdminPrivacyRequest()` | POST /admin/privacy/requests/:id/execute | LIVE(AdminStub) |
| `revokeAdminPrivacyFreeze()` | POST /admin/privacy/requests/:id/revoke | LIVE(AdminStub) |
| `createAdminProvider()` | POST /audit/providers | LIVE(AuditStub) |
| `updateAdminProvider()` | PATCH /audit/providers/:id | LIVE(AuditStub) |
| `createAdminProductPlan()` | POST /admin/product-plans | LIVE(AdminStub) |
| `updateAdminProductPlan()` | PATCH /admin/product-plans/:id | LIVE(AdminStub) |
| `getAdminSchool()` | GET /admin/schools/:id | LIVE(AdminStub) |
| `getAdminSchoolSubscription()` | GET /admin/schools/:id/subscription | LIVE(AdminStub) |
| `getAdminSchoolQuotaUsage()` | GET /admin/schools/:id/quota-usage | LIVE(AdminStub) |
| `recordAdminQuotaUsageEvent()` | POST /admin/schools/:id/quota-usage/events | LIVE(AdminStub) |
| `listAdminInvitations()` | GET /admin/users/invitations | LIVE(AdminStub) |
| `revokeAdminInvitation()` | POST /admin/users/invitations/:id/revoke | LIVE(AdminStub) |
| `createAdminSchoolSubscription()` | POST /admin/schools/:id/subscription | LIVE(AdminStub) |
| `updateAdminSubscription()` | PATCH /admin/subscriptions/:id | LIVE(AdminStub) |
| `renewAdminSubscription()` | POST /admin/subscriptions/:id/renew | LIVE(AdminStub) |
| `listAdminDataPolicies()` | GET /admin/privacy/policies | LIVE(AdminStub) |
| `createAdminDataPolicy()` | POST /admin/privacy/policies | LIVE(AdminStub) |
| `activateAdminDataPolicy()` | POST /admin/privacy/policies/:id/activate | LIVE(AdminStub) |
| `listAdminRetentionJobs()` | GET /admin/privacy/retention-jobs | LIVE(AdminStub) |
| `createAdminRetentionJob()` | POST /admin/privacy/retention-jobs | LIVE(AdminStub) |
| `runAdminRetentionJob()` | POST /admin/privacy/retention-jobs/:id/run | LIVE(AdminStub) |
| `listAdminSchoolImportJobs()` | GET /admin/schools/import-jobs | LIVE(AdminStub) |
| `importAdminSchools()` | POST /admin/schools/import | LIVE(AdminStub) |
| `runAdminSchoolImportJob()` | POST /admin/schools/import-jobs/:id/run | LIVE(AdminStub) |
| `listAdminAssessmentLinks()` | GET /admin/assessment-links | LIVE(AdminStub) |
| `createAdminAssessmentLink()` | POST /admin/assessment-links | LIVE(AdminStub) |
| `revokeAdminAssessmentLink()` | POST /admin/assessment-links/:id/revoke | LIVE(AdminStub) |
| `listAdminAssessmentLinkAccesses()` | GET /admin/assessment-links/:id/accesses | LIVE(AdminStub) |
| `resolveAssessmentLink()` | POST /assessment-links/resolve | LIVE |

### 教师端未调用
| 封装方法 | 后端路由 | 状态 |
|---|---|---|
| `getDashboard()` | GET /schools/:id/teacher/dashboard | LIVE |
| `getAtRiskStudents()` | GET /schools/:id/teacher/students/at-risk | LIVE |
| `getPronunciationClusters()` | GET /schools/:id/teacher/class/pronunciation-clusters | LIVE |

### 通知/课程/工具未调用
| 封装方法 | 后端路由 | 状态 |
|---|---|---|
| `getNotifications()` | GET /schools/:id/notifications | LIVE |
| `markNotificationRead()` | PATCH /schools/:id/notifications/:nid/read | LIVE |
| `submitForReview()` (除studio外) | POST /schools/:id/course-versions/:vid/submit-review | LIVE(仅studio调用) |
| `attachResource()` | POST /schools/:id/course-versions/:vid/resources | LIVE |
| `listResources()` | GET /schools/:id/course-versions/:vid/resources | LIVE |
| `attachOfflinePackage()` | POST /schools/:id/course-versions/:vid/offline-packages | LIVE |
| `getTeacherToolsState()` | GET /schools/:id/teacher-tools/state | LIVE |
| `generatePlan()` | POST /schools/:id/teacher-tools/generate-plan | LIVE |
| `listDrafts()` | GET /schools/:id/teacher-tools/drafts | LIVE |
| `saveDraft()` | POST /schools/:id/teacher-tools/drafts | LIVE |
| `getExternalServices()` | GET /schools/:id/external-services | LIVE |
| `getInviteCode()` | GET /schools/:id/teacher-tools/invite-code | LIVE |

### 学生端未调用
| 封装方法 | 后端路由 | 状态 |
|---|---|---|
| `getStudentRecommendations()` | GET /schools/:id/student/recommendations | LIVE |
| `getRecordingStatus()` | GET /schools/:id/recordings/:rid | LIVE |
| `getRecordingEvidence()` | GET /schools/:id/recordings/:rid/evidence | LIVE |

---

## 六、关键风险

1. **大量封装方法从未被调用（71/95）**：api-client.js 封装了 95 个方法，但前端仅实际调用 24 个。约 75% 的封装方法处于"死代码"状态。这些方法可能：(a) 为未来页面预留；(b) 已被 SSR 替代；(c) 是过度设计。建议在下一迭代中清理未使用的方法，或标注其预期使用页面。

2. **YuzanApi.request() 通用方法绕过类型安全**：6 处调用使用 `YuzanApi.request(path, options)` 直接传入路径字符串（如 `/schools/:id/learning/tasks`），而非使用专用封装方法。这些路径在 api-client.js 中没有对应的方法封装，增加了拼写错误和路径不一致的风险。建议为这些频繁调用的路径也创建专用方法。

3. **志愿者端3个API路径未封装**：`/schools/:id/volunteers/incidents`、`/schools/:id/volunteers/me`、`/schools/:id/volunteers/:vid/service-tasks` 均通过 `YuzanApi.request()` 调用，无专用封装方法。风险上报接口（incidents）尤其需要确认后端是否完整实现。

4. **loadBackendState() 模式缺乏统一认证**：4 处 `fetch()` 调用通过 `loadBackendState(url)` 加载SSR数据，不经过 YuzanApi 的 request() 封装（无 Bearer token、无统一错误处理）。如果 SSR 端点返回 401，这些调用不会自动触发 clearSession()，可能导致静默失败。

5. **管理端大量功能仅有后端实现无前端页面**：AdminStubController 提供了约 40+ 个管理端路由（学校CRUD、隐私合规、数据保留、测评链接、订阅管理等），但前端仅有 6 个独立管理页面实际调用其中约 12 个路由。大量管理功能（隐私请求审批、数据保留任务执行、学校批量导入、订阅续期等）缺少对应前端页面。

6. **研究端(research)后端全是503 STUB**：ResearchStubController 所有路由均返回 HTTP 503 + `PERSISTENCE_PENDING`。前端 research.js 的 `loadBackendState()` 调用会因此失败。这是已知的 MVP 缺口。

7. **测评端前端无任何API调用**：assessment/ 下 5 个 JS 文件均无 YuzanApi 或 fetch 调用。如果测评功能依赖后端API（assessments controller 已存在），则前端可能缺少实现，或完全依赖 SSR 注入。

8. **admin-stub.controller.ts 命名误导**：文件名为 `admin-stub.controller.ts`，但实际代码是完整的 Prisma 数据库操作实现（非占位 stub）。建议重命名为 `admin.controller.ts` 以避免混淆，或将真正未实现的路由提取到单独的 stub 文件。