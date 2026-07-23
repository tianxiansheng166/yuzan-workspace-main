# ADR-001：受控推进学生、教师教案与藏汉翻译三条 P0 泳道

- 状态：`ACCEPTED_FOR_PLANNING`
- 日期：2026-07-24
- 决策 owner：Integration Lead
- 事实基线：`ca14c57f0534e4e8ddf3e273128668b6c12e685e`

## 背景

学生课程关联练习已经产生一条可信的动态 ID、真实录音、书面答案、API、数据库和
新浏览器上下文证据链。与此同时，教师教案和藏汉翻译并非从零开始：

- 教师教案已有 API、Job/Draft/Revision、BullMQ、Flowise 资产和教师页面；
- 藏汉翻译已有 controller/service/port、权限骨架和 fail-closed unavailable 行为；
- 这些代码在提交 `55c673c` 后已经进入当前历史，只是没有各自独立的闭环任务和
  实时证据。

继续把所有非学生任务一律冻结，会闲置可独立使用的开发资源；无序并发又会让
OpenAPI、Prisma、公共 API client、worker 入口和课程核心文件发生冲突。

## 决策

采用“多泳道并行、泳道内串行、共享事实单写者、单一集成线”的模式。

允许三条产品泳道：

1. 学生课程与练习；
2. 教师 AI 教案草稿；
3. 藏汉翻译工具及其后续已批准网页双语消费。

共享 OpenAPI 先由 `P0-AI-TOOL-CONTRACTS-001` 固化。教师教案任务不得修改
Prisma、OpenAPI、公共 API client 或 worker 启动入口；翻译工具任务是其 Prisma
迁移和 translation worker 启动入口的唯一 owner。学生课程视频和笔记继续在同一
泳道串行，不与课程提交任务并发修改课程核心文件。

所有任务仍使用：

```text
task JSON → sibling worktree → task-context → 最小测试 → handoff
→ review → commit → finish → push → integration revalidation
```

架构上保留当前 NestJS 模块化单体与薄业务核心，优先复用现有
Course/Submission/AssessmentSession、Resource/对象存储、BullMQ/Flowise 和身份
边界。H5P、QTI、OneRoster、Uppy/tusd、Langfuse/OpenTelemetry 作为后续 adapter
候选，不在本轮扩根依赖；不整体迁移到 Moodle、Open edX 或 Canvas。

## 不变约束

- AI 教案默认 `NEEDS_REVIEW`，只能由教师修改和确认，首版不自动发布；
- 机器译文默认待人工复核，网页双语只消费 `APPROVED` 译文；
- provider 未配置或不可用必须显式，不生成假草稿或假译文；
- 不用固定 ID、fixture provider、静态分数、页面写死状态或 HTTP 200 冒充闭环；
- main 不直接开发；同一时间只有一条活动 integration 线；
- 推送任务分支不等于集成，更不等于发布。

## 后果

正向结果：

- 教师和翻译半成品获得独立分支、owner、测试和回滚边界；
- 多个 Goal 可以真正并行，而不是并发覆盖共享文件；
- 学生核心方向仍由真实证据链驱动，不被泛化 Agent 或平台扩张稀释；
- 旧报告或聊天不再承担调度事实，任务图由仓库内 JSON 和看板接管。

成本：

- 共享契约任务成为教师和翻译的短前置；
- 每合入 2–3 个任务必须暂停进入硬化窗口；
- 翻译真实 happy-path 依赖合法 provider 与本地密钥，缺失时任务会如实 `BLOCKED`；
- 网页双语必须等待人工批准译文，不能先做纯展示页面。
