# 语赞心声 — 未开发后端功能需求清单（详细版）

> 分析范围：`d:\program\test_program\yuzanxinsheng\three\yuzan-next\web-runtime` 下已存在的页面
> 后端对照：`d:\program\test_program\yuzanxinsheng\three\yuzan-next\apps\api\src`
> 更新日期：2026-07-18
> 分析方法：逐页面 HTML/JS 源码审查，精确记录每个交互元素的触发行为与数据依赖

## 说明

本清单基于**页面源码逐行分析**，精确记录每个交互元素（按钮、表单、切换器）的触发响应机制、所需后端数据、数据流转路径与权限控制要求。

**已完成后端功能（不在本清单重复列出）**：

- 认证与会话：`/api/v1/auth/login`、`/api/v1/auth/refresh`、`/api/v1/auth/logout`、`/api/v1/auth/select-school`、`/api/v1/me`
- 学校与成员：`School`、`Membership`
- 班级与入学：`Class`、`Enrollment`（CRUD、成员管理）
- 课程版本草稿：`CourseVersion`（列表、创建、查询、更新、发布）
- 作业：`Assignment`（CRUD、open/close/cancel）
- 学习任务与进度：`/schools/:schoolId/learning/tasks`、活动进度读写
- 提交与反馈：`Submission` 创建/提交/查询、`Feedback` 创建/列表/待复核
- 录音模块 Controller/Service：`/schools/:schoolId/recordings`（init/complete/status/evidence）——Controller 已创建，但 Service 层部分方法仍为占位
- 学生仪表板 Controller/Service：`/schools/:schoolId/student/courses-dashboard`、`today`、`profile`、`teacher-advice`、`recommendations`——Controller 已创建
- 志愿者、培训、帮扶结对、报告、离线包等模块已有真实 Prisma 持久化实现

---

## 一、学生端页面

### 1.1 /student/courses（课程中心）

**页面用途**：学生查看所有已分配课程、学习进度统计、按状态筛选课程，点击课程卡片进入学习播放器。

**当前前端实现状态**：
- JS 文件 `courses.js` 调用 `YuzanApi.getStudentCoursesDashboard()` 获取课程数据
- 如果 dashboard API 返回空，回退到 `/schools/:schoolId/learning/tasks`
- 课程卡片渲染：标题、进度条（progress/completionRate）、状态标签、年级/学科元数据
- 筛选按钮组：全部 / 进行中 / 已完成 / 未开始
- 统计卡片：全部课程数 / 进行中数 / 已完成数
- 课程卡片点击跳转至 `/student/learn/spring-2?assignmentId=xxx` 或 `/student/today`

| 交互元素 | 触发行为 | 需要的后端数据 | 数据来源 | 数据去向 | 权限与隔离 |
|---|---|---|---|---|---|
| 筛选按钮组（`.filter-btn[data-filter]`） | 前端根据 status 字段过滤课程列表并重新渲染 | 课程列表中每条记录需包含 `status` 字段（NOT_STARTED/IN_PROGRESS/COMPLETED/ACTIVE） | `Enrollment` 关联的 `CourseVersion` + `Assignment` 状态 | 无写入 | 仅返回当前学生在当前学校的 enrollment 关联课程 |
| 统计卡片（`#statTotal` / `#statActive` / `#statDone`） | 前端根据返回的课程列表计算各状态数量 | 同上课程列表数据 | 同上 | 无写入 | 同上 |
| 课程卡片（`.course-card`） | 点击跳转到学习播放器，URL 带 `assignmentId` 参数 | 每门课程需返回 `assignmentId`（关联的 Assignment 记录 ID），用于跳转到对应学习任务 | `Assignment` 表，关联 `Enrollment` | 跳转参数 | 学生仅能访问自己 enrollment 关联的 assignment |
| 页面初始化 | 调用 `getStudentCoursesDashboard()` 加载课程数据 | 返回结构：`{ courses: [{ id, title, courseTitle, gradeBand, subject, progress/completionRate, status/enrollmentStatus, assignmentId }] }` 或直接数组 | `Enrollment` → `CourseVersion` → `Assignment` → `ActivityProgress` 聚合 | 无写入 | 按 `userId` + `schoolId` 过滤 |

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 课程中心聚合视图 | 聚合学生在当前学校的所有 enrollment 关联课程，返回标题、进度、状态、assignmentId | `Enrollment`、`CourseVersion`、`Assignment`、`ActivityProgress` | `GET /api/v1/schools/:schoolId/student/courses-dashboard` | **数据来源**：`Enrollment`（学生注册记录）→ JOIN `CourseVersion`（课程内容）→ LEFT JOIN `Assignment`（教师布置的任务）→ LEFT JOIN `ActivityProgress`（学习进度）。**数据去向**：仅供学生端展示。**权限**：WHERE enrollment.userId = 当前用户 AND enrollment.schoolId = 当前学校。**进度计算**：从 ActivityProgress 聚合 completionRate，若无进度记录则返回 0。**状态映射**：Assignment.status (OPEN→IN_PROGRESS, CLOSED→COMPLETED) 或 Enrollment.status |
| AI 课程推荐 | 根据测评结果和学习历史生成个性化推荐课程，需解释推荐理由 | `RecommendationRule`、`AssessmentResult`、`LearningHistory`、`CourseVersion` | `GET /api/v1/schools/:schoolId/student/recommendations` | **数据来源**：`AssessmentResult`（学生测评得分，按维度拆分）+ `ActivityProgress`（学习历史）。**数据去向**：推荐结果返回给学生端展示。**权限**：仅当前学生可见。**推荐逻辑**：根据薄弱维度（发音准确/朗读流利/句子节奏/表达完整）匹配 CourseVersion 标签。**推荐理由**：每个推荐需附带 reason 字段。**隐私**：未成年人数据不可用于非学习目的 |

---

### 1.2 /student/today（今日学习）

**页面用途**：展示学生当天需优先完成的学习任务，提供范读音频播放、离线资源缓存状态、网络同步状态。

**当前前端实现状态**：
- JS 文件 `today.js` 调用 `YuzanApi.getStudentToday()` 获取今日任务
- 如果 today API 失败，回退到 `/schools/:schoolId/learning/tasks`
- 日期显示：本地 `new Date()` 生成
- 范读播放按钮（`#previewAudio`）：点击切换播放/暂停状态，当前仅为 UI 切换，无真实音频源
- 离线资源缓存按钮（`.resource-item`）：点击切换缓存状态，当前仅操作 DOM，无真实缓存管理
- 网络状态按钮（`#networkStatus`）：点击显示在线/离线提示
- 进入朗读任务按钮（`.enter`）：根据 API 返回的 `assignmentId` 跳转到 `/student/learn/spring-2`

| 交互元素 | 触发行为 | 需要的后端数据 | 数据来源 | 数据去向 | 权限与隔离 |
|---|---|---|---|---|---|
| 范读播放按钮（`#previewAudio`） | 切换播放/暂停图标，toast 提示 | 需要范读音频 URL（`CourseResource` 的音频资源地址） | `CourseResource` 关联 `CourseVersion` | 无写入 | 学生可访问已分配课程的资源 |
| 离线资源缓存按钮（`.resource-item`） | 切换缓存状态（cached/not-cached），更新缓存状态文字 | 需要资源大小信息、离线包下载 URL | `OfflineContentPackage` | 需记录缓存偏好到用户设置 | 学生仅可缓存已授权课程的资源 |
| 进入朗读任务按钮（`.enter`） | 跳转到 `/student/learn/spring-2?assignmentId=xxx` | 今日任务的 `assignmentId` 和 `title` | `Assignment` + `LearningActivity` | 跳转参数 | 学生仅能访问自己的任务 |
| 网络状态按钮（`#networkStatus`） | 显示在线/离线提示，基于 `navigator.onLine` | 无需后端数据，但同步状态需后端确认 | `SyncBatch`（如果有未同步的操作） | 无写入 | 按用户维度 |

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 今日学习任务 | 返回当天截止或需要优先完成的学习任务列表、范读资源、缓存状态 | `TodayTask`、`Assignment`、`CourseResource`、`ActivityProgress` | `GET /api/v1/schools/:schoolId/student/today` | **数据来源**：`Assignment`（WHERE dueAt 在今天 AND status = 'OPEN' AND targets 包含该学生）→ JOIN `CourseVersion`（课程标题）→ LEFT JOIN `CourseResource`（范读音频 URL）→ LEFT JOIN `ActivityProgress`（当前进度）。**数据去向**：学生端今日学习页。**权限**：WHERE assignment 的 targets 包含该学生的 enrollment。**排序**：按 dueAt 升序。**离线场景**：返回该学生已缓存的 OfflineContentPackage 清单 |
| 范读音频 URL | 返回课程关联的范读音频播放地址 | `CourseResource`、`MediaAsset` | `GET /api/v1/schools/:schoolId/course-versions/:courseVersionId/resources?type=audio` | **数据来源**：`CourseResource`（WHERE type = 'DEMO_AUDIO' AND courseVersionId = xxx）→ JOIN `MediaAsset`（获取 CDN URL）。**数据去向**：学生端音频播放器。**权限**：学生可访问已分配课程的资源。**时效**：URL 需有时效性（预签名 URL 15 分钟有效） |

---

### 1.3 /student/learn/spring-2（学习播放器 / 录音页）

**页面用途**：学生完成朗读录音任务的核心页面。包含课文内容展示、录音器、同步状态指示器、"完成并继续"按钮。

**当前前端实现状态**：
- JS 文件 `player.js` 实现了完整的录音上传流程：
  1. `YuzanApi.initRecording(enrollmentId, 1, { submissionId, mimeType, idempotencyKey })` → 初始化录音
  2. 如果 init 返回 `uploadUrls`，直接使用；否则调用 `YuzanApi.getRecordingPartUploadUrl(recordingId, 1)` 获取上传 URL
  3. `fetch(uploadUrl, { method: 'PUT', body: recorder.blob })` → 上传音频数据
  4. `YuzanApi.completeRecording(recordingId, { durationMs })` → 完成录音
- 录音上传失败时回退到本地保存（`recorder.setSync('local')`），触发 `recorder:sync` 事件
- "完成并继续"按钮（`#desktopComplete`）：
  - 录音中 → 完成当前录音并自动上传
  - 已录音/播放中 → 上传录音后跳转到 `/student/growth`
- 同步状态指示器（`.sync-state`）：监听 `recorder:sync` 事件显示"已安全同步"/"正在同步…"/"已保存在本机"

| 交互元素 | 触发行为 | 需要的后端数据 | 数据来源 | 数据去向 | 权限与隔离 |
|---|---|---|---|---|---|
| 录音器（`#studentRecorderDesktop`） | 录制音频，触发 `recorder:state`/`recorder:complete`/`recorder:reset` 事件 | 需要 enrollmentId（从 URL 或 localStorage 获取） | `Enrollment` | `Recording` 记录（关联到 Submission） | 录音必须关联到当前学生的 enrollment |
| "完成并继续"按钮（`#desktopComplete`） | 根据录音状态：完成录音→上传→跳转成长报告 | 需要 `assignmentId`（从 URL query 获取） | `Assignment` | `Submission` 状态更新 + `Recording` 创建 | 仅学生本人可操作 |
| 同步状态指示器（`.sync-state`） | 监听录音同步事件，显示同步状态 | 需要录音上传结果确认 | `Recording` 状态 | 无写入 | 按用户维度 |
| 录音上传流程（`uploadRecordingToBackend`） | init → upload → complete 三步上传 | 初始化需返回 recordingId + uploadUrl(s) | `Recording`、`RecordingChunk` | `Recording` 状态变为 COMPLETED | 上传 URL 需有时效性；幂等键防重复 |

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 录音初始化 | 创建 Recording 记录，返回 recordingId 和分片上传 URL | `Recording`、`RecordingChunk` | `POST /api/v1/schools/:schoolId/recordings` | **数据来源**：请求体包含 enrollmentId、partCount、submissionId（可选）、mimeType、idempotencyKey。**数据去向**：创建 `Recording` 记录（status=INITIALIZED, userId=当前用户, schoolId=当前学校）+ 生成预签名上传 URL。**幂等**：若 idempotencyKey 已存在，返回已有 Recording 而非重复创建。**权限**：仅 enrollment 的拥有者可创建录音 |
| 录音分片上传 URL | 为指定分片生成预签名上传地址 | `RecordingChunk` | `POST /api/v1/schools/:schoolId/recordings/:recordingId/parts/:partNumber/upload-url` | **数据来源**：`Recording`（WHERE id=recordingId AND userId=当前用户）。**数据去向**：返回 S3/存储服务的预签名 PUT URL。**权限**：仅 Recording 的创建者可获取上传 URL。**时效**：URL 15 分钟有效 |
| 录音完成 | 标记录音为已完成，关联到 Submission | `Recording`、`Submission` | `POST /api/v1/schools/:schoolId/recordings/:recordingId/complete` | **数据来源**：请求体可包含 durationMs、objectKey。**数据去向**：更新 Recording.status=COMPLETED, completedAt=now()。若关联 submissionId，更新 Submission 状态为 SUBMITTED。**权限**：仅 Recording 的创建者。**触发**：完成后自动通知教师端有待复核的提交（通过 Notification） |
| 录音状态查询 | 查询录音处理状态 | `Recording` | `GET /api/v1/schools/:schoolId/recordings/:recordingId` | **数据来源**：`Recording` 记录。**权限**：仅创建者或该学生的教师可查询 |
| 录音回放证据 | 获取录音的播放 URL（供成长报告和教师复核使用） | `Recording`、`MediaAsset` | `GET /api/v1/schools/:schoolId/recordings/:recordingId/evidence` | **数据来源**：Recording → MediaAsset（获取 CDN URL）。**数据去向**：返回音频播放 URL + 元数据（时长、创建时间、关联的 assessment/submission）。**权限**：学生本人 + 该学生的任课教师。**数据流转**：此接口同时服务学生端成长报告和教师端复核页面 |
| 提交上传凭证修复 | 为 Submission 生成文件上传预签名 URL（当前抛"尚未实现"） | `Submission`、`MediaAsset` | `POST /api/v1/schools/:schoolId/submissions/:submissionId/upload-urls` | **数据来源**：`Submission`（WHERE id=submissionId AND userId=当前用户）。**数据去向**：返回预签名 URL 数组。**权限**：仅 Submission 的提交者。**时效**：URL 15 分钟有效 |
| 我的提交列表修复 | 当前 `GET /submissions/me` 硬编码空数组，需根据当前用户 enrollment 查询 | `Submission`、`Enrollment` | `GET /api/v1/schools/:schoolId/submissions/me` | **数据来源**：`Enrollment`（WHERE userId=当前用户 AND schoolId=当前学校）→ JOIN `Submission`。**数据去向**：返回该学生在本校的所有提交。**权限**：WHERE enrollment.userId = 当前用户 |

---

### 1.4 /student/growth（成长报告）

**页面用途**：展示学生的学习成长路径、各阶段完成状态、教师评语、朗读作品证据、下一阶段学习计划，支持学生/教师视角切换和报告导出。

**当前前端实现状态**：
- JS 文件 `growth.js` 并行调用三个 API：
  1. `YuzanApi.request('/schools/:schoolId/submissions/me')` → 提交列表
  2. `YuzanApi.request('/schools/:schoolId/learning/tasks')` → 学习任务
  3. `YuzanApi.getStudentTeacherAdvice({ limit: 5 })` → 教师建议
- 根据提交列表更新 5 阶段成长路径（课程→任务→朗读作品→教师反馈→复测）
- 加载最新提交的反馈：`/schools/:schoolId/submissions/:id/feedback`
- 学生/教师视角切换按钮：切换 `introEl` 和 `commentEl` 的文案（当前使用硬编码文案）
- 阶段聚焦：点击阶段卡片高亮
- 下一阶段计划：点击加入/移出学习计划（仅前端操作，无持久化）
- 导出报告按钮（`#exportGrowth`）：生成 JSON 文件下载（当前为纯前端实现，无 PDF 生成能力）

| 交互元素 | 触发行为 | 需要的后端数据 | 数据来源 | 数据去向 | 权限与隔离 |
|---|---|---|---|---|---|
| 学生/教师视角切换按钮（`.switch button`） | 切换 intro 和 comment 文案，设置 `data-view` 属性 | 学生视角和教师视角应展示不同文案，当前硬编码 | `GrowthReport`（学生摘要 vs 教师摘要） | 无写入 | 教师视角仅该学生的任课教师可切换 |
| 阶段卡片（`.stage`） | 点击高亮，toast 提示 | 每个阶段的完成状态和进度点 | `Submission` 状态流转（NOT_STARTED→IN_PROGRESS→SUBMITTED→NEEDS_REVIEW→REVIEWED→COMPLETED） | 无写入 | 按学生 enrollment 隔离 |
| 下一阶段计划项（`.next>div`） | 点击加入/移出学习计划，toggle `.planned` 类 | 需要后端存储学习计划偏好 | `LearningPlan`（新实体） | `POST` 保存学习计划选择 | 按学生维度 |
| 导出报告按钮（`#exportGrowth`） | 生成 JSON 下载（当前为纯前端），应有 PDF 导出能力 | 需要完整的成长报告数据 | `GrowthReport` 聚合 | `POST` 触发 PDF 生成 | 导出需记录审计日志 |

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 成长报告数据 | 返回成长路径（5 阶段状态）、朗读作品证据、教师评语、趋势数据、下一阶段计划 | `GrowthReport`、`Submission`、`Feedback`、`Recording`、`ActivityProgress`、`LearningPlan` | `GET /api/v1/schools/:schoolId/student-growth/:enrollmentId` | **数据来源**：`Enrollment`（确认学生身份）→ `Submission`（所有提交及状态）→ `Feedback`（教师评语）→ `Recording`（录音证据 URL）→ `ActivityProgress`（趋势数据）。**数据去向**：学生端成长报告页 + 教师端班级详情页。**权限**：学生仅看自己的报告；教师可看本班学生的报告（viewMinorData 控制敏感字段）。**5 阶段映射**：课程学习（ActivityProgress 聚合）→ 课后练习（Submission 状态）→ 朗读作品（Recording 存在性）→ 教师反馈（Feedback 存在性）→ 复测（下次 AssessmentSession 存在性）。**数据流转**：此接口数据同时被学生端和教师端消费 |
| 报告导出 | 生成 PDF 格式的成长报告 | `GrowthReport`、`PrivacyExport`、`AuditLog` | `POST /api/v1/schools/:schoolId/student-growth/:enrollmentId/export` | **数据来源**：GrowthReport 聚合数据。**数据去向**：生成 PDF 文件 + 创建 `PrivacyExport` 审计记录 + 创建 `AuditLog`。**权限**：学生导出自己的报告需确认用途；教师导出学生报告需双人复核。**审计**：记录导出者、导出时间、用途说明、数据范围 |
| 学习计划保存 | 保存学生选择的下一阶段学习计划 | `LearningPlan`（新实体） | `POST /api/v1/schools/:schoolId/student-growth/:enrollmentId/learning-plan`<br>`GET /api/v1/schools/:schoolId/student-growth/:enrollmentId/learning-plan` | **数据来源**：请求体包含选中的计划项 ID 列表。**数据去向**：`LearningPlan` 表（enrollmentId, planItems, createdAt）。**权限**：仅学生本人可修改自己的计划 |

---

### 1.5 /student/profile（个人中心）

**页面用途**：展示学生个人档案信息、学习统计数据、离线资源列表。

**当前前端实现状态**：
- 导航栏 `student-nav.js` 已实现动态加载用户信息（通过 `getStoredUser()` 和 `getStudentProfile()`）
- 头像、姓名、学校、年级、学习统计均为硬编码或来自 localStorage

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 学生个人档案 | 返回头像、姓名、学校、年级、学习统计、离线资源列表 | `User`、`Membership`、`Enrollment`、`ActivityProgress`、`OfflineContentPackage` | `GET /api/v1/schools/:schoolId/student/profile` | **数据来源**：`User`（基本信息）→ `Membership`（学校/角色）→ `Enrollment`（班级/年级）→ `ActivityProgress`（聚合：总学习天数、总课程数、总录音数）→ `OfflineContentPackage`（已下载的离线包列表）。**数据去向**：学生端个人中心页。**权限**：仅本人可见。**统计计算**：学习天数 = COUNT(DISTINCT DATE(createdAt)) FROM ActivityProgress WHERE userId=当前用户；总课程数 = COUNT(*) FROM Enrollment WHERE status='ACTIVE' |

---

## 二、教师端页面

### 2.1 /teacher（教师工作台首页）

**页面用途**：教师的工作驾驶舱，展示今日待办、待发布课程、即将截止任务、待复核朗读、需关注学生、班级成长路径、薄弱发音聚类等。

**当前前端实现状态**：
- 前端已通过 `api-client.js` 定义了 `getDashboard()`、`getAtRiskStudents()`、`getPronunciationClusters()` 方法
- 页面数据全部硬编码，API 方法已定义但后端返回 PERSISTENCE_PENDING 或空数据

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 教师工作台聚合数据 | 返回问候信息、今日优先级、工作轨道计数、待发布课程、即将截止任务、待复核朗读、需关注学生、班级成长路径、薄弱发音聚类 | `TeacherDashboard`、`Assignment`、`Submission`、`Feedback`、`Class`、`CourseVersion`、`StudentRisk`、`PronunciationCluster` | `GET /api/v1/schools/:schoolId/teacher/dashboard` | **数据来源**：`Membership`（教师所属班级）→ `Assignment`（WHERE createdById=当前教师 AND status IN ('DRAFT','OPEN')）→ `Submission`（待复核数量）→ `Class`（班级列表及各班进度）→ `StudentRisk`（AI 识别的风险学生）。**数据去向**：教师端首页。**权限**：WHERE class.teacherId = 当前用户 OR assignment.createdById = 当前用户。**聚合**：待复核数量 = COUNT(Submission WHERE status='NEEDS_REVIEW' AND class.teacherId=当前教师)；即将截止 = Assignment WHERE dueAt < now()+3天 AND status='OPEN' |
| 待复核列表 | 返回需要教师复核的学生提交，按提交时间排序 | `Submission`、`Feedback`、`Recording` | `GET /api/v1/schools/:schoolId/feedback/pending` | **数据来源**：`Submission`（WHERE status='SUBMITTED' OR status='NEEDS_REVIEW'）→ JOIN `Enrollment`（获取学生信息）→ LEFT JOIN `Recording`（获取录音证据 URL）。**数据去向**：教师端复核页面。**权限**：仅返回本班学生提交（通过 Enrollment → Class → teacherId 过滤）。**数据流转**：此数据来源于学生端录音上传完成后的 Submission 状态更新 |
| 风险学生识别 | 基于学习/测评数据识别需要关注的学生 | `StudentRisk`、`AssessmentResult`、`ActivityProgress` | `GET /api/v1/schools/:schoolId/teacher/students/at-risk` | **数据来源**：`ActivityProgress`（连续 7 天未学习）+ `AssessmentResult`（得分低于 60）+ `Submission`（超期未提交）。**数据去向**：教师端首页"需关注学生"区域。**权限**：仅本班学生，且需脱敏处理（不暴露原始分数排名）。**数据流转**：数据来源于学生端的学习活动记录和测评结果 |
| 薄弱发音聚类 | 对班级学生发音问题进行聚类统计 | `PronunciationCluster`、`AssessmentResult`、`Feedback` | `GET /api/v1/schools/:schoolId/teacher/class/pronunciation-clusters` | **数据来源**：`AssessmentResult`（按维度拆分：发音准确/朗读流利/句子节奏/表达完整）+ `Feedback`（教师标注的发音问题标签）。**数据去向**：教师端首页 + 班级详情页"高频发音问题"区域。**权限**：聚合数据需脱敏，不暴露具体学生姓名，仅显示"涉及 N 人"。**数据流转**：数据来源于学生端测评结果和教师反馈标注 |
| 通知中心 | 返回任务截止、复核提醒、系统通知 | `Notification` | `GET /api/v1/schools/:schoolId/notifications` | **数据来源**：`Notification`（WHERE recipientId=当前用户 AND readAt IS NULL）。**数据去向**：教师端通知面板。**权限**：仅返回接收者可见通知。**触发**：学生提交录音后自动生成"待复核"通知 |

---

### 2.2 /teacher/classes（我的班级）

**页面用途**：教师查看所有管理的班级，以地图视图或列表视图展示班级卡片（包含年级、学生人数、学习进度、覆盖率、阶段状态），支持年级筛选、创建班级、导入学生。

**当前前端实现状态**：
- JS 文件 `app.js` 实现了地图/列表视图切换、模态框交互
- **所有班级数据均为 HTML 硬编码**，未调用任何后端 API
- 班级卡片数据：班级名称、年级、学生人数、任课教师、学习进度百分比、覆盖率百分比
- 右侧边栏：教学日历、今日安排、待处理事项（18 待批改/3 待发布测评/5 学情预警/7 学生提问）、快捷操作（发布任务/发布测评/学情分析/资源中心）
- 按钮："创建班级"和"导入学生"均为前端演示

| 交互元素 | 触发行为 | 需要的后端数据 | 数据来源 | 数据去向 | 权限与隔离 |
|---|---|---|---|---|---|
| 地图/列表视图切换（`data-view`） | 切换班级展示方式 | 班级列表数据（两种视图使用相同数据源） | `Class` + `Enrollment` + `ActivityProgress` | 无写入 | 仅返回当前教师管理的班级 |
| 年级筛选（`#gradeFilter`） | 前端根据 grade 属性过滤班级卡片 | 班级列表需包含 `grade` 字段 | `Class.grade` | 无写入 | 同上 |
| 班级卡片（`.class-card`） | 点击"进入班级"按钮跳转到班级详情页 | 班级 ID、学习进度、覆盖率、阶段状态 | `Class` → `ActivityProgress`（聚合进度）→ `Enrollment`（学生人数） | 跳转参数 `classId` | 仅本班教师可进入 |
| "创建班级"按钮（`data-action="create"`） | 打开模态框创建新班级 | 需要调用班级创建 API | 无 | `POST /schools/:schoolId/classes` | 仅 SCHOOL_ADMIN / TEACHER 角色 |
| "导入学生"按钮（`data-action="import"`） | 打开模态框导入学生名单 | 需要学生导入 API | 无 | `POST /schools/:schoolId/classes/:classId/students/import` | 仅本班教师/SCHOOL_ADMIN |
| 待处理事项按钮 | 点击跳转到对应功能页面 | 待批改数、待发布测评数、学情预警数、学生提问数 | `Submission`、`AssessmentSession`、`StudentRisk`、`Question` | 无写入 | 按教师维度统计 |
| 快捷操作按钮 | 发布任务/发布测评/学情分析/资源中心 | 需要对应的创建/查询接口 | `Assignment`、`AssessmentSession` | 对应的 POST 创建接口 | 仅本班教师 |
| 教学日历 | 展示当月课程安排 | 课程时间表数据 | `ClassSchedule` 或 `Assignment`（startsAt/dueAt） | 无写入 | 仅本班数据 |
| 今日安排 | 展示今日课程安排 | 当天的教学安排 | `Assignment`（WHERE startsAt 在今天） | 无写入 | 按教师维度 |

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 教师班级列表 | 返回当前教师管理的所有班级及聚合统计数据 | `Class`、`Enrollment`、`ActivityProgress`、`Assignment` | `GET /api/v1/schools/:schoolId/classes/teachers/me` | **数据来源**：`Class`（WHERE teacherId=当前用户 OR coTeacherIds 包含当前用户）→ LEFT JOIN `Enrollment`（学生人数 COUNT）→ LEFT JOIN `ActivityProgress`（学习进度 AVG）→ LEFT JOIN `Assignment`（覆盖率计算）。**数据去向**：教师端班级列表页。**权限**：WHERE class.teacherId = 当前用户 OR class.coTeacherIds @> [当前用户ID]。**覆盖率**：有进度记录的学生数 / 总学生数。**阶段状态**：根据班级中 Assignment 的完成率计算（课程→任务→测评→复盘） |
| 班级待处理统计 | 为班级列表右侧"待处理事项"提供真实计数 | `Submission`、`AssessmentSession`、`StudentRisk` | `GET /api/v1/schools/:schoolId/teacher/pending-stats` | **数据来源**：`Submission`（待复核数）+ `AssessmentSession`（待发布测评数）+ `StudentRisk`（学情预警数）。**数据去向**：班级列表页右侧边栏。**权限**：按教师所属班级范围统计 |
| 导入学生 | 批量导入学生名单到指定班级 | `User`、`Enrollment` | `POST /api/v1/schools/:schoolId/classes/:classId/students/import` | **数据来源**：上传的 CSV/Excel 文件解析出学生信息。**数据去向**：创建 `User`（如果不存在）+ `Enrollment` 记录。**权限**：仅本班教师/SCHOOL_ADMIN。**去重**：已存在的学生跳过而非报错 |

---

### 2.3 /teacher/classes/detail（班级详情页）

**页面用途**：展示单个班级的详细信息，包括当前课程进度、班级成长路径（4 阶段）、学习阶段分布、高频发音/书写问题 TOP5、教师行动面板、班级学情概要。

**当前前端实现状态**：
- JS 文件 `app.js` 实现了以下交互：
  - 日期范围选择器（`#dateRangeBtn`）：打开日期选择弹窗，应用后 toast 提示
  - 教师行动按钮组（`data-action`）：export/settings/course/analysis/practice/assessment/group/volunteer/report，每个按钮打开 Drawer 展示说明
  - 高频问题 Tab 切换（`data-tab`）：发音问题/书写问题，前端硬编码数据
  - 阶段卡片点击：高亮选中
  - 导出报表按钮（`data-action="export"`）：打开 Drawer
  - 班级设置按钮（`data-action="settings"`）：打开 Drawer
- **所有数据均为 HTML 硬编码**，未调用任何后端 API

| 交互元素 | 触发行为 | 需要的后端数据 | 数据来源 | 数据去向 | 权限与隔离 |
|---|---|---|---|---|---|
| 日期范围选择器（`#dateRangeBtn`） | 选择日期范围后更新页面数据 | 按日期范围过滤的学情数据 | `ActivityProgress`、`Submission`、`AssessmentResult`（WHERE createdAt 在范围内） | 无写入 | 仅本班教师 |
| "导出报表"按钮（`data-action="export"`） | 导出班级学情报表 | 聚合的班级学情数据 | `ActivityProgress` + `Submission` + `AssessmentResult` | 生成 Excel/PDF + 审计日志 | 需记录审计；自动隐藏未授权字段 |
| "班级设置"按钮（`data-action="settings"`） | 管理班级基本信息、教师、学生可见范围 | `Class` 详细信息 | `Class` | `PATCH /schools/:schoolId/classes/:classId` | 仅本班教师/SCHOOL_ADMIN |
| "布置补充练习"按钮（`data-action="practice"`） | 根据高频问题为学生生成补充练习 | 高频问题列表 + 学生列表 | `PronunciationCluster` → `Assignment` 创建 | `POST /schools/:schoolId/assignments` | 仅本班教师；练习推送至学生端 |
| "发起阶段测评"按钮（`data-action="assessment"`） | 创建本阶段测评任务 | 测评模板 + 学生列表 | `AssessmentSession` 创建 | `POST /schools/:schoolId/assessments` | 仅本班教师；测评推送至学生端 |
| "创建小组任务"按钮（`data-action="group"`） | 按学习阶段/问题类型分组 | 学生阶段分布数据 | `ActivityProgress` → `Assignment`（type=GROUP） | `POST /schools/:schoolId/assignments` | 仅本班教师；不公开学生排名 |
| "联系志愿者"按钮（`data-action="volunteer"`） | 向授权志愿者发起辅导协作请求 | 志愿者列表 + 协作请求 | `VolunteerProfile` → `VolunteerIncident` | `POST /schools/:schoolId/volunteer/incidents` | 仅共享必要信息；viewMinorData 控制 |
| "查看班级学情报告"按钮（`data-action="report"`） | 查看班级整体趋势 | 班级学情聚合数据 | `GrowthReport`（班级级别） | 无写入 | 仅本班教师 |
| 高频问题 Tab 切换（`data-tab`） | 切换发音/书写问题视图 | 按类型分类的问题聚类数据 | `PronunciationCluster`、`WritingIssueCluster` | 无写入 | 聚合数据脱敏 |
| 阶段卡片（`.stage-card`） | 点击高亮选中 | 每个阶段的完成率/参与率/平均得分 | `ActivityProgress`、`Submission`、`AssessmentResult` | 无写入 | 按班级聚合 |
| 学习阶段分布饼图 | 展示优秀/良好/合格/待提升的学生人数分布 | 按分数段统计的学生人数 | `AssessmentResult`（按分数段 COUNT） | 无写入 | 按班级聚合，不暴露个人 |

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 班级详情聚合 | 返回班级基本信息、当前课程进度、4 阶段成长路径、学习阶段分布、高频问题 TOP5 | `Class`、`Enrollment`、`CourseVersion`、`ActivityProgress`、`Submission`、`AssessmentResult`、`PronunciationCluster` | `GET /api/v1/schools/:schoolId/classes/:classId/detail` | **数据来源**：`Class`（基本信息）→ `Enrollment`（学生人数）→ `CourseVersion`（当前课程，关联 Assignment）→ `ActivityProgress`（阶段 1 课程学习进度）→ `Submission`（阶段 2 课后练习完成率）→ `AssessmentResult`（阶段 3 测评参与率、阶段 4 复习巩固率、学习阶段分布）→ `PronunciationCluster`（高频问题）。**数据去向**：教师端班级详情页。**权限**：WHERE class.teacherId = 当前用户。**4 阶段映射**：课程学习(AVG ActivityProgress.completionRate)、课后练习(COUNT Submission WHERE status='COMPLETED'/total)、阶段测评(COUNT AssessmentResult/total)、复习巩固(复测完成率)。**数据流转**：数据来源于学生端所有学习活动 |
| 班级学情导出 | 导出班级学情报表（Excel/PDF） | `Class`、`ActivityProgress`、`Submission`、`AssessmentResult`、`AuditLog` | `POST /api/v1/schools/:schoolId/classes/:classId/export` | **数据来源**：班级详情聚合数据。**数据去向**：生成文件 + 创建 AuditLog 记录。**权限**：仅本班教师。**审计**：记录导出者、时间、数据范围 |
| 布置补充练习 | 根据高频问题为相关学生创建补充练习任务 | `Assignment`、`PronunciationCluster`、`Enrollment` | `POST /api/v1/schools/:schoolId/classes/:classId/supplementary-practice` | **数据来源**：`PronunciationCluster`（高频问题列表）→ 创建 `Assignment`（type=SUPPLEMENTARY, targets=受影响学生）。**数据去向**：学生端今日学习页 / 课程中心页。**权限**：仅本班教师。**数据流转**：教师端创建 → 学生端可见 |
| 发起阶段测评 | 创建本阶段测评任务并分配给学生 | `AssessmentSession`、`Enrollment` | `POST /api/v1/schools/:schoolId/classes/:classId/assessment` | **数据来源**：`Enrollment`（全班学生列表）→ 创建 `AssessmentSession`（per student）。**数据去向**：学生端测评入口页。**权限**：仅本班教师。**数据流转**：教师端创建 → 学生端可见 → 学生完成 → 教师端可见报告 |

---

### 2.4 /teacher/courses/spring/studio（课程工作室）

**页面用途**：教师编辑课程内容的专用页面，包含课程结构树、3 个 Tab 编辑器（学习目标/教学支持/离线资源）、活动属性面板、课程预览、提交审核功能。

**当前前端实现状态**：
- JS 文件 `studio.js` 实现了：
  - 课程结构树渲染：从 `GET /schools/:schoolId/course-versions/:id` 加载 courseVersion 及其 units/lessons/activities
  - 3 Tab 编辑器：学习目标（contenteditable 编辑）、教学支持（范读音频/停顿标记/提问建议/差异化支持）、离线资源（课文文本/范读音频/学习提示）
  - 保存快捷键（Ctrl+S）：`PATCH /schools/:schoolId/course-versions/:id` 保存草稿
  - 提交审核按钮（`.submit`）：调用 `YuzanApi.submitForReview(courseVersionId, updatedAt)`
  - 课程预览按钮（`.preview`）：打开 dialog 展示学生端预览
  - 重命名按钮（`.edit`）：修改课程名称
  - 添加活动按钮（`.add`）：在树中添加新活动节点
  - beforeunload 守护：有未保存修改时提醒

| 交互元素 | 触发行为 | 需要的后端数据 | 数据来源 | 数据去向 | 权限与隔离 |
|---|---|---|---|---|---|
| 课程结构树节点 | 点击选中，渲染编辑器 | 完整的 courseVersion 结构（units → lessons → activities） | `CourseVersion` JSON（包含嵌套的 units/lessons/activities） | 无写入 | 仅课程创建者/本班教师 |
| 学习目标编辑器（Tab 0） | contenteditable 编辑核心问题、关键内容 | 活动的 instruction、title | `CourseVersion.units[].lessons[].activities[]` | `PATCH /schools/:schoolId/course-versions/:id` | 仅草稿状态可编辑 |
| 教学支持面板（Tab 1） | 范读音频/停顿标记/提问建议/差异化支持 | `CourseResource`（范读音频 URL、提示卡片） | `CourseResource` + `MediaAsset` | 无写入（当前仅展示） | 课程资源按学校隔离 |
| 离线资源面板（Tab 2） | 展示离线包资源及下载状态 | `OfflineContentPackage` 及其资源列表 | `OfflineContentPackage` + `CourseResource` | 无写入 | 离线包随课程发布自动下发 |
| Ctrl+S 保存 | 保存课程草稿修改 | expectedUpdatedAt（乐观锁） | `CourseVersion` | `PATCH /schools/:schoolId/course-versions/:id` | 仅草稿状态可保存 |
| 提交审核按钮（`.submit`） | 调用 submitForReview API | courseVersionId、expectedUpdatedAt | `CourseVersion` | `POST submit-review` → CourseVersion.status 变为 IN_REVIEW | 仅 DRAFT/CHANGES_REQUESTED 可提交 |
| 课程预览按钮（`.preview`） | 打开学生端预览 dialog | 课程内容 | `CourseVersion` | 无写入 | 仅教师可预览 |
| 添加活动按钮（`.add`） | 在树中添加新活动节点 | 需要 courseVersionId | `CourseVersion` | `PATCH` 更新 courseVersion 的 activities 数组 | 仅草稿状态 |
| 重命名按钮（`.edit`） | 修改课程名称 | 新标题 | `CourseVersion.title` | `PATCH` 更新 title | 仅草稿状态 |

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 课程版本提交审核 | 将课程版本从 DRAFT/CHANGES_REQUESTED 提交为 IN_REVIEW | `CourseVersion`、`CourseReviewRequest` | `POST /api/v1/schools/:schoolId/course-versions/:courseVersionId/submit-review` | **数据来源**：`CourseVersion`（WHERE id=courseVersionId AND status IN ('DRAFT','CHANGES_REQUESTED')）。**数据去向**：更新 CourseVersion.status=IN_REVIEW + 创建 CourseReviewRequest 记录 + 通知管理员审核。**权限**：仅课程创建者或本班教师。**乐观锁**：expectedUpdatedAt 不匹配则拒绝。**数据流转**：教师提交 → 管理端可见审核队列 |
| 课程资源管理 | 为课程版本关联范读音频、课件、文本、学习提示等资源 | `CourseResource`、`MediaAsset`、`CourseVersion` | `POST /api/v1/schools/:schoolId/course-versions/:courseVersionId/resources`<br>`GET /api/v1/schools/:schoolId/course-versions/:courseVersionId/resources` | **数据来源**：请求体包含 resourceId、purpose（DEMO_AUDIO/COURSEWARE/TEXT/LEARNING_TIP）、meta。**数据去向**：创建 `CourseResource` 记录（关联 CourseVersion 和 MediaAsset）。**权限**：仅课程创建者。**数据流转**：教师上传资源 → 学生端学习播放器/今日学习页消费 |
| 离线资源包关联 | 将课程与离线内容包关联 | `OfflineContentPackage`、`CourseVersion` | `POST /api/v1/schools/:schoolId/course-versions/:courseVersionId/offline-packages` | **数据来源**：请求体包含 offlinePackageId。**数据去向**：创建 CourseVersion-OfflineContentPackage 关联。**权限**：仅课程创建者。**数据流转**：课程发布时自动下发给学生端 |

---

### 2.5 /teacher/assignments（教学任务）

**页面用途**：教师管理教学任务，包括查看任务列表、按状态/班级筛选、新建任务、展开任务详情、查看学生提交。

**当前前端实现状态**：
- JS 文件 `app.js` 实现了完整的任务管理流程：
  - 加载班级列表：`GET /schools/:schoolId/classes/teachers/me`
  - 加载课程版本：`GET /schools/:schoolId/course-versions?limit=100`
  - 加载任务列表：`GET /schools/:schoolId/assignments?limit=100`
  - 新建任务对话框：标题、班级选择、课程版本选择、截止日期
  - 提交创建：`POST /schools/:schoolId/assignments`
  - 行展开详情：布置时间、截止时间、状态、操作
  - 筛选按钮：按状态/班级/时间循环切换
  - 关注事项卡片：前端硬编码

| 交互元素 | 触发行为 | 需要的后端数据 | 数据来源 | 数据去向 | 权限与隔离 |
|---|---|---|---|---|---|
| "新建任务"按钮（`.new`） | 打开创建任务对话框 | 班级列表 + 课程版本列表 | `Class` + `CourseVersion` | `POST /schools/:schoolId/assignments` | 仅教师可创建 |
| 任务表单提交 | 创建新任务 | title, classId, courseVersionId, deadline | `Assignment` 创建 | 学生端今日学习/课程中心可见 | 任务创建后自动推送给目标班级学生 |
| 行展开详情 | 展示任务详细信息和操作 | 任务详情（startsAt, dueAt, status） | `Assignment` 详情 | 无写入 | 仅任务创建者可见 |
| "查看提交"按钮（`data-nav`） | 跳转到复核页面 | 需要该任务的学生提交列表 | `Submission`（WHERE assignmentId=xxx） | 跳转参数 | 仅本班教师 |
| 筛选按钮 | 前端过滤任务列表 | 任务列表需包含 status 和 classId | `Assignment` | 无写入 | 按教师维度 |
| 关注事项卡片 | 点击高亮 | 需要真实的学情预警数据 | `StudentRisk` + `Submission`（超期未提交） | 无写入 | 按班级脱敏 |

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 任务创建后通知 | 任务创建后自动通知目标班级学生 | `Notification`、`Assignment` | （内部触发，无独立端点） | **数据来源**：Assignment 创建事件。**数据去向**：为每个目标学生创建 `Notification`（type=ASSIGNMENT_CREATED）。**权限**：系统自动创建。**数据流转**：教师创建任务 → 学生端收到通知 → 学生端今日学习/课程中心更新 |
| 任务提交统计 | 返回每个任务的提交人数/总人数 | `Submission`、`Enrollment` | `GET /api/v1/schools/:schoolId/assignments/:assignmentId/stats` | **数据来源**：`Submission`（WHERE assignmentId=xxx）COUNT → `Enrollment`（WHERE classId=assignment.targets.classId）COUNT。**数据去向**：教师端任务列表"已提交"列。**权限**：仅本班教师 |

---

### 2.6 /teacher/ai-tools（教师 AI 工具中心）

**页面用途**：教师使用 AI 辅助备课，包括生成备课路径、工作流地图、教学资源库、外部服务管理、邀请码等。

**当前前端实现状态**：
- JS 文件 `app.js` 实现了：
  - 备课目标输入（`#goalInput`）+ 课程选择（`#courseSelect`）+ 生成按钮（`#generatePath`）
  - 生成备课路径：调用 `YuzanApi.generatePlan(goal, courseVersionId, gradeBand)`
  - 如果返回 `PROVIDER_NOT_CONFIGURED`，显示默认路径并提示
  - 工具状态初始化：调用 `YuzanApi.getTeacherToolsState()` 获取邀请码、外部服务状态
  - 复制邀请码：优先从 API 获取 `YuzanApi.getInviteCode()`，失败则使用页面值
  - 推荐路径/自定义路径切换
  - 多个工具按钮（data-action）：打开 modal 展示说明

| 交互元素 | 触发行为 | 需要的后端数据 | 数据来源 | 数据去向 | 权限与隔离 |
|---|---|---|---|---|---|
| "生成备课路径"按钮（`#generatePath`） | 调用 generatePlan API，展示返回的路径阶段 | AI 生成的备课路径（阶段列表、工具推荐） | `TeachingPlan`（AI 生成） | `TeacherDraft` 保存 | AI 生成内容需教师确认 |
| 备课目标输入（`#goalInput`） | 输入教学目标文本 | 无需后端数据 | 用户输入 | 传递给 generatePlan API | 按教师维度 |
| 课程选择（`#courseSelect`） | 选择关联课程 | 课程版本列表 | `CourseVersion` | 传递给 generatePlan API | 按学校维度 |
| 复制邀请码（`data-action="copy-code"`） | 从 API 获取邀请码并复制到剪贴板 | 教师邀请码 | `InviteCode` | 无写入 | 邀请码有时效与使用次数限制 |
| 工具状态初始化 | 加载可用工具、外部服务状态、草稿 | 工具状态、外部服务配置、草稿列表 | `TeacherTool`、`ExternalServiceConfig`、`TeacherDraft` | 无写入 | 按教师维度 |
| 推荐路径/自定义路径切换 | 切换路径模式 | 无需后端数据 | 前端状态 | 可保存偏好到 `TeacherDraft` | 按教师维度 |
| 各种工具按钮（data-action） | 打开 modal 展示工具说明 | 部分工具需后端数据（如术语对照表、资源库） | `Glossary`、`ResourceLibrary` | 部分需保存（如草稿） | 按权限区分 |

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 教师工具中心状态 | 返回可用工具列表、最近使用、草稿、外部服务状态、邀请码 | `TeacherTool`、`TeacherDraft`、`ExternalServiceConfig`、`InviteCode` | `GET /api/v1/schools/:schoolId/teacher-tools/state` | **数据来源**：`TeacherTool`（系统预定义工具列表 + 用户启禁状态）→ `TeacherDraft`（最近编辑的草稿）→ `ExternalServiceConfig`（MindMate/MindGraph/翻译等服务的配置和状态）→ `InviteCode`（当前教师的邀请码）。**数据去向**：教师 AI 工具中心页。**权限**：按 useTools / configureExternal 权限区分 |
| 备课路径生成 | 根据教学目标输入生成推荐备课路径 | `TeachingPlan`、`TeacherDraft` | `POST /api/v1/schools/:schoolId/teacher-tools/generate-plan` | **数据来源**：请求体包含 goal、courseVersionId、gradeBand。**数据去向**：AI 服务生成路径 → 返回阶段列表和工具推荐 → 同时创建 TeacherDraft 草稿。**权限**：AI 生成内容需教师人工确认，不可直接用于课堂。**隐私**：学生数据不得泄露给外部 AI 服务 |
| 草稿保存 | 保存教师工具生成的备课草稿 | `TeacherDraft` | `GET /api/v1/schools/:schoolId/teacher-tools/drafts`<br>`POST /api/v1/schools/:schoolId/teacher-tools/drafts` | **数据来源**：请求体包含 toolSource（MINDMATE/MINDGRAPH/TRANSLATE/WORKSHEET）、title、content。**数据去向**：创建 `TeacherDraft` 记录（userId=当前教师, schoolId=当前学校）。**权限**：按教师隔离，仅创建者可访问。**版本历史**：每次保存创建新版本，不覆盖旧版本 |
| 外部服务配置 | 返回外部服务状态与配置 | `ExternalServiceConfig` | `GET /api/v1/schools/:schoolId/external-services` | **数据来源**：`ExternalServiceConfig`（服务名称、启用状态、API 端点、健康状态）。**数据去向**：教师 AI 工具中心"管理外部服务"面板。**权限**：敏感密钥仅保存在服务端，不返回给前端 |
| 邀请码 | 生成/查询教师邀请码 | `InviteCode` | `GET /api/v1/schools/:schoolId/teacher-tools/invite-code` | **数据来源**：`InviteCode`（WHERE createdById=当前教师 AND expiresAt > now() AND usageCount < maxUsage）。**数据去向**：教师 AI 工具中心页。**权限**：有时效（30 天）与使用次数限制（10 次） |

---

## 三、智能测评页面

### 3.1 /assessment（测评入口）

**页面用途**：学生选择开始朗读测评或书面练习，检查麦克风设备，查看历史测评记录。

**当前前端实现状态**：
- JS 文件 `assessment.js` 实现了：
  - "开始朗读测评"按钮（`#startReading`）：根据 YuzanDemo 中存储的 readingStatus 显示"开始/继续/重新进行"，跳转到 `/assessment/reading/2`
  - "开始书面练习"按钮（`#startWritten`）：根据已保存答案数量显示进度，跳转到 `/assessment/written`
  - "设备检查"按钮（`#deviceCheck`）：调用 `navigator.mediaDevices.getUserMedia` 检查麦克风权限
  - 历史记录播放按钮（`.history .play`）：跳转到 `/assessment/history`
  - 历史记录事件点击：切换 active 状态

| 交互元素 | 触发行为 | 需要的后端数据 | 数据来源 | 数据去向 | 权限与隔离 |
|---|---|---|---|---|---|
| "开始朗读测评"按钮 | 跳转到朗读测评页，按钮文案根据测评状态变化 | 当前未完成的测评会话状态（NOT_STARTED/IN_PROGRESS/COMPLETED） | `AssessmentSession` | 跳转参数 sessionId | 仅学生自己的测评会话 |
| "开始书面练习"按钮 | 跳转到书面练习页，按钮文案根据已答题数变化 | 当前书面测评的答题进度 | `WrittenAnswer`（COUNT 已保存的答案） | 跳转参数 sessionId | 仅学生自己的测评会话 |
| "设备检查"按钮 | 检查麦克风权限 | 无需后端数据（纯前端操作） | 浏览器 API | 可选记录到 `DeviceCheckLog` | 按学生维度 |
| 历史记录事件 | 切换显示不同历史测评记录 | 历史测评列表（日期、类型、分数） | `AssessmentSession` + `AssessmentReport` | 无写入 | 仅学生自己的历史记录 |

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 测评会话状态 | 返回当前未完成的朗读/书面测评会话、历史记录 | `AssessmentSession`、`AssessmentHistory` | `GET /api/v1/schools/:schoolId/assessments/status`<br>`GET /api/v1/schools/:schoolId/assessments/history` | **数据来源**：`AssessmentSession`（WHERE userId=当前用户 AND schoolId=当前学校 AND status IN ('CREATED','IN_PROGRESS')）。**数据去向**：学生端测评入口页（按钮文案和跳转目标）。**权限**：按学生维度隔离。**断点续做**：返回未完成会话的 sessionId + 当前进度（已朗读/已答题数）。**数据流转**：教师端"发起阶段测评"创建会话 → 学生端看到待完成测评 → 学生完成 → 教师端看到报告 |
| 设备检查记录 | 记录麦克风等设备检查结果 | `DeviceCheckLog` | `POST /api/v1/schools/:schoolId/assessments/device-check` | **数据来源**：请求体包含 deviceType=microphone、result=PASS/FAIL/UNAVAILABLE、browserInfo。**数据去向**：创建 `DeviceCheckLog` 记录（仅记录，不阻塞测评入口）。**权限**：仅学生本人 |

### 3.2 /assessment/reading/2（朗读测评）

**页面用途**：学生完成朗读测评，包括阅读课文、录音、提交。

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 朗读题目下发 | 按测评会话返回朗读文本、段落、示范音频 | `AssessmentItem`、`ReadingPassage`、`CourseResource` | `GET /api/v1/schools/:schoolId/assessments/:sessionId/reading/:itemId` | **数据来源**：`AssessmentSession` → `AssessmentItem`（WHERE sessionId=xxx AND type='READING'）→ `ReadingPassage`（课文内容）→ `CourseResource`（示范音频 URL）。**数据去向**：学生端朗读测评页。**权限**：仅该会话的学生可见。**数据流转**：教师端创建测评时选择题目 → 学生端获取题目 → 学生录音提交 → 教师端获取报告 |
| 朗读录音提交 | 录音上传、关联到测评会话、更新朗读状态 | `Recording`、`AssessmentSession`、`AssessmentResponse` | 复用录音服务接口 + `PATCH /api/v1/schools/:schoolId/assessments/:sessionId/reading` | **数据来源**：`Recording`（已上传的录音 ID）→ 更新 `AssessmentResponse`（sessionId, itemId, recordingId, status=SUBMITTED）。**数据去向**：更新测评会话状态。**权限**：仅该会话的学生。**重录**：覆盖旧版本 Recording，保留版本号 |

### 3.3 /assessment/written（书面练习）

**页面用途**：学生完成书面练习，包括答题、自动保存、提交。

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 书面题目下发 | 返回书面练习题目、选项、顺序 | `WrittenQuestion`、`AssessmentItem` | `GET /api/v1/schools/:schoolId/assessments/:sessionId/written` | **数据来源**：`AssessmentItem`（WHERE sessionId=xxx AND type='WRITTEN'）→ `WrittenQuestion`（题目文本、选项、正确答案不返回）。**数据去向**：学生端书面练习页。**权限**：仅该会话的学生 |
| 答案自动保存 | 保存每道题答案草稿 | `WrittenAnswer` | `POST /api/v1/schools/:schoolId/assessments/:sessionId/written/answers` | **数据来源**：请求体包含 itemId、answer（文本或选项 ID）。**数据去向**：UPSERT `WrittenAnswer`（sessionId, itemId, userId, answer, updatedAt=now()）。**权限**：仅保存当前学生。**防抖**：前端 2 秒防抖后调用。**幂等**：同 itemId 的答案覆盖更新 |
| 书面测评提交 | 提交书面答案、生成测评报告 | `AssessmentSession`、`WrittenAnswer`、`AssessmentReport` | `POST /api/v1/schools/:schoolId/assessments/:sessionId/submit` | **数据来源**：`WrittenAnswer`（WHERE sessionId=xxx）→ 自动评分 → 生成 `AssessmentReport`。**数据去向**：更新 AssessmentSession.status=COMPLETED + 创建 AssessmentReport。**权限**：仅该会话的学生。**不可逆**：提交后不可修改。**关联**：需与朗读录音关联到同一次会话。**数据流转**：学生提交 → 自动评分 → 教师端可见报告 |

### 3.4 /assessment/report/demo（测评报告）

**页面用途**：展示测评结果，包括四维分数、练习建议、语音证据、教师反馈、复测日期。

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 测评报告生成 | 返回测评结果摘要、四维分数、练习建议、语音证据、教师反馈、复测日期 | `AssessmentReport`、`ReportMetric`、`Recording`、`TeacherFeedback`、`RetestPlan` | `GET /api/v1/schools/:schoolId/assessments/:sessionId/report` | **数据来源**：`AssessmentSession` → `AssessmentReport`（四维分数：发音准确/朗读流利/句子节奏/表达完整）→ `Recording`（语音证据 URL）→ `TeacherFeedback`（教师评语，可能为空）→ `RetestPlan`（建议复测日期）。**数据去向**：学生端测评报告页 + 教师端班级详情页。**权限**：学生看自己的报告；教师看本班学生的报告。**AI 分析**：置信边界需后端返回（如"发音准确 72±8 分"）。**教师反馈**：未提交时显示占位文案 |
| 复测安排 | 根据学习进度和报告生成下一次复测建议 | `RetestPlan`、`AssessmentSession` | `POST /api/v1/schools/:schoolId/assessments/retest` | **数据来源**：`AssessmentReport`（当前得分和薄弱维度）→ 生成 `RetestPlan`（建议日期、重点维度）。**数据去向**：创建新的 `AssessmentSession`（status=CREATED）+ 通知学生和教师。**权限**：仅教师可创建。**数据流转**：教师端创建 → 学生端测评入口可见 |

### 3.5 /assessment/history（历史复测对比）

**页面用途**：学生/教师查看多次测评的历史对比、成长曲线、教师支持事件。

**后端待开发功能**：

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 历史测评对比 | 按维度/时间范围返回多次测评分数、成长曲线 | `AssessmentHistory`、`AssessmentReport` | `GET /api/v1/schools/:schoolId/assessments/history` | **数据来源**：`AssessmentSession`（WHERE userId=当前用户 AND status='COMPLETED'）→ JOIN `AssessmentReport`（四维分数）。**数据去向**：学生端历史对比页 + 教师端学情分析。**权限**：学生看自己的；教师看本班学生的。**维度**：发音准确、朗读流利、句子节奏、表达完整。**时间范围**：8 周/6 个月/全部 |
| 教师支持事件 | 返回测评过程中的教师干预、反馈事件 | `TeacherEvent`、`Feedback` | `GET /api/v1/schools/:schoolId/assessments/history/events` | **数据来源**：`Feedback`（WHERE studentId=当前用户 AND type='ASSESSMENT_INTERVENTION'）。**数据去向**：学生端历史页"教师支持"时间线。**权限**：学生看自己收到的；教师看自己发出的。**数据流转**：教师端复核时添加反馈 → 学生端历史页可见 |

---

## 四、管理端：/admin（平台管理驾驶舱）

当前 `/admin.html` 仅实现驾驶舱页面，其余左侧导航项页面尚未补充。驾驶舱本身所有数据均为硬编码。

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 平台驾驶舱聚合数据 | 返回学校地图分布、汇总指标、风险预警、待办队列、服务状态、转化漏斗、趋势图、套餐分布、公告 | `AdminDashboard`、`School`、`SummaryMetric`、`RiskAlert`、`PendingQueue`、`ServiceStatus`、`Funnel`、`Trend`、`PlanDistribution`、`Announcement` | `GET /api/v1/admin/dashboard` | **数据来源**：跨学校聚合 `School` + `Membership` + `Enrollment` + `CourseVersion` + `Assignment` + `Submission`。**数据去向**：管理端驾驶舱页。**权限**：默认只读嘉宾模式；跨学校统计受限；学生/学校敏感数据需脱敏。**用户关联**：所有数据按 admin 角色可见范围过滤，SUPER_ADMIN 看全部，SCHOOL_ADMIN 仅看本校 |
| 待办队列数据源 | 为驾驶舱"待办审批队列"提供真实待处理数量 | `CourseReviewRequest`、`ResourceListing`、`VolunteerApplication`、`PlanChangeRequest` | `GET /api/v1/admin/queue` | **数据来源**：`CourseReviewRequest`（status=PENDING）+ `VolunteerApplication`（status=PENDING）等。**数据去向**：管理端待办队列。**权限**：按角色返回可处理队列；只读模式只返回数量不返回详情 |
| 风险与预警数据源 | 为"今日风险与预警"提供真实风险事件 | `RiskEvent`、`ServiceIncident`、`PrivacyAuditReminder` | `GET /api/v1/admin/risks` | **数据来源**：`RiskEvent`（服务异常）+ `ServiceIncident`（数据不足）+ `PrivacyAuditReminder`（内容待审核）。**数据去向**：管理端风险预警面板。**权限**：风险需关联学校/服务实例；按权限范围过滤 |
| 平台服务状态 | 为"系统与服务状态"提供各微服务健康度 | `ServiceHealth`、`ServiceInstance` | `GET /api/v1/admin/services` | **数据来源**：`ServiceHealth`（最近检查时间、错误率、响应时间）。**数据去向**：管理端服务状态面板。**权限**：公开或仅管理员可见 |

---

## 五、志愿者端：/volunteer

志愿者模块（`VolunteerModule`）已实现基础 CRUD，但页面当前为硬编码，缺少工作台聚合接口和消息能力。

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 志愿者工作台聚合 | 返回服务旅程、培训进度、考核状态、今日任务、累计服务时长、教师联系人、服务资格、待学课程 | `VolunteerProfile`、`VolunteerQualification`、`Training`、`VolunteerServiceTask`、`ServiceHour`、`VolunteerIncident` | `GET /api/v1/schools/:schoolId/volunteer/dashboard` | **数据来源**：`VolunteerProfile`（基本信息和资格）→ `Training`（培训进度）→ `VolunteerServiceTask`（今日任务）→ `ServiceHour`（累计服务时长）→ `VolunteerIncident`（协作请求，来源于教师端"联系志愿者"）。**数据去向**：志愿者端工作台页。**权限**：viewMinorData=false 时限制学生敏感信息。**数据流转**：教师端"联系志愿者" → VolunteerIncident → 志愿者端可见任务 |
| 志愿者消息 | 志愿者与教师之间的站内消息收发 | `Message`、`VolunteerProfile` | `GET /api/v1/schools/:schoolId/volunteer/messages`<br>`POST /api/v1/schools/:schoolId/volunteer/messages` | **数据来源**：`Message`（WHERE senderId=当前用户 OR recipientId=当前用户）。**数据去向**：志愿者端消息页面。**权限**：消息需受未成年人保护规则约束；可审计。**数据流转**：教师 → 志愿者消息 / 志愿者 → 教师消息 |

---

## 六、产品套餐：/plans

`plans` 模块当前仅返回空数组。

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 产品套餐配置 | 返回套餐列表、服务差异对比、适用学校类型 | `Plan`、`ServiceComparison`、`SchoolType` | `GET /api/v1/plans`<br>`GET /api/v1/plans/services` | **数据来源**：`Plan`（套餐定义）→ `ServiceComparison`（服务差异矩阵）。**数据去向**：plans 页面。**权限**：公开访问。**用户关联**：无特定用户关联，但 TrialRequest 需关联到 User |
| 地区折扣 | 返回按地区/学校类型的折扣系数 | `RegionDiscount` | `GET /api/v1/plans/discount` | **数据来源**：`RegionDiscount`（地区 + 学校类型 → 折扣系数）。**数据去向**：plans 页面价格计算。**权限**：公开访问 |
| 咨询与试用申请 | 接收咨询表单和试用申请 | `Consultation`、`TrialRequest` | `POST /api/v1/plans/consultation`<br>`POST /api/v1/plans/trial` | **数据来源**：请求体包含联系方式、学校信息、需求描述。**数据去向**：创建 `Consultation` 或 `TrialRequest` 记录（关联 userId）。**权限**：试用不自动开通，需后台审批。**用户关联**：Consultation.userId / TrialRequest.userId = 当前用户 |

---

## 七、教研中心：/research

`research` 模块当前为占位实现，所有端点返回 `PERSISTENCE_PENDING`。

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 教研中心聚合数据 | 返回教研路径阶段、当前活跃课题、课程版本、资源库、数据洞察、教师反馈、待处理事项 | `ResearchTopic`、`CourseVersion`、`ResearchResource`、`TeacherFeedback`、`ResearchInsight`、`PendingTask`、`ResearchStage` | `GET /api/v1/schools/:schoolId/research/dashboard` | **数据来源**：`ResearchTopic`（活跃课题）→ `CourseVersion`（待评审版本）→ `ResearchResource`（资源库统计）→ `ResearchInsight`（数据洞察，来源于全校学情聚合）。**数据去向**：教研中心首页。**权限**：教研员/教师权限。**用户关联**：按 RESEARCHER 角色过滤可见范围 |
| 课题管理 | 创建、列表、查询教研课题 | `ResearchTopic` | `GET /api/v1/schools/:schoolId/research/topics`<br>`POST /api/v1/schools/:schoolId/research/topics` | **数据来源**：`ResearchTopic`（WHERE schoolId=当前学校）。**数据去向**：教研中心课题列表。**权限**：RESEARCHER 可创建，教师可查看。**用户关联**：ResearchTopic.createdById = 当前用户 |
| 教研资源库 | 返回教研资源列表 | `ResearchResource` | `GET /api/v1/schools/:schoolId/research/resources` | **数据来源**：`ResearchResource`（支持按 topicId/courseVersionId/type 筛选）。**数据去向**：教研中心资源库。**权限**：本校内可见 |
| 教研治理版本评审 | 对课程治理版本提交评审意见 | `GovernanceVersion`、`Review` | `GET /api/v1/schools/:schoolId/research/governance/versions`<br>`POST /api/v1/schools/:schoolId/research/governance/versions/:id/reviews` | **数据来源**：`GovernanceVersion`（待评审版本）→ `Review`（评审意见）。**数据去向**：教研中心版本评审页。**权限**：仅 RESEARCHER / SCHOOL_ADMIN 可提交评审。**用户关联**：Review.reviewerId = 当前用户 |

---

## 八、跨页面数据流转详图

以下梳理各角色之间的核心数据流转路径，每条路径均需后端接口支撑。

### 8.1 教师发布任务 → 学生接收任务

```
教师端 /teacher/assignments → POST /assignments（创建任务，targets 指向班级）
  ↓
后端创建 Assignment + 为每个目标学生创建 Notification
  ↓
学生端 /student/today → GET /student/today（返回今日截止的任务）
学生端 /student/courses → GET /student/courses-dashboard（课程列表包含 assignmentId）
```

**数据库构建需求**：
- `Assignment` 表需有 `targets` 字段（JSON 或关联表），存储目标班级/学生
- `Notification` 表需有 `recipientId`、`type`、`referenceId`（关联 Assignment.id）
- 学生端查询时 WHERE Assignment.targets 包含该学生的 enrollment

### 8.2 学生录音提交 → 教师复核

```
学生端 /student/learn/spring-2 → POST /recordings（初始化）→ PUT（上传音频）→ POST /recordings/:id/complete
  ↓
后端更新 Recording.status=COMPLETED + Submission.status=SUBMITTED + 创建 Notification（通知教师）
  ↓
教师端 /teacher → GET /feedback/pending（返回待复核提交列表）
教师端 班级详情 → GET /recordings/:id/evidence（播放学生录音）
教师端 → POST /feedback（创建教师反馈）
  ↓
学生端 /student/growth → GET /submissions/:id/feedback（获取教师评语）
```

**数据库构建需求**：
- `Recording` 表需关联 `submissionId` 和 `userId`
- `Submission` 表需有 `status` 字段（SUBMITTED → NEEDS_REVIEW → REVIEWED）
- `Feedback` 表需关联 `submissionId` 和 `teacherId`
- 权限控制：学生仅能查看自己的 Recording 和 Submission；教师仅能查看本班学生的

### 8.3 教师发起测评 → 学生完成测评 → 教师查看报告

```
教师端 班级详情 → POST /classes/:classId/assessment（创建测评会话）
  ↓
后端为每个学生创建 AssessmentSession + Notification
  ↓
学生端 /assessment → GET /assessments/status（返回待完成测评）
学生端 /assessment/reading/2 → GET /assessments/:sessionId/reading/:itemId（获取题目）
学生端 → POST /recordings（上传朗读录音）+ PATCH /assessments/:sessionId/reading
学生端 /assessment/written → GET /assessments/:sessionId/written（获取书面题目）
学生端 → POST /assessments/:sessionId/written/answers（保存答案）→ POST /assessments/:sessionId/submit（提交）
  ↓
后端自动评分 + 生成 AssessmentReport + 通知教师
  ↓
教师端 班级详情 → GET /classes/:classId/detail（包含测评参与率和平均分）
学生端 /assessment/report → GET /assessments/:sessionId/report（查看报告）
```

**数据库构建需求**：
- `AssessmentSession` 表需关联 `classId`、`studentId`(userId)、`teacherId`(createdBy)
- `AssessmentItem` 表需关联 `sessionId`，包含 `type`（READING/WRITTEN）和内容引用
- `WrittenAnswer` 表需关联 `sessionId`、`itemId`、`userId`
- `AssessmentReport` 表需关联 `sessionId`，包含四维分数（JSON 或 4 列）
- `RetestPlan` 表需关联 `sessionId` 和 `nextSessionId`

### 8.4 教师工具备课 → 课程版本更新

```
教师端 /teacher/ai-tools → POST /teacher-tools/generate-plan（生成备课路径）
教师端 → POST /teacher-tools/drafts（保存草稿）
  ↓
教师端 /teacher/courses/spring/studio → GET /course-versions/:id（加载课程内容）
教师端 → PATCH /course-versions/:id（保存修改）
教师端 → POST /course-versions/:id/submit-review（提交审核）
  ↓
管理端 → GET /admin/queue（查看待审核课程）
管理端 → PATCH /course-versions/:id/status（批准/退回）
  ↓
教师端收到通知（批准 → PUBLISHED / 退回 → CHANGES_REQUESTED）
学生端课程中心自动更新（新发布的课程出现在课程列表中）
```

**数据库构建需求**：
- `CourseVersion` 表需有 `status` 字段（DRAFT → IN_REVIEW → PUBLISHED / CHANGES_REQUESTED）
- `CourseReviewRequest` 表需关联 `courseVersionId` 和 `reviewerId`
- `TeacherDraft` 表需关联 `userId`、`toolSource`、`courseVersionId`（可选）
- 版本控制：CourseVersion.updatedAt 用于乐观锁

### 8.5 志愿者协作流程

```
教师端 班级详情 → POST /volunteer/incidents（创建协作请求）
  ↓
后端创建 VolunteerIncident + 通知志愿者
  ↓
志愿者端 /volunteer → GET /volunteer/dashboard（看到新任务）
志愿者端 → POST /volunteer/messages（回复教师）
  ↓
教师端 → GET /volunteer/messages（收到志愿者回复）
```

**数据库构建需求**：
- `VolunteerIncident` 表需关联 `teacherId`、`volunteerId`、`classId`
- `Message` 表需关联 `senderId`、`recipientId`、`incidentId`
- 隐私控制：`viewMinorData` 标志控制学生敏感信息是否可见

---

## 九、跨页面通用能力

这些能力被多个页面依赖，当前均未实现或仅为占位。

| 功能名称 | 功能描述 | 涉及数据实体 | 接口类型 | 业务规则与数据库构建需求 |
|---|---|---|---|---|
| 文件上传预签名 | 为课程资源、头像、课件等生成安全上传 URL | `MediaAsset` | `POST /api/v1/schools/:schoolId/upload/presign`<br>`GET /api/v1/schools/:schoolId/resources/:id/url` | **数据来源**：请求体包含 fileName、contentType、purpose。**数据去向**：返回预签名 URL（15 分钟有效）+ 创建 `MediaAsset` 记录。**权限**：按学校/角色授权访问；支持 CDN |
| 通知与提醒 | 任务截止、同步提醒、复测提醒、系统公告 | `Notification`、`Reminder` | `GET /api/v1/schools/:schoolId/notifications`<br>`PATCH /api/v1/schools/:schoolId/notifications/:id/read` | **数据来源**：`Notification`（WHERE recipientId=当前用户）。**数据去向**：各页面通知面板。**权限**：仅返回接收者可见。**触发**：学生提交录音、教师创建任务、测评完成等事件自动创建。**用户关联**：Notification.recipientId = User.id |
| 审计日志 | 记录教师查看、导出、录音处理等敏感操作 | `AuditLog`、`PrivacyExport` | `POST /api/v1/audit/logs`<br>`GET /api/v1/admin/audit-log` | **数据来源**：请求体包含 action、resourceType、resourceId、details。**数据去向**：创建 `AuditLog` 记录。**权限**：最小必要原则；导出需记录审批链。**用户关联**：AuditLog.actorId = 当前用户 |
| 离线同步批处理 | 弱网场景下批量同步学习记录、录音、答案 | `SyncBatch`、`OfflineOperation` | `POST /api/v1/schools/:schoolId/sync/batches`<br>`GET /api/v1/schools/:schoolId/sync/batches/:batchId` | **数据来源**：请求体包含 operations 数组（每项含 type、entityId、data、clientTimestamp）。**数据去向**：按顺序处理每个操作，创建 SyncBatch 记录。**权限**：幂等处理；冲突解决策略（server-wins 或 client-wins 按业务决定）；按设备/用户版本号合并。**用户关联**：SyncBatch.userId = 当前用户 |

---

## 十、数据库构建核心原则

基于以上分析，所有数据实体需遵循以下构建原则：

1. **用户关联**：所有业务数据表必须包含 `userId` 或通过 Enrollment/Membership 间接关联到用户，实现数据隔离与安全访问控制
2. **学校隔离**：所有学校级数据表必须包含 `schoolId`，查询时始终加入 `WHERE schoolId = :schoolId` 条件
3. **角色权限矩阵**：
   - STUDENT：仅可读写自己的数据（Recording、Submission、WrittenAnswer、AssessmentSession）
   - TEACHER：可读写本班学生的数据（通过 Class → Enrollment 关联），可创建 Assignment、AssessmentSession、Feedback
   - SCHOOL_ADMIN：本校全部数据的管理权限
   - RESEARCHER：教研相关数据的读写权限
   - VOLUNTEER：仅可访问分配给自己的协作任务，学生敏感信息受 `viewMinorData` 控制
   - SUPER_ADMIN：跨学校数据聚合，但敏感数据需脱敏
4. **数据流转审计**：所有跨角色数据访问（教师查看学生数据、导出操作）需记录 AuditLog
5. **未成年人保护**：学生录音保存期限需受控；学生数据不得泄露给未授权第三方（外部 AI 服务、志愿者需 viewMinorData 控制）
6. **乐观并发控制**：CourseVersion 等可编辑实体使用 `expectedUpdatedAt` 实现乐观锁，防止并发修改冲突

---

## 十一、总结与优先级

1. **P0 — 核心学习闭环**（直接影响学生学习和教师复核）：
   - 录音服务完善（init/upload/complete/evidence 的 Service 层实际存储实现）
   - `GET /submissions/me` 修复（当前硬编码空数组）
   - `POST /submissions/:id/upload-urls` 实现
   - 学生课程中心/今日学习/成长报告聚合接口的数据填充
   - 教师工作台聚合数据（待复核列表、风险学生、薄弱发音聚类）

2. **P1 — 测评闭环**（测评是当前最大未开发领域）：
   - 测评会话 CRUD + 题目下发
   - 朗读录音关联到测评会话
   - 书面答案自动保存 + 提交
   - 测评报告生成 + 四维分数
   - 复测安排 + 历史对比

3. **P2 — 教师工具与班级管理**：
   - 班级详情聚合数据（阶段分布、高频问题）
   - 课程资源管理 + 离线包关联
   - AI 工具中心（备课路径生成、草稿保存、外部服务配置）
   - 教师行动（布置补充练习、发起测评、联系志愿者）

4. **P3 — 运营与管理**：
   - 管理驾驶舱聚合数据
   - 审计日志
   - 离线同步批处理

5. **P4 — 扩展功能**：
   - 志愿者工作台聚合 + 消息
   - 教研中心
   - 产品套餐
   - 通知中心完善
