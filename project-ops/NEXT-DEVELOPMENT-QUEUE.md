# P0 多泳道开发队列

> 事实快照：2026-07-24
> 机器可读任务图：`project-ops/multitrack-tasks.json`

资源充足时可以多路推进，但只并行“不争用共享事实、依赖已满足”的任务。每条泳道
内仍保持线性；共享事实先由唯一 owner 固化，再让多个 consumer 并行。

## 当前事实

| 能力 | 状态 | 下一出口 |
|---|---|---|
| 课程关联古诗文练习 | `VERIFIED` | 保持 `ca14c57` 为可信基线 |
| 普通课程提交 | `EVIDENCE_REPAIR` | 修复真实录音、三尺寸、动态 DB 证据与远端/handoff 一致性 |
| 课程视频 | `PARTIAL` | 真实资源 URL、服务端进度、刷新恢复和完成回写 |
| 时间点笔记 | `PARTIAL` | 在真实视频上完成 CRUD、revision 冲突与跨用户隔离 |
| 独立专项练习 | `PLANNED` | 复用同一执行器完成自主开始、恢复、提交和历史 |
| 教师 AI 教案 | `PARTIAL` | 真实 Flowise/provider、结构化草稿修改和教师审批 |
| 藏汉翻译工具 | `BROKEN/PARTIAL` | 真实 provider、持久化、用户归属、人工修订和审批 |
| 网页双语 | `NOT_STARTED` | 只消费已批准译文，不阻塞原文学习 |

`READY`、`PARTIAL` 或页面可访问都不等于闭环完成；只有实时浏览器、API、数据库和
必要 provider 证据同时成立，才进入 `VERIFIED`。

## 波次

### Wave 0：Submit 可先恢复，规划接受后扩为三路

1. `P0-STUDENT-COURSE-SUBMIT-001`：只恢复现有分支并修复证据；若证据暴露代码
   缺陷，再以新提交修复，不新造重复任务。
2. `P0-AI-TOOL-CONTRACTS-001`：唯一 OpenAPI owner，先冻结教师教案和翻译工具
   的 provider/consumer 契约及人工复核状态。
3. `P0-STUDENT-INDEPENDENT-PRACTICE-001`：只用当前 Assessment 契约和页面局部
   gateway；发现需要 OpenAPI 变更就阻塞，不与契约 owner 并发写。

规划分支 finish/push 之前，只有第 1 项可恢复；第 2、3 项保持
`WAITING_DEPENDENCY`。Integration Lead 把规划 commit 写入
`accepted-baselines.json` 后，才将它们改为 `READY_TO_DISPATCH`。

### Wave 1：共享契约通过后并行

1. `P0-TEACHER-AI-LESSON-PLAN-001`：不改 Prisma、OpenAPI、公共 API client 或
   worker 启动入口。
2. `P0-TIBETAN-TRANSLATION-TOOL-001`：翻译线唯一 Prisma 和 translation worker
   启动入口 owner；不再修改已经冻结的 OpenAPI。

### Wave 2：按泳道依赖推进

1. `P0-STUDENT-COURSE-VIDEO-PROGRESS-001`：等待课程提交证据修复和 OpenAPI 锁
   释放。

### Wave 3：视频笔记

`P0-STUDENT-COURSE-VIDEO-NOTE-001` 严格等待真实视频进度闭环。

### Wave 4：网页双语

`P1-TIBETAN-BILINGUAL-COURSE-001` 等待翻译工具和视频时间点笔记均通过，接管
课程核心文件，只选择一种真实课程内容做原文/双语切换。

### 持续控制面与硬化（贯穿所有波次）

`P0-MULTITRACK-INTEGRATION-001` 在规划接受后立即启动，持续维护 accepted
baselines 和共同 checkpoint，并按“共享契约 → 后端 provider → 前端 consumer →
纵向 E2E”合并。每合入 2–3 个任务运行一次全量硬化，最终才决定是否更新 main。

## 冻结项

- 管理驾驶舱、社区、商城、泛化 CMS、新终端；
- 自动发布 AI 教案、自动判定最终成绩、不可复核建议；
- 完整语料平台、未批准译文的全站自动替换、没有真实模型的“离线可用”；
- 第二套课程模型、第二套练习执行器或第二套全局 API client；
- 只为演示增加的 fixture、固定业务 ID、静态分数或假成功。

如果当前源码和实时证据证明候选任务已完成，应登记证据并跳过，不为匹配队列重复
实现。
