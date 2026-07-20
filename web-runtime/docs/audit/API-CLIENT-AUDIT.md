# API Client 审计报告

> 审计日期：2026-07-18
> 审计对象：web-runtime/assets/api-client.js（682行）
> 审计范围：全部封装方法、调用方式、参数编码、错误处理

## 一、基础架构

- **IIFE封装**：整个客户端在立即执行函数内，通过 `window.YuzanApi` 暴露
- **Token管理**：`localStorage.getItem('yuzan-access-token')`
- **User缓存**：`localStorage.getItem('yuzan-current-user')`
- **SchoolId**：`localStorage.getItem('yuzan-active-school-id')`
- **API代理**：前端通过 `/api/v1/...` 请求，由 server.mjs 代理到 `http://127.0.0.1:4000`

## 二、路径规范化

`normalizeApiPath()` 逻辑：
- `http` 开头 → 直接使用
- `/api/v1/` 开头 → 直接使用
- `/api/` 开头 → 替换为 `/api/v1/...`
- 其他 → 加 `/api/v1` 前缀

**风险**：如果后端路由不以 `/api/v1/` 开头，会导致404。但当前后端统一使用 `/api/v1/`，无问题。

## 三、request() 通用方法

**正常流程**：
1. 规范化路径
2. 添加 Authorization header
3. `credentials: 'include'`
4. 解析响应：`payload.data !== undefined ? payload.data : payload`

**错误处理**：
- 401 → 自动 `clearSession()`，清除所有localStorage
- 其他错误 → 抛出 Error 对象，附带 `status` 和 `code`

**风险点**：
1. ❌ **无请求超时**：没有 AbortController 或 setTimeout 超时机制
2. ❌ **无重试机制**：网络错误不自动重试
3. ⚠️ **响应解包**：`payload.data !== undefined ? payload.data : payload` 可能导致嵌套数据丢失
4. ⚠️ **Content-Type固定**：所有请求都设置 `Content-Type: application/json`，但录音上传需要不同的Content-Type

## 四、全部封装方法清单

### 4.1 认证模块（6个方法）

| 方法 | HTTP | 路径 | 参数 | 使用页面 |
|---|---|---|---|---|
| `login(identifier, password)` | POST | /auth/login | {identifier, password} | login |
| `register(identifier, password, role)` | POST | /auth/register | {identifier, password, role} | login |
| `redeemInvitation(payload)` | POST | /auth/invitations/redeem | payload | login |
| `me()` | GET | /me | — | 多页面 |
| `selectSchool(schoolId)` | POST | /auth/select-school | {schoolId} | select-school |
| `logout()` | POST | /auth/logout | — | 多页面 |

### 4.2 教师仪表板（3个方法）

| 方法 | HTTP | 路径 | 参数 |
|---|---|---|---|
| `getDashboard()` | GET | /schools/:schoolId/teacher/dashboard | — |
| `getAtRiskStudents()` | GET | /schools/:schoolId/teacher/students/at-risk | — |
| `getPronunciationClusters(classId)` | GET | /schools/:schoolId/teacher/class/pronunciation-clusters | classId(可选) |

### 4.3 管理端 — 驾驶舱（1个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `getAdminDashboard()` | GET | /admin/dashboard |

### 4.4 管理端 — 测评概览（1个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `getAdminAssessmentOverview()` | GET | /admin/assessment/overview |

### 4.5 管理端 — 课程/内容管理（18个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `getAdminCurriculum(options)` | GET | /admin/curriculum |
| `getAdminCurriculumDetail(id)` | GET | /admin/curriculum/:id |
| `updateAdminCurriculum(id, payload)` | PATCH | /admin/curriculum/:id |
| `publishAdminCurriculum(id)` | POST | /admin/curriculum/:id/publish |
| `createAdminCurriculumAssignment(id, payload)` | POST | /admin/curriculum/:id/assignments |
| `updateAdminCurriculumActivity(vid, aid, payload)` | PATCH | /admin/curriculum/:vid/activities/:aid |
| `updateAdminCurriculumQuestion(vid, qid, payload)` | PATCH | /admin/curriculum/:vid/questions/:qid |
| `createAdminCurriculumActivity(vid, payload)` | POST | /admin/curriculum/:vid/activities |
| `createAdminCurriculumQuestion(vid, aid, payload)` | POST | /admin/curriculum/:vid/activities/:aid/questions |
| `reorderAdminCurriculumActivity(vid, aid, sortOrder)` | PATCH | /admin/curriculum/:vid/activities/:aid/reorder |
| `reorderAdminCurriculumQuestion(vid, qid, sortOrder)` | PATCH | /admin/curriculum/:vid/questions/:qid/reorder |
| `deleteAdminCurriculumActivity(vid, aid)` | DELETE | /admin/curriculum/:vid/activities/:aid |
| `deleteAdminCurriculumQuestion(vid, qid)` | DELETE | /admin/curriculum/:vid/questions/:qid |
| `batchUpdateAdminCurriculumActivities(vid, updates)` | PATCH | /admin/curriculum/:vid/activities/batch |
| `batchUpdateAdminCurriculumQuestions(vid, updates)` | PATCH | /admin/curriculum/:vid/questions/batch |
| `submitForReview(courseVersionId, expectedUpdatedAt)` | POST | /schools/:schoolId/course-versions/:id/submit-review |
| `attachResource(courseVersionId, resourceId, purpose, meta)` | POST | /schools/:schoolId/course-versions/:id/resources |
| `listResources(courseVersionId)` | GET | /schools/:schoolId/course-versions/:id/resources |

### 4.6 管理端 — 审计日志（2个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `listAdminAuditLogs(options)` | GET | /audit/logs |
| `exportAdminAuditLogs(options)` | GET | /audit/logs/export |

### 4.7 管理端 — 隐私合规（6个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `exportAdminUserPrivacy(userId)` | GET | /admin/users/:id/privacy-export |
| `listAdminPrivacyRequests(options)` | GET | /admin/privacy/requests |
| `createAdminPrivacyRequest(payload)` | POST | /admin/privacy/requests |
| `decideAdminPrivacyRequest(id, payload)` | POST | /admin/privacy/requests/:id/decision |
| `executeAdminPrivacyRequest(id)` | POST | /admin/privacy/requests/:id/execute |
| `revokeAdminPrivacyFreeze(id)` | POST | /admin/privacy/requests/:id/revoke |

### 4.8 管理端 — 供应商（4个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `listAdminProviders(options)` | GET | /audit/providers |
| `createAdminProvider(payload)` | POST | /audit/providers |
| `updateAdminProvider(id, payload)` | PATCH | /audit/providers/:id |
| `checkAdminProviderHealth(id)` | GET | /audit/providers/:id/health |

### 4.9 管理端 — 套餐（3个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `listAdminProductPlans(options)` | GET | /admin/product-plans |
| `createAdminProductPlan(payload)` | POST | /admin/product-plans |
| `updateAdminProductPlan(id, payload)` | PATCH | /admin/product-plans/:id |

### 4.10 管理端 — 学校（4个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `listAdminSchools(options)` | GET | /admin/schools |
| `getAdminSchool(id)` | GET | /admin/schools/:id |
| `createAdminSchool(payload)` | POST | /admin/schools |
| `updateAdminSchool(id, payload)` | PATCH | /admin/schools/:id |

### 4.11 管理端 — 用户（3个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `listAdminUsers(options)` | GET | /admin/users |
| `listAdminInvitations()` | GET | /admin/users/invitations |
| `revokeAdminInvitation(id)` | POST | /admin/users/invitations/:id/revoke |

### 4.12 管理端 — 内容审核（3个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `listAdminContentReviewQueue(options)` | GET | /admin/content-review/queue |
| `getAdminContentReview(id)` | GET | /admin/content-review/:id |
| `decideAdminContentReview(id, payload)` | POST | /admin/content-review/:id/decision |

### 4.13 管理端 — 订阅与配额（5个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `getAdminSchoolSubscription(schoolId)` | GET | /admin/schools/:id/subscription |
| `getAdminSchoolQuotaUsage(schoolId)` | GET | /admin/schools/:id/quota-usage |
| `recordAdminQuotaUsageEvent(schoolId, payload)` | POST | /admin/schools/:id/quota-usage/events |
| `createAdminSchoolSubscription(schoolId, payload)` | POST | /admin/schools/:id/subscription |
| `updateAdminSubscription(id, payload)` | PATCH | /admin/subscriptions/:id |
| `renewAdminSubscription(id, payload)` | POST | /admin/subscriptions/:id/renew |

### 4.14 管理端 — 数据保留（5个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `listAdminDataPolicies(options)` | GET | /admin/privacy/policies |
| `createAdminDataPolicy(payload)` | POST | /admin/privacy/policies |
| `activateAdminDataPolicy(id)` | POST | /admin/privacy/policies/:id/activate |
| `listAdminRetentionJobs()` | GET | /admin/privacy/retention-jobs |
| `createAdminRetentionJob(payload)` | POST | /admin/privacy/retention-jobs |
| `runAdminRetentionJob(id)` | POST | /admin/privacy/retention-jobs/:id/run |

### 4.15 管理端 — 学校导入（3个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `listAdminSchoolImportJobs(options)` | GET | /admin/schools/import-jobs |
| `importAdminSchools(payload)` | POST | /admin/schools/import |
| `runAdminSchoolImportJob(id)` | POST | /admin/schools/import-jobs/:id/run |

### 4.16 管理端 — 测评链接（5个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `listAdminAssessmentLinks()` | GET | /admin/assessment-links |
| `createAdminAssessmentLink(payload)` | POST | /admin/assessment-links |
| `revokeAdminAssessmentLink(id)` | POST | /admin/assessment-links/:id/revoke |
| `listAdminAssessmentLinkAccesses(id)` | GET | /admin/assessment-links/:id/accesses |
| `resolveAssessmentLink(token)` | POST | /assessment-links/resolve |

### 4.17 通知（2个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `getNotifications(options)` | GET | /schools/:schoolId/notifications |
| `markNotificationRead(id)` | PATCH | /schools/:schoolId/notifications/:id/read |

### 4.18 教师工具（6个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `getTeacherToolsState()` | GET | /schools/:schoolId/teacher-tools/state |
| `generatePlan(goal, courseVersionId, gradeBand)` | POST | /schools/:schoolId/teacher-tools/generate-plan |
| `listDrafts()` | GET | /schools/:schoolId/teacher-tools/drafts |
| `saveDraft(toolSource, title, content)` | POST | /schools/:schoolId/teacher-tools/drafts |
| `getExternalServices()` | GET | /schools/:schoolId/external-services |
| `getInviteCode()` | GET | /schools/:schoolId/teacher-tools/invite-code |

### 4.19 学生仪表板（5个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `getStudentProfile()` | GET | /schools/:schoolId/student/profile |
| `getStudentToday()` | GET | /schools/:schoolId/student/today |
| `getStudentCoursesDashboard()` | GET | /schools/:schoolId/student/courses-dashboard |
| `getStudentRecommendations()` | GET | /schools/:schoolId/student/recommendations |
| `getStudentTeacherAdvice(options)` | GET | /schools/:schoolId/student/teacher-advice |

### 4.20 录音（5个方法）

| 方法 | HTTP | 路径 |
|---|---|---|
| `initRecording(enrollmentId, partCount, options)` | POST | /schools/:schoolId/recordings |
| `getRecordingPartUploadUrl(recordingId, partNumber)` | POST | /schools/:schoolId/recordings/:id/parts/:part/upload-url |
| `completeRecording(recordingId, options)` | POST | /schools/:schoolId/recordings/:id/complete |
| `getRecordingStatus(recordingId)` | GET | /schools/:schoolId/recordings/:id |
| `getRecordingEvidence(recordingId)` | GET | /schools/:schoolId/recordings/:id/evidence |

## 五、方法统计

| 分类 | 方法数 |
|---|---|
| 认证 | 6 |
| 教师仪表板 | 3 |
| 管理端 | 68 |
| 通知 | 2 |
| 教师工具 | 6 |
| 学生仪表板 | 5 |
| 录音 | 5 |
| **总计** | **95** |

## 六、缺失的关键方法

以下接口后端已有Controller但 api-client.js 没有封装：

| 缺失模块 | 对应后端路由 | 优先级 |
|---|---|---|
| 班级管理 | /schools/:schoolId/classes | P0 |
| 作业管理 | /schools/:schoolId/assignments | P0 |
| 提交管理 | /schools/:schoolId/submissions | P0 |
| 学习进度 | /schools/:schoolId/learning/tasks, /learning/progress | P0 |
| 反馈管理 | /schools/:schoolId/feedback | P0 |
| 测评会话 | /schools/:schoolId/assessments/sessions | P0 |
| 录音简化初始化 | /schools/:schoolId/recordings/simple | P1 |
| 录音绑定测评题 | /assessments/sessions/:sid/reading/:itemId/recording | P1 |
| 测评设备检查 | /schools/:schoolId/assessments/device-check | P1 |
| 志愿者 | /volunteers | P2 |
| 培训 | /training | P2 |
| 帮扶结对 | /support-pairings | P2 |
| 社区 | /community | P2 |
| 合作 | /cooperation | P2 |
| 翻译 | /translations | P2 |
| 同步 | /sync | P2 |
| 离线包 | /offline | P2 |
| 报告 | /reports, /student-growth | P1 |
| SpeechJob | /schools/:schoolId/speech-jobs | P1 |

## 七、调用方式分布

| 方式 | 说明 | 风险 |
|---|---|---|
| 统一方法调用 | 通过 YuzanApi.xxxMethod() | ✅ 低风险 |
| 通用 request 调用 | 通过 YuzanApi.request('/path') | ⚠️ 中风险，绕过参数校验 |
| 直接 fetch | 页面直接 fetch(url) | 🔴 高风险，绕过鉴权 |
| 本地模拟 | YuzanDemo 或 localStorage | 🔴 高风险，假数据 |

## 八、关键风险

1. **🔴 P0 — 录音上传Content-Type错误**：`request()` 固定设置 `Content-Type: application/json`，但录音上传（PUT到预签名URL）需要 `audio/webm` 或不设置Content-Type。当前 player.js 使用直接 `fetch(uploadUrl, {method:'PUT', body:blob})` 绕过了 api-client.js，这是正确做法但需要文档化。

2. **🔴 P0 — 缺少班级/作业/提交/学习/反馈封装**：这些是P0核心功能，后端Controller已存在但前端没有封装方法。页面如果需要这些功能，只能通过 `YuzanApi.request()` 调用。

3. **⚠️ P1 — 错误响应解包不一致**：`payload.data !== undefined ? payload.data : payload` 可能导致不同后端返回格式解析不一致。

4. **⚠️ P2 — 无请求超时和重试**：长时间请求可能无限等待。

5. **⚠️ P2 — 管理端方法过多（68个）但实际使用率未知**：需要检查哪些方法真正被页面调用。
