# MVP 缺口清单

> 范围：`d:\program\test_program\yuzanxinsheng\three\yuzan-next\web-runtime`
> 后端：`d:\program\test_program\yuzanxinsheng\three\yuzan-next\apps\api`
> 更新日期：2026-07-22（加入藏中翻译语料系统缺口）

## 说明

本清单列出当前前端页面已经对接或需要对接、但后端尚未完整实现（或仅为占位实现）的能力。已完成后端功能不在此重复。

## P0 核心流程状态

| 页面/功能 | 状态 | 说明 |
|---|---|---|
| 登录 /login | 已对接 | `POST /api/v1/auth/login` 可用 |
| 选校 /select-school | 已对接 | `POST /api/v1/auth/select-school`、`GET /api/v1/me` 可用 |
| 教师教学任务 /teacher/assignments | 已对接 | 班级、课程版本、作业列表、创建作业 |
| 教师提交复核 /teacher/reviews/:id | 已对接 | 提交列表、反馈创建 |
| 教师课程工作室 /teacher/courses/spring/studio | 已对接 | 课程版本详情、章节结构、发布 |
| 学生今日学习 /student/today | 已对接 | 学习任务列表 |
| 学生成长报告 /student/growth | 已对接 | 提交状态、任务信息、最新评语已接入并通过冒烟测试；趋势图、音频证据待聚合接口增强 |
| B31-101 班级/入学/课程/作业/提交/反馈 | 已对接 | Prisma 真实持久化 |

## 联调冒烟测试结论

2026-07-17 完成前后端联调冒烟测试，**全部通过**：

- 教师账号 `teacher.test` 登录、选校、`/teacher/assignments`、`/teacher/courses/spring/studio` 均正常加载数据。
- 学生账号 `student.test` 登录、`/student/today`、`/student/growth` 均正常加载数据。
- 测试过程中未发现 401/404/500 阻断错误，未发现 JS 致命错误。

当前 P0 核心流程已全面对接并可正常运行。

## P1 高优先级缺口

### 1. 录音/媒体证据服务（阻塞学习、测评、复核、成长报告）

- **影响页面**：`/student/learn/spring-2`、`/assessment/reading/2`、`/teacher/reviews/:id`、`/student/growth`
- **需要接口**：
  - `POST /api/v1/schools/:schoolId/recordings/init`
  - `PUT /api/v1/schools/:schoolId/recordings/:id/chunks/:part`
  - `POST /api/v1/schools/:schoolId/recordings/:id/complete`
  - `GET /api/v1/schools/:schoolId/recordings/:id/status`
  - `GET /api/v1/schools/:schoolId/recordings/:id/evidence`
  - `POST /api/v1/schools/:schoolId/submissions/:submissionId/upload-urls`
- **当前状态**：未实现。学生录音仅保存在浏览器本地，无法上传到后端，教师复核和成长报告无法获取真实语音证据。
- **建议**：优先实现上传预签名 URL 或分片上传，让录音能关联到 Submission。

### 2. 测评模块（Assessment）

- **影响页面**：`/assessment/*`
- **需要接口**：
  - `GET /api/v1/schools/:schoolId/assessments/status`
  - `GET /api/v1/schools/:schoolId/assessments/:sessionId/reading/:itemId`
  - `POST /api/v1/schools/:schoolId/assessments/:sessionId/reading`
  - `GET /api/v1/schools/:schoolId/assessments/:sessionId/report`
  - `GET /api/v1/schools/:schoolId/assessments/history`
- **当前状态**：`mvp-gaps/assessment-stub.controller.ts` 占位，所有端点返回 `PERSISTENCE_PENDING`。
- **建议**：测评依赖录音服务，可在录音服务完成后实现。

### 3. 学生端聚合接口

- **影响页面**：`/student/courses`、`/student/growth`、`/student/profile`
- **需要接口**：
  - `GET /api/v1/schools/:schoolId/student/courses-dashboard`
  - `GET /api/v1/schools/:schoolId/student-growth/:enrollmentId`
  - `GET /api/v1/schools/:schoolId/student/profile`
- **当前状态**：未实现。成长报告当前通过 `submissions/me` + `learning/tasks` + `feedback` 拼接，数据不完整。
- **建议**：实现学生课程中心聚合和成长报告聚合接口。

### 4. 教师工作台聚合

- **影响页面**：`/teacher`（教师首页）
- **需要接口**：`GET /api/v1/schools/:schoolId/teacher/dashboard`
- **当前状态**：未实现，页面为硬编码。
- **建议**：聚合待复核提交、待发布课程、任务截止、需关注学生等数据。

### 5. 课程提交审核端点

- **影响页面**：`/teacher/courses/spring/studio`
- **需要接口**：`POST /api/v1/schools/:schoolId/course-versions/:courseVersionId/submit-review`
- **当前状态**：后端 service 已实现 `submitForReview`，但 Controller 未暴露端点。页面「提交审核」按钮当前调用 `publish` 作为过渡。
- **建议**：在 Controller 暴露 `submit-review` 端点，前端可切换。

## P2 中优先级缺口

### 6. 管理驾驶舱 /admin

- **需要接口**：`GET /api/v1/admin/dashboard`
- **当前状态**：未实现，页面所有指标硬编码。

### 7. 志愿者工作台 /volunteer

- **需要接口**：`GET /api/v1/schools/:schoolId/volunteer/dashboard`
- **当前状态**：志愿者模块有基础 CRUD，但页面为硬编码。

### 8. 教师 AI 工具 /teacher-tools

- **需要接口**：`GET /api/v1/schools/:schoolId/teacher-tools/state`
- **当前状态**：`tools` 模块占位实现，端点抛异常。

### 9. 产品套餐 /plans

- **需要接口**：`GET /api/v1/plans`
- **当前状态**：模块返回空数组。

### 10. 教研中心 /research

- **需要接口**：`GET /api/v1/schools/:schoolId/research/dashboard`
- **当前状态**：模块占位实现，端点返回 `PERSISTENCE_PENDING`。

## P0-TIBETAN 藏中翻译语料系统缺口

> 任务编号：P0-TIBETAN-CHINESE-TRANSLATION-CORPUS-001
> 选定模型：tencent/Hunyuan-MT-7B（INT4量化，Tencent Hunyuan Community License 免费商用，4785MB VRAM，18s加载，100/100测试通过）
> 淘汰模型：google/madlad400-3b-mt（输出损坏）、facebook/nllb-200（CC-BY-NC不可商用）、Helsinki-NLP/opus-mt（不存在）

### 已确认的12项问题（均未修复，禁止报告为已完成）

| # | 问题 | 严重性 | 说明 |
|---|---|---|---|
| 1 | teacher/translation/script.js 已损坏 | 阻塞 | 仅剩2行不完整代码 |
| 2 | 教师翻译页是静态页面 | 阻塞 | 无真实翻译交互 |
| 3 | TranslationsModule绑定UnavailableTranslationRepository | 阻塞 | 所有翻译操作返回不可用 |
| 4 | Prisma无TranslationJob/GlossaryEntry/翻译记忆模型 | 阻塞 | 无数据持久化 |
| 5 | 无翻译Worker和真实Provider调用 | 阻塞 | 无实际翻译执行能力 |
| 6 | encryptText是Base64占位 | 安全 | 非加密，需AES-GCM |
| 7 | checkRateLimit是空实现 | 安全 | 无真实限流 |
| 8 | listMyJobs未按createdByUserId过滤 | 安全 | 用户隔离缺失 |
| 9 | api-client无translations方法 | 阻塞 | 前端无法调用翻译API |
| 10 | 学生端、志愿者端无翻译入口 | 缺失 | 无页面和导航入口 |
| 11 | Nuxt翻译路由标记TRUTHFUL_GAP | 缺失 | apps-web端路由未实现 |
| 12 | 管理端Provider状态为静态展示 | 缺失 | 无真实健康检查 |

### 需要实现的API端点

- `POST /schools/:schoolId/translations/jobs` — 创建翻译任务
- `GET /schools/:schoolId/translations/jobs/me` — 当前用户历史
- `GET /schools/:schoolId/translations/jobs/:jobId` — 任务详情
- `POST /schools/:schoolId/translations/jobs/:jobId/corrections` — 提交纠正
- `GET /schools/:schoolId/translations/glossary` — 术语表
- `GET /schools/:schoolId/translations/memory/search` — 翻译记忆搜索
- `POST /schools/:schoolId/translations/glossary/proposals` — 教师术语提案
- `POST /schools/:schoolId/translations/corpus/submissions` — 教师语料提交
- `GET/POST/PATCH /schools/:schoolId/language-resources/glossary` — 管理端术语
- `GET/POST/PATCH /schools/:schoolId/language-resources/memory` — 管理端翻译记忆
- `GET/POST /schools/:schoolId/language-resources/corpus/imports` — 管理端语料导入
- `POST /schools/:schoolId/language-resources/reviews/:id/approve` — 审核通过
- `POST /schools/:schoolId/language-resources/reviews/:id/reject` — 审核拒绝
- `POST /admin/translation-providers/:id/health-check` — Provider健康检查

### 需要实现的页面

| 端 | 路由 | 状态 | 关键能力 |
|---|---|---|---|
| 学生 | /student/translation | 不存在 | 双向翻译、教学短语、术语、历史、收藏、纠错、免责声明 |
| 教师 | /teacher/translation | 损坏 | 双向翻译、重新翻译、词典、历史、修改、提交术语/语料 |
| 志愿者 | /volunteer/translation | 不存在 | 翻译、纠正提交 |
| 管理端 | /admin/language-resources | 不存在 | Provider状态、语料来源/许可证、术语版本、审核队列、模型评测、导入导出 |

### 安全修复清单

- AES-GCM加密替代Base64（密钥不得写入DB或Git）
- Redis真实限流替代空实现
- listMyJobs按createdByUserId过滤
- Provider错误脱敏
- 学校隔离（所有翻译API需schoolId）
- 角色权限（STUDENT/TEACHER/VOLUNTEER/SCHOOL_ADMIN/PLATFORM_ADMIN）
- 内容长度限制
- 日志不得记录原文
- 学生内容不得自动用于训练

### 模型部署资源

- 模型：tencent/Hunyuan-MT-7B
- 量化：INT4（BitsAndBytesConfig load_in_4bit=True）
- VRAM：4785MB allocated / 6382MB reserved（RTX 4070 12GB）
- 加载时间：18秒
- 平均延迟：3050ms（100样本，10类别）
- Python服务：services/translation-engine/（独立进程，负责模型加载、藏文预处理、翻译执行、health接口）

## 建议实施顺序

1. **录音/媒体证据服务 + 提交上传凭证**：解锁学习、测评、复核、成长报告的真实闭环。
2. **测评会话、题目下发、报告生成**：补齐 `/assessment/*` 流程。
3. **学生课程中心聚合 + 成长报告聚合**：补齐学生端首页和报告页。
4. **教师工作台聚合 + 课程提交审核**：补齐教师首页和课程工作室审核流程。
5. **管理驾驶舱、志愿者工作台、教师工具、产品套餐、教研中心**：按优先级逐步补齐。