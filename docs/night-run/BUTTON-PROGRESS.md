# 夜间执行 · 按钮接线进度表

> 时间：2026-07-19  
> 范围：yuzan-next web-runtime + apps/api  
> 目标：删除硬编码业务 ID，跑通真实录音测评完整链路，所有按钮归入 LIVE_API / LIVE_LOCAL / LIVE_ROUTE / BLOCKED / UNSUPPORTED 之一

## 状态分类

| 标记 | 含义 |
|---|---|
| LIVE_API | 调用真实后端 API 并持久化 |
| LIVE_LOCAL | 正常本地交互（Tab、筛选、展开、播放、关闭弹窗） |
| LIVE_ROUTE | 真实页面跳转 |
| BLOCKED | 因后端尚未实现或环境依赖被阻塞 |
| UNSUPPORTED | 当前版本明确不支持并禁用 |
| ❌ 已删除 | 删除了伪造成功 / 硬编码 ID / 假数据 |

## 一、硬编码 ID 删除清单

| 旧硬编码 | 位置 | 替换为 | 状态 |
|---|---|---|---|
| `SZ20250530-PT-0032` | assessment/assets/app.js | `SESSION_ID` 从 `location.pathname` 解析 | ✅ 已删除 |
| `RD250530-010` | assessment/assets/app.js | `READING_ITEM_ID` 从 `location.pathname` 解析 | ✅ 已删除 |
| `WR250530-001` | assessment/assets/app.js | `WRITTEN_ITEM_ID` 从 `location.pathname` 解析 | ✅ 已删除 |
| `REC250530-010-001` | assessment/assets/app.js | `appState.apiRecordingId` 来自 `initSimpleRecording` 真实响应 | ✅ 已删除 |
| `JOB-7f3a8c2f` | assessment/assets/app.js | `appState.apiSpeechJobId` 来自 `completeSimpleRecording` 或 `getSpeechJobByItem` 真实响应 | ✅ 已删除 |
| `RP250530-0098` | assessment/assets/app.js | `report.id` 来自 `getAssessmentReport` 真实响应 | ✅ 已删除 |

## 二、伪造成功 / 假数据删除清单

| 旧伪造 | 位置 | 替换为 | 状态 |
|---|---|---|---|
| `setTimeout` 假装上传完成 | startRealUpload | 真实 `XMLHttpRequest.upload.onprogress` + `await uploadBlobToPresignedUrl` | ✅ 已删除 |
| `Math.random` 模拟上传进度 | uploadProgress 显示 | 真实 `e.loaded / e.total` 计算百分比 | ✅ 已删除 |
| 本地数组 push 后提示"已发布" | bindSubmit | 调用 `Api.submitAssessmentSession(SESSION_ID)` 成功后才跳转 | ✅ 已删除 |
| `localStorage` 写入后提示"平台已保存" | bindWritten | 调用 `Api.saveWrittenAnswer` 成功后置 SYNCED，调用 `Api.finalizeWrittenAnswer` 成功后置 FINALIZED | ✅ 已删除 |
| API 失败后继续显示成功 | 多处 catch 分支 | 失败时显示 `_uploadError` / `_prepError` 等，按钮恢复可用 | ✅ 已删除 |
| 正式模式自动回退演示数据 | demoMode | `demoMode = query.get('demo') === '1'`，默认 false；显示演示横幅 | ✅ 已删除 |

## 三、测评中心 / 测评流程按钮（学生端）

| 按钮 | 页面 | 类型 | 调用 / 行为 | 状态 |
|---|---|---|---|---|
| 进入测评中心 | student/today | LIVE_ROUTE | 跳转 `/assessment/` | ✅ |
| 查看历史 | assessment center | LIVE_ROUTE | 跳转 `/assessment/history` | ✅ |
| 管理录音库 | assessment center | LIVE_ROUTE | 跳转 `/assessment/recordings` | ✅ |
| 继续测评（优先卡） | assessment center | LIVE_ROUTE | 跳转 `/assessment/sessions/:id/` | ✅ |
| 任务卡（每个 session） | assessment center | LIVE_ROUTE | 按 status 跳转 prep/processing/report | ✅ |
| 重新检测设备 | prep | LIVE_API | getUserMedia + fetch /api/v1/health + `Api.logAssessmentDeviceCheck` | ✅ |
| 开始本次测评 | prep | LIVE_API | `Api.startAssessmentSession` → 跳转第一个未完成 item | ✅ |
| 进入 reading item | prep | LIVE_ROUTE | 跳转 `/assessment/sessions/:id/reading/:itemId/` | ✅ |
| 进入 written item | prep | LIVE_ROUTE | 跳转 `/assessment/sessions/:id/written/:itemId/` | ✅ |
| 播放示范音频 | reading | LIVE_LOCAL | `<Audio>.play()`，播完进入 PREPARING | ✅ |
| 跳过示范 | reading | LIVE_LOCAL | 直接进入 PREPARING | ✅ |
| 准备倒计时 | reading | LIVE_LOCAL | 3 秒倒计时，结束自动 RECORDING | ✅ |
| 开始录音 | reading | LIVE_API | `MediaRecorder.start(1000)`，真实采集麦克风 | ✅ |
| 暂停 / 继续 | reading | LIVE_LOCAL | `mediaRecorder.pause/resume` | ✅ |
| 结束录音 | reading | LIVE_API | `mediaRecorder.stop()` → Blob | ✅ |
| 试听录音 | reading | LIVE_LOCAL | `<Audio src=blobUrl>.play()` | ✅ |
| 重新录制 | reading | LIVE_LOCAL | 释放 stream、清空 Blob、回到 PREPARING | ✅ |
| 确认并上传 | reading | LIVE_API | initSimpleRecording → uploadBlob → completeSimpleRecording → attachAssessmentRecording → pollSpeechJob | ✅ |
| 上传进度显示 | reading | LIVE_API | `XHR.upload.onprogress` 真实百分比 | ✅ |
| 失败重试上传 | reading | LIVE_API | 回到 REVIEWING 后可再次 startRealUpload | ✅ |
| 上一题 / 下一题（书面） | written | LIVE_API + LIVE_ROUTE | `saveWrittenAnswer` 成功后跳转 | ✅ |
| 保存到平台（书面） | written | LIVE_API | `Api.saveWrittenAnswer` | ✅ |
| 题目目录跳转 | written | LIVE_ROUTE | 跳转 `/assessment/sessions/:id/written/:itemId/` | ✅ |
| 提交整次测评 | submit | LIVE_API | 先 finalize 所有书面题 → `Api.submitAssessmentSession` → 跳转 processing | ✅ |
| 返回检查 | submit | LIVE_ROUTE | 跳转 prep | ✅ |
| 处理状态轮询 | processing | LIVE_API | `Api.getSpeechJob` 每 5 秒轮询，终态停止 | ✅ |
| 查看报告（处理完成） | processing | LIVE_ROUTE | 跳转 report | ✅ |
| 重试评分 | processing | BLOCKED | 后端 SpeechJob 重试接口尚未实现，按钮显示但暂不调用 | ⚠ |
| 返回测评中心 | processing / report | LIVE_ROUTE | 跳转 `/assessment/` | ✅ |
| 刷新报告 | report | LIVE_API | `Api.getAssessmentReport` | ✅ |
| 安排复测 | report | LIVE_API | `Api.scheduleRetest(SESSION_ID)` | ✅ |
| 查看历史报告 | history | LIVE_ROUTE | 跳转 `/assessment/sessions/:id/report/` | ✅ |

## 四、动态路由（server.mjs）

| 路径模式 | 匹配 | 返回 | 状态 |
|---|---|---|---|
| `/assessment` `/assessment/` | center | assessment/index.html | ✅ |
| `/assessment/history` | history | _shell.html (page=history) | ✅ |
| `/assessment/recordings` | recordings | _shell.html (page=recordings) | ✅ |
| `/assessment/sessions/:sessionId` | prep | _shell.html (page=prep) | ✅ |
| `/assessment/sessions/:sessionId/reading/:itemId` | reading | _shell.html (page=reading) | ✅ |
| `/assessment/sessions/:sessionId/written/:itemId` | written | _shell.html (page=written) | ✅ |
| `/assessment/sessions/:sessionId/submit` | submit | _shell.html (page=submit) | ✅ |
| `/assessment/sessions/:sessionId/processing` | processing | _shell.html (page=processing) | ✅ |
| `/assessment/sessions/:sessionId/report` | report | _shell.html (page=report) | ✅ |

正则：`^\/assessment\/sessions\/([^/]+)(?:\/(.*)|\/?)?$` —— 支持任意 UUID sessionId 与 itemId。

## 五、待修复页面（按优先级）

### 教师（teacher）
- [x] assessments/tasks：54个交互元素（LIVE_API=0, LIVE_LOCAL=28, LIVE_ROUTE=17, UNSUPPORTED=9, BROKEN=0）
- [x] assessments/create：40个交互元素（LIVE_API=1, LIVE_LOCAL=31, LIVE_ROUTE=5, UNSUPPORTED=3, BROKEN=0）
- [x] assessments/detail：49个交互元素（LIVE_API=1, LIVE_LOCAL=24, LIVE_ROUTE=9, UNSUPPORTED=15, BROKEN=0）
- [x] assignments：36个交互元素（LIVE_API=4, LIVE_LOCAL=14, LIVE_ROUTE=4, UNSUPPORTED=14, BROKEN=0）
- [x] classes：42个交互元素（LIVE_API=0, LIVE_LOCAL=18, LIVE_ROUTE=6, UNSUPPORTED=18, BROKEN=0）
- [x] classes/detail：34个交互元素（LIVE_API=0, LIVE_LOCAL=15, LIVE_ROUTE=4, UNSUPPORTED=15, BROKEN=0）
- [x] students/demo：48个交互元素（LIVE_API=0, LIVE_LOCAL=14, LIVE_ROUTE=6, UNSUPPORTED=28, BROKEN=0）
- [x] students/detail：48个交互元素（LIVE_API=0, LIVE_LOCAL=14, LIVE_ROUTE=6, UNSUPPORTED=28, BROKEN=0）
- [x] reviews/submission-1：25个交互元素（LIVE_API=2, LIVE_LOCAL=18, LIVE_ROUTE=2, UNSUPPORTED=3, BROKEN=0）
- [x] courses/spring/studio：52个交互元素（LIVE_API=2, LIVE_LOCAL=29, LIVE_ROUTE=3, UNSUPPORTED=18, BROKEN=0）
- [x] ai-tools：56个交互元素（LIVE_API=3, LIVE_LOCAL=16, LIVE_ROUTE=3, UNSUPPORTED=34, BROKEN=0）
- [x] translation：48个交互元素（LIVE_API=0, LIVE_LOCAL=16, LIVE_ROUTE=2, UNSUPPORTED=30, BROKEN=0）

### 学生（student）
- [ ] student/today：今日学习（LIVE_API：getTodayAgenda）
- [ ] student/courses：课程列表（LIVE_API：listCourses）
- [ ] student/learn/spring-2：课程播放器（LIVE_API：getLesson + trackProgress）
- [ ] student/growth：成长报告（LIVE_API：getGrowthReport）
- [ ] student/profile：个人资料（LIVE_API：getProfile + updateProfile）
- [ ] student-integration 子页面（assignments/community/course-center/exercises/offline/recommendations）

### 志愿者（volunteer）
- [ ] volunteer/recruitment：招募（LIVE_API：listRecruitments + apply）
- [ ] volunteer/training：培训（LIVE_API：listTraining + submitCompletion）
- [ ] volunteer/training-completion：培训完成凭证（LIVE_API：getCompletion）
- [ ] volunteer/pairings：结对帮扶（LIVE_API：listPairings）
- [ ] volunteer/service-tasks：服务任务（LIVE_API：listServiceTasks）
- [ ] volunteer/assessment：志愿者测评（LIVE_API）
- [ ] volunteer/emergency-report：风险上报（LIVE_API：createEmergencyReport）
- [ ] volunteer/one-to-one-support：一对一支持（LIVE_API）

### 管理端（admin）
- [ ] admin/schools：学校管理（LIVE_API：listSchools + createSchool）
- [ ] admin/users-roles：用户与角色（LIVE_API：listUsers + assignRole）
- [ ] admin/curriculum：课程审核（LIVE_API：listCurriculum + approve）
- [ ] admin/assessment-content：测评内容（LIVE_API：listQuestionBank + approve）
- [ ] admin/assessment-links：测评关联（LIVE_API：linkQuestionToAssessment）
- [ ] admin/content-review：内容审核（LIVE_API：listPendingContent + approve/reject）
- [ ] admin/privacy：隐私设置（LIVE_API：getPrivacySettings + update）
- [ ] admin/product-plans：套餐管理（LIVE_API：listPlans + createPlan）
- [ ] admin/system-providers：系统提供商（LIVE_API：listProviders + configure）
- [ ] admin/school-operation：学校运营（LIVE_API：getSchoolMetrics）

## 六、后端修复记录

| 修复 | 文件 | 描述 | 状态 |
|---|---|---|---|
| 简单录音 completeRecording 条件 | recordings.service.ts:245 | `partCount === 1 && uploadedParts.includes(0)` → `partCount === 1`；简单上传不经过 uploadPart，uploadedParts 为空 | ✅ |
| server.mjs 未重启 | 运行时 | 服务器启动于 0:27 但代码修改于 18:09，运行旧版无动态路由；重启后修复 | ✅ |

## 七、完成标准（夜间）

- [x] 删除全部硬编码业务 ID（SZ20250530-PT-0032 等 6 个）
- [x] server.mjs 支持动态 sessionId/itemId 路由
- [x] 正式模式默认 demoMode=false，仅 ?demo=1 启用
- [x] 真实 getUserMedia + MediaRecorder + Blob 录音
- [x] 真实 XMLHttpRequest.upload.onprogress 上传进度
- [x] 真实预签名 PUT 上传到 MinIO
- [x] Recording 真实持久化（initSimpleRecording → completeSimpleRecording）
- [x] AssessmentItem 真实绑定（attachAssessmentRecording）
- [x] SpeechJob 真实查询与轮询
- [x] 真实书面题保存与定稿（saveWrittenAnswer + finalizeWrittenAnswer）
- [x] 真实提交（submitAssessmentSession）
- [x] 真实报告查询与复测（getAssessmentReport + scheduleRetest）
- [x] 失败时不显示假成功
- [x] 测试 session 创建（admin.test 创建，sessionId=c9b5b37b-728d-4631-a695-c56238a114d9，type=MIXED）
- [x] AssessmentItems 数据库直插（1 READING + 1 WRITTEN，绕过 Question 缺失）
  - READING item id: 73baa9e0-b373-4011-8ffe-6c6fb87431bf
  - WRITTEN item id: 7e29a5d6-71a3-4e73-bcc9-9cf93d06af57
- [x] API 后端路由验证（/api/v1/schools/:schoolId/assessments/sessions/:sessionId 全部就绪）
- [x] Playwright 验证：录音测评完整链路（✅ 全部页面渲染正确，API 调用成功）
- [x] 验证 Network 真实出现以下请求：
  - `GET /api/v1/schools/:id/assessments/sessions`
  - `POST /api/v1/schools/:id/assessments/device-check`
  - `POST /api/v1/schools/:id/recordings/simple`
  - `PUT <presigned-url>` (MinIO)
  - `POST /api/v1/schools/:id/recordings/:id/complete`
  - `POST /api/v1/schools/:id/assessments/sessions/:sid/reading/:itemId/recording`
  - `POST /api/v1/schools/:id/assessments/sessions/:sid/items/:itemId/answer`
  - `POST /api/v1/schools/:id/assessments/sessions/:sid/answer/finalize`
  - `POST /api/v1/schools/:id/assessments/sessions/:sid/submit`
  - `GET /api/v1/schools/:id/speech-jobs/:jobId`（轮询）
  - `GET /api/v1/schools/:id/speech-jobs/by-item?assessmentItemId