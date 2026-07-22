# 前端页面与后端接口绑定说明

> 范围：`d:\program\test_program\yuzanxinsheng\three\yuzan-next\frontend`
> 后端：`d:\program\test_program\yuzanxinsheng\three\yuzan-next\apps\api`
> 更新日期：2026-07-22（加入藏中翻译语料系统页面绑定）

## 冒烟测试结论

2026-07-17 联调冒烟测试 **通过**。已验证的关键路径：

- `/login` → `/select-school` → `/teacher/assignments`
- `/teacher/courses/spring/studio` 课程章节树加载
- `/student/today` 学习任务加载
- `/student/growth` 提交状态与教师评语加载

验证结果：无 401/404/500 阻断错误，无 JS 致命错误，页面数据均正常渲染。

## 1. 认证与入口

### /login
- **文件**：`login/index.html` + `login/login.js`
- **后端接口**：`POST /api/v1/auth/login`
- **绑定说明**：
  - 表单提交后调用 `YuzanApi.login(identifier, password)`。
  - 成功后将 `accessToken` 写入 `localStorage`，`activeSchoolId` 写入 `localStorage`。
  - 根据返回的 `user.memberships[0].role` 跳转到对应角色首页：教师 `/teacher`，学生 `/student/today`。

### /select-school
- **文件**：`select-school/index.html`
- **后端接口**：`POST /api/v1/auth/select-school`、`GET /api/v1/me`
- **绑定说明**：
  - 页面加载时通过 `YuzanApi.request('/me')` 获取用户成员关系，渲染学校列表。
  - 选择学校后调用 `YuzanApi.selectSchool(schoolId)`，后端更新会话中的 `activeSchoolId`。
  - 成功后再根据角色跳转。

## 2. 教师端

### /teacher（教师工作台首页）
- **文件**：`teacher.html`
- **后端接口**：`GET /api/v1/schools/:schoolId/teacher/dashboard`（PENDING）
- **绑定说明**：
  - 当前页面数据为硬编码示例。
  - 待后端实现 `teacher/dashboard` 聚合接口后，可替换为真实数据。

### /teacher/assignments（教学任务）
- **文件**：`teacher/assignments/index.html` + `teacher/assignments/app.js`
- **后端接口**：
  - `GET /api/v1/schools/:schoolId/classes/teachers/me`
  - `GET /api/v1/schools/:schoolId/course-versions?limit=100`
  - `GET /api/v1/schools/:schoolId/assignments?limit=100`
  - `POST /api/v1/schools/:schoolId/assignments`
- **绑定说明**：
  - 加载页面时并行获取班级、课程版本、作业列表。
  - 班级下拉框由 `classes/teachers/me` 动态填充。
  - 课程版本下拉框由 `course-versions` 填充，用于创建任务时关联课程版本。
  - 任务表格由 `assignments` 接口数据渲染。
  - 点击任务行展开详情，点击「查看提交」跳转到 `/teacher/reviews/:assignmentId`。

### /teacher/reviews/:assignmentId（提交复核）
- **文件**：`teacher/reviews/submission-1/index.html` + `teacher/reviews/submission-1/app.js`
- **后端接口**：
  - `GET /api/v1/schools/:schoolId/assignments/:assignmentId/submissions?limit=100`
  - `POST /api/v1/schools/:schoolId/submissions/:submissionId/feedback`
- **绑定说明**：
  - 从 URL 路径中提取 `assignmentId`。
  - 调用提交列表接口，渲染左侧学生列表。
  - 选中学生后，可在评分量表上打分并填写评语，点击保存/发布时调用反馈创建接口。

### /teacher/courses/spring/studio（课程工作室）
- **文件**：`teacher/courses/spring/studio/index.html` + `teacher/courses/spring/studio/studio.js`
- **后端接口**：
  - `GET /api/v1/schools/:schoolId/course-versions?limit=20`
  - `GET /api/v1/schools/:schoolId/course-versions/:courseVersionId`
  - `POST /api/v1/schools/:schoolId/course-versions/:courseVersionId/publish`
- **绑定说明**：
  - 若 URL 无 `courseVersionId`，则先拉取课程版本列表，取第一个 DRAFT 或任意版本。
  - 加载课程版本详情，渲染左侧章节/课时/活动树。
  - 点击活动节点，右侧编辑器显示活动标题、说明等。
  - 「提交审核」按钮当前调用 `publish` 端点作为过渡；待 `submit-review` 端点上线后可切换。

### /teacher/assessments/*（智能测评）
- **文件**：`teacher/assessments/tasks/index.html`、`teacher/assessments/create/index.html` 等
- **后端接口**：当前为本地示例数据
- **绑定说明**：
  - 教师测评模块尚未与后端对接，页面使用静态数据展示交互流程。

## 3. 学生端

### /student/today（今日学习）
- **文件**：`student/today/index.html` + `student/today/today.js`
- **后端接口**：`GET /api/v1/schools/:schoolId/learning/tasks`
- **绑定说明**：
  - 登录并选校后，拉取当前学习任务列表。
  - 取第一个任务更新课程标题、任务标题和「进入朗读任务」按钮链接。
  - 按钮跳转至 `/student/learn/spring-2?assignmentId=xxx`。

### /student/courses（学生课程中心）
- **文件**：当前与 `/student/today` 共用入口，由 `server.mjs` 将 `/student/*` 路由到 `student/today/index.html`
- **后端接口**：`GET /api/v1/schools/:schoolId/student/courses-dashboard`（PENDING）
- **绑定说明**：
  - 学生课程中心独立聚合接口尚未实现。
  - 当前通过今日学习页面展示学生入口，侧边栏「课程中心」与「我的学习」均指向该页面。

### /student/learn/spring-2（学习播放器）
- **文件**：`student/learn/spring-2/index.html` + `student/learn/spring-2/player.js`
- **后端接口**：
  - `GET /api/v1/schools/:schoolId/learning/tasks`
  - `POST /api/v1/schools/:schoolId/submissions`（创建提交）
  - `POST /api/v1/schools/:schoolId/submissions/:submissionId/upload-urls`（PENDING）
- **绑定说明**：
  - 录音功能当前仅保存到浏览器本地（IndexedDB/localStorage）。
  - 待 `upload-urls` 与录音服务实现后，可将录音文件上传到后端并关联到提交。

### /student/growth（成长报告）
- **文件**：`student/growth/index.html` + `student/growth/growth.js`
- **后端接口**：
  - `GET /api/v1/schools/:schoolId/submissions/me`
  - `GET /api/v1/schools/:schoolId/learning/tasks`
  - `GET /api/v1/schools/:schoolId/submissions/:submissionId/feedback`
- **绑定说明**：
  - 拉取学生提交列表，根据最新提交状态更新成长路径阶段点亮情况。
  - 拉取当前学习任务，更新顶部 intro 文案。
  - 尝试拉取最新提交的反馈，如有评语则替换教师评语区域。
  - 趋势图、音频证据当前为占位数据，待 `student-growth/:enrollmentId` 聚合接口实现后替换。

### /student/profile（个人中心）
- **文件**：`student/profile/index.html`
- **后端接口**：`GET /api/v1/schools/:schoolId/student/profile`（PENDING）
- **绑定说明**：
  - 当前头像、姓名、学校、年级、学习统计为硬编码。
  - 待后端实现学生档案接口后替换。

## 4. 测评页面

### /assessment（测评入口）
- **文件**：`assessment/index.html`
- **后端接口**：`GET /api/v1/schools/:schoolId/assessments/status`（NOT_CONFIGURED）
- **绑定说明**：
  - 测评模块由 `mvp-gaps/assessment-stub.controller.ts` 占位，所有端点返回 `PERSISTENCE_PENDING`。
  - 当前页面为静态流程演示。

### /assessment/reading/2（朗读测评）
- **文件**：`assessment/reading/2/index.html`
- **后端接口**：`GET /api/v1/schools/:schoolId/assessments/:sessionId/reading/:itemId`（NOT_CONFIGURED）
- **绑定说明**：
  - 朗读题目下发、录音提交均待后端实现。

### /assessment/report/demo（测评报告）
- **文件**：`assessment/report/demo/index.html`
- **后端接口**：`GET /api/v1/schools/:schoolId/assessments/:sessionId/report`（NOT_CONFIGURED）
- **绑定说明**：
  - 报告数据当前为硬编码示例。

## 5. 管理端 /admin

- **文件**：`admin.html`
- **后端接口**：`GET /api/v1/admin/dashboard`（PENDING）
- **绑定说明**：
  - 当前驾驶舱所有图表、指标、待办队列均为硬编码。
  - 待后端实现平台驾驶舱聚合接口后替换。

## 6. 志愿者端 /volunteer

- **文件**：`volunteer.html`
- **后端接口**：`GET /api/v1/schools/:schoolId/volunteer/dashboard`（PENDING）
- **绑定说明**：
  - 志愿者模块已有基础 CRUD，但页面当前为硬编码。
  - 待工作台聚合接口实现后替换。

## 7. 教师工具 /teacher-tools

- **文件**：`tools.html`
- **后端接口**：`GET /api/v1/schools/:schoolId/teacher-tools/state`（PENDING）
- **绑定说明**：
  - `tools` 模块当前为占位实现，端点抛 `ToolUnavailableException`。
  - 页面当前为静态展示。

## 8. 产品套餐 /plans

- **文件**：`plans.html`
- **后端接口**：`GET /api/v1/plans`（PENDING）
- **绑定说明**：
  - `plans` 模块当前仅返回空数组。
  - 页面当前为静态展示。

## 9. 教研中心 /research

- **文件**：`research.html`
- **后端接口**：`GET /api/v1/schools/:schoolId/research/dashboard`（NOT_CONFIGURED）
- **绑定说明**：
  - `research` 模块当前为占位实现，所有端点返回 `PERSISTENCE_PENDING`。
  - 页面当前为静态展示。

## 10. 藏中翻译语料系统

### /teacher/translation（教师翻译工作台）
- **文件**：`teacher/translation/index.html` + `teacher/translation/script.js`
- **后端接口**：
  - `POST /api/v1/schools/:schoolId/translations/jobs`（NOT_CONFIGURED）
  - `GET /api/v1/schools/:schoolId/translations/jobs/me`（NOT_CONFIGURED）
  - `GET /api/v1/schools/:schoolId/translations/glossary`（NOT_CONFIGURED）
  - `GET /api/v1/schools/:schoolId/translations/memory/search`（NOT_CONFIGURED）
  - `POST /api/v1/schools/:schoolId/translations/glossary/proposals`（NOT_CONFIGURED）
  - `POST /api/v1/schools/:schoolId/translations/corpus/submissions`（NOT_CONFIGURED）
  - `POST /api/v1/schools/:schoolId/translations/jobs/:jobId/corrections`（NOT_CONFIGURED）
- **绑定说明**：
  - 当前 `script.js` 已损坏（仅剩2行不完整代码），页面为静态展示。
  - 需恢复：中文/藏文交换、翻译、重新翻译、复制、清空、历史、词典、教师修改、提交术语、提交语料审核。
  - 不得恢复静态历史和假进度。
  - 四端共用同一 `translation-client.js`，但权限和功能不同。

### /student/translation（学生翻译助手）
- **文件**：不存在，需新建 `student/translation/index.html`
- **后端接口**：
  - `POST /api/v1/schools/:schoolId/translations/jobs`（NOT_CONFIGURED）
  - `GET /api/v1/schools/:schoolId/translations/jobs/me`（NOT_CONFIGURED）
  - `GET /api/v1/schools/:schoolId/translations/glossary`（NOT_CONFIGURED）
  - `POST /api/v1/schools/:schoolId/translations/jobs/:jobId/corrections`（NOT_CONFIGURED）
- **绑定说明**：
  - 需正式接入学生导航或"学习工具"入口，不得仅存在隐藏URL。
  - 提供：双向翻译、常用教学短语、术语解释、自己历史、收藏、复制、纠错、机器翻译免责声明。
  - 不得显示其他学生记录；不得自动把输入加入训练语料。

### /volunteer/translation（志愿者翻译）
- **文件**：不存在，需新建 `volunteer/translation/index.html`
- **后端接口**：
  - `POST /api/v1/schools/:schoolId/translations/jobs`（NOT_CONFIGURED）
  - `GET /api/v1/schools/:schoolId/translations/jobs/me`（NOT_CONFIGURED）
  - `POST /api/v1/schools/:schoolId/translations/jobs/:jobId/corrections`（NOT_CONFIGURED）
- **绑定说明**：
  - 志愿者可翻译和提交纠正，纠正进入待审核状态。
  - 需接入志愿者导航入口。

### /admin/language-resources（管理端语言资源）
- **文件**：不存在，需新建 `admin/language-resources/index.html`
- **后端接口**：
  - `GET/POST/PATCH /api/v1/schools/:schoolId/language-resources/glossary`（NOT_CONFIGURED）
  - `GET/POST/PATCH /api/v1/schools/:schoolId/language-resources/memory`（NOT_CONFIGURED）
  - `GET/POST /api/v1/schools/:schoolId/language-resources/corpus/imports`（NOT_CONFIGURED）
  - `POST /api/v1/schools/:schoolId/language-resources/reviews/:id/approve`（NOT_CONFIGURED）
  - `POST /api/v1/schools/:schoolId/language-resources/reviews/:id/reject`（NOT_CONFIGURED）
  - `POST /api/v1/admin/translation-providers/:id/health-check`（NOT_CONFIGURED）
- **绑定说明**：
  - 需提供：Provider真实状态、语料来源、许可证、词典版本、翻译记忆、审核队列、模型评测、导入导出、发布和回滚。
  - 不得在浏览器返回secretRef或密钥。
  - 所有公共语料必须记录来源和许可证。

## 11. 通用基础设施

- **API 代理**：`server.mjs` 将 `/api/*` 请求反向代理到 `http://127.0.0.1:4000`。
- **API 客户端**：`assets/api-client.js` 封装请求、token 管理、学校切换、统一错误处理。
- **状态管理**：`assets/app-core.js` 提供本地状态、网络状态、toast、数据绑定等基础能力。
- **统一导航**：
  - 教师端由 `shared/teacher-shell.js` 注入左侧统一导航。
  - 学生端由 `shared/student-nav.js` 注入顶部与侧边导航。
