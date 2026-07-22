# 志愿者端功能排查与开发规划

更新时间：2026-07-18

## 1. 盘点结论

当前志愿者端由 `frontend/volunteer.html|css|js` 工作台和 9 个嵌入式独立页面组成。视觉与路由覆盖较完整，但工作台仍以 `defaultState` 硬编码，独立页面多数只展示静态内容；现有后端已经具备志愿者档案、服务任务、任务分配、风险事件的持久化接口，却没有面向工作台的聚合接口。学生端、教师端的总体规划已在 `backend-functional-requirements.md` 中覆盖学习闭环、测评、复核和成长报告；志愿者端此前只记录了“工作台聚合 + 消息”，没有逐按钮、数据权限和跨角色数据流说明。本文件补齐该缺口，并作为后续实现顺序。

## 2. 现状证据与状态

| 页面/路由 | 当前实现 | 缺口状态 |
|---|---|---|
| `/volunteer` 工作台 | 有响应式布局、加载/错误/无任务状态、侧栏、资格、任务、培训、联系人、风险上报交互；数据来自 `defaultState` | `MAIN_PARTIAL / BLOCKED_BY_API`：档案与任务未接真实接口，消息、培训、时长、资格和风险提交未形成完整数据链 |
| `/volunteer/training` | iframe 嵌入培训静态页 | `MAIN_DEMO`：课程目录、进度、考核状态、证书需持久化 |
| `/volunteer/tasks` | iframe 嵌入任务静态页 | `MAIN_DEMO`：列表筛选、详情、接受/开始/完成、冲突校验需后端 |
| `/volunteer/records` | iframe 嵌入服务记录静态页 | `MAIN_DEMO`：服务日志、时长核验、教师反馈、导出需后端 |
| `/volunteer/certificate` | iframe 嵌入完成证书静态页 | `MAIN_DEMO`：证书签发、有效期、撤销和下载凭证需后端 |
| `/volunteer/resources` | iframe 嵌入资源/评估静态页 | `MAIN_DEMO`：资源权限、版本、下载/离线状态需后端 |
| `/volunteer/community` | iframe 嵌入结对/社区静态页 | `MAIN_DEMO`：结对关系、帖子、评论、举报和脱敏需后端 |
| `/volunteer/messages` | iframe 嵌入风险报告静态页 | `MAIN_DEMO`：站内会话、未读数、附件、风险升级需后端 |
| `/volunteer/help` | iframe 嵌入招募/帮助静态页 | `MAIN_DEMO`：FAQ 版本、工单、人工联系和 SLA 需后端 |

## 3. 志愿者工作台逐元素需求

### 3.1 顶部与侧栏

- 侧栏导航：点击只改变路由；服务端必须根据 `VOLUNTEER` 身份限制路由，未授权返回 403 状态页。
- 消息按钮：读取当前用户通知未读数，点击进入消息列表并将已读状态写入 `NotificationRead`；只可见 `recipientId = 当前用户` 的消息。
- 头像/身份切换：读取当前用户和学校成员关系；身份切换必须重新建立 tenant 上下文，不得仅改前端角色字符串。
- 语言按钮：仅切换界面语言偏好，写入 `UserPreference`，不改变业务数据。

### 3.2 个人档案、服务旅程、培训考核

- 档案卡：来源为 `User + Membership + VolunteerProfile`，只展示姓名、头像、志愿者等级和脱敏学校信息。
- 服务旅程：由 `VolunteerProfile.status`、`TrainingEnrollment`、`VolunteerServiceTask`、`ServiceRecord` 聚合；每个节点点击打开对应详情，而不是只弹 toast。
- 培训进度：读取课程完成数和总课时；“进入考核”仅在资格规则满足时创建/恢复 `TrainingExamAttempt`，重复点击必须幂等；考试提交后生成可审计结果。

### 3.3 今日任务与服务操作

- 今日任务：来源为已分配给当前志愿者且学校范围匹配的 `VolunteerServiceTask`；按开始时间排序，服务对象只返回人数和年级段，不返回学生姓名、联系方式或录音。
- “全部任务”：进入任务列表，支持状态/日期/服务类型筛选，筛选条件只影响查询，不在前端伪造列表。
- “进入服务”：服务资格有效、任务状态为 `ASSIGNED/CONFIRMED` 且当前时间在允许窗口时，调用幂等的 `POST /volunteers/service-tasks/:id/start`；否则展示具体原因（资格、时间窗、任务状态或权限）。
- 服务结束：提交开始/结束时间、服务摘要和异常标记，写入 `ServiceRecord`，教师确认后才计入累计时长。

### 3.4 服务时长、教师沟通、资格、课程、保护守则、风险上报

- 累计时长：仅聚合已核验 `ServiceRecord`，按学校/志愿者过滤；未核验记录显示“待确认”。
- 教师沟通/发消息：使用站内 `Conversation/Message`，收件人必须是任务关联教师；禁止展示私人联系方式；消息写入审计事件。
- 服务资格：来源为 `VolunteerProfile` + `Qualification`；证书下载使用短时效 URL，并记录导出原因。
- 待学课程：来源为 `TrainingCourse + TrainingEnrollment`；继续学习要保存章节进度和最后访问时间。
- 保护守则：版本化的 `SafeguardingPolicy`，志愿者确认后写入 `PolicyAcknowledgement`；风险上报创建 `VolunteerIncident`，仅报告人、被授权教师/管理员可见，学生敏感字段按 `viewMinorData` 脱敏。

## 4. 数据模型与访问边界

新增/补齐实体：`TrainingCourse`、`TrainingEnrollment`、`TrainingExamAttempt`、`ServiceRecord`、`Qualification`、`Conversation`、`Message`、`SafeguardingPolicy`、`PolicyAcknowledgement`、`NotificationRead`。所有学校级实体必须包含 `schoolId`；服务任务和记录通过 `assignedVolunteerId` 限定志愿者；教师只能访问其班级/任务关联记录；志愿者只能访问分配给自己的任务、自己的档案和消息；学生信息默认仅返回聚合或脱敏字段。跨角色查看、导出、风险读取写 `AuditLog`。

## 5. API 交付顺序

1. P0：工作台用现有 `GET /schools/:schoolId/volunteers/me` 和 `GET /schools/:schoolId/volunteers/:volunteerId/service-tasks` 做真实水合；完善 loading/empty/error/permission/offline 状态。
2. P0：补齐服务任务 start/complete、服务记录核验和工作台聚合查询，保证累计时长可追溯。
3. P1：培训课程/考试/证书与保护守则确认。
4. P1：站内消息、通知已读、教师沟通和风险事件志愿者可见范围。
5. P2：资源离线包、社区结对、帮助工单和导出审计。

## 6. 学生端、教师端对照与联动

学生端逐页核对结果如下：`/student/courses` 的筛选和课程卡片已能渲染，但课程聚合、进度状态和 assignment 权限查询仍需真实接口；`/student/today` 的范读播放、资源缓存和同步指示仍是 UI 状态；`/student/learn/spring-2` 已有录音流程但录音 Service、预签名上传和证据回放必须完成；`/student/growth` 的阶段、趋势、学习计划和 PDF 导出仍缺持久化；`/student/profile` 的统计和离线包仍依赖硬编码；`/assessment/*` 的测评会话、朗读/书面提交、自动评分、报告和历史复测仍是占位。

教师端逐页核对结果如下：`/teacher` 首页的待复核、风险学生、截止任务和课程审核指标仍是硬编码；`/teacher/assignments` 的班级目标、截止时间和状态操作已部分接入，但通知和批量状态变更需补齐；`/teacher/reviews/:id` 的音频证据、反馈草稿/发布需要真实 Recording/Feedback 权限链；`/teacher/courses/spring/studio` 的编辑和发布已接入，`submit-review` Controller 仍需暴露并记录版本审计；班级/学生详情的成长趋势、测评参与率、薄弱维度和补充练习动作仍缺聚合接口；教师 AI 工具的生成、草稿保存和人工审核必须使用可追溯版本，不能用前端 toast 伪造成功。

志愿者端与两端的安全数据流为：教师创建 `VolunteerIncident/ServiceTask` → 志愿者读取脱敏任务 → 志愿者回传服务记录/消息 → 教师复核 → 学生仅收到经授权的反馈。志愿者不得直接读取学生录音、成长报告或联系方式；所有跨角色访问必须经过学校、班级/任务关系和 `viewMinorData` 权限检查。

## 7. 实施与验收

- 先完成工作台真实水合，再扩展 API；不以本地数组伪造成功。
- 每个新增操作覆盖正常、加载、空、错误、离线、无权限状态，并增加跨学校/非本人任务的负向测试。
- 使用真实浏览器在 1440、1024、390 宽度截图验证工作台与嵌入页；记录控制台错误和接口响应。
- 迁移采用向前兼容字段；回滚先关闭新路由/开关，再回滚迁移，不删除历史服务记录或审计日志。

### 当前迭代已完成（2026-07-18）

- 工作台接入志愿者档案和本人任务查询，并保留未登录/错误/无任务状态。
- 服务任务新增志愿者本人 `start` / `complete` 状态流转；服务端校验学校、本人分配关系、资格和状态迁移。
- 风险上报允许志愿者提交，仍按学校租户隔离；前端已改为真实提交，不再用成功 toast 代替写入。
- 工作台开始读取培训报名和已发布培训项目；有真实报名数据时同步培训完成度、考核准备状态和课程列表。
- API TypeScript 检查通过；志愿者服务单测 22 项通过；浏览器志愿者页面冒烟无控制台错误。

### 下一迭代

培训进度/考试、服务记录核验、站内消息和证书导出仍需独立实体及接口；在这些接口完成前，相关嵌入页面必须继续显示明确的“待接入”状态，禁止宣称已完成。
