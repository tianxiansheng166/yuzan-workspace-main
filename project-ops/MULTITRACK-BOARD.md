# P0 多路线跟踪看板

> 更新时间：2026-07-26 18:15 +08:00
> 机器任务图：`project-ops/multitrack-tasks.json`
> 已接受基线：`project-ops/accepted-baselines.json`
> 权威来源：`origin/integration/p0-multitrack-001` 的同一远端 commit

## 状态维度

- `dispatch_status`：现在是否可创建/恢复 Goal；
- `execution_status`：任务分支自身处于哪个开发门禁；
- `evidence_status`：用户闭环证据强度；
- `integration_status`：是否已进入唯一 integration 线。

四个维度不能互相替代。比如课程提交当前 task JSON 自称 `READY_FOR_REVIEW`，但看板
按实时证据把其 execution 记为应恢复的 `IN_PROGRESS`，evidence 为
`EVIDENCE_REPAIR`。

## 当前任务

| 路线 | 任务 | Dispatch | Execution | Evidence | Integration | 下一门禁 |
|---|---|---|---|---|---|---|
| 治理 | `P0-MULTITRACK-CLOSURE-PLAN-001` | `CLOSED` | `COMPLETED` | `VERIFIED` | `INTEGRATED` | 控制面已在 integration 基线；等待本次硬化 |
| 学生课程 | `P0-STUDENT-COURSE-PRACTICE-001` | `READY_TO_RESUME` | `COMPLETED` | `RUNTIME_REVERIFY_REQUIRED` | `INTEGRATED` | MinIO URL compatibility 已修复；需新浏览器真实录音上传、回读和课程回写复验 |
| 学生课程 | `P0-STUDENT-COURSE-SUBMIT-001` | `READY_TO_RESUME` | `READY_FOR_REVIEW` | `RUNTIME_REVERIFY_REQUIRED` | `INTEGRATED_CHECKPOINT` | 代码/定向测试已通过；需动态教师任务→学生提交→教师查看的主目录浏览器证据 |
| 跨角色任务 | `P0-TEACHER-STUDENT-ASSIGNMENT-CLOSURE-001` | `READY_TO_DISPATCH` | `NOT_CREATED` | `NOT_STARTED` | `NOT_INTEGRATED` | 动态教师创建→学生新会话收到→完成→教师动态 submission/review；移除 `submission-1` 固定路由 |
| 共享契约 | `P0-AI-TOOL-CONTRACTS-001` | `CLOSED` | `COMPLETED` | `VERIFIED` | `INTEGRATED` | 已合入 integration/p0-multitrack-001 (e1505b3)；OPENAPI 锁已释放 |
| 学生练习 | `P0-STUDENT-INDEPENDENT-PRACTICE-001` | `CLOSED` | `COMPLETED` | `VERIFIED` | `INTEGRATED` | 已合入 integration/p0-multitrack-001 (bd3c40f)；ASSESSMENT_CORE 锁已释放 |
| 教师教案 | `P0-TEACHER-AI-LESSON-PLAN-001` | `READY_TO_RESUME` | `READY_FOR_REVIEW` | `PARTIAL` | `INTEGRATED_CHECKPOINT` | API 23/23、worker 25/25、类型检查通过；Flowise 未配置时必须显式不可用，待真实 provider + 浏览器闭环 |
| 藏汉翻译 | `P0-TIBETAN-TRANSLATION-TOOL-001` | `BLOCKED` | `BLOCKED` | `PARTIAL` | `INTEGRATED_CHECKPOINT` | 45 翻译测试、Prisma validate、API/worker typecheck 通过；BLOCKED: provider 凭据、合规与前端闭环 |
| 学生课程 | `P0-STUDENT-COURSE-VIDEO-PROGRESS-001` | `WAITING_DEPENDENCY` | `NOT_CREATED` | `PARTIAL` | `NOT_INTEGRATED` | 等课程提交、共享契约和共同 integration checkpoint |
| 学生课程 | `P0-STUDENT-COURSE-VIDEO-NOTE-001` | `WAITING_DEPENDENCY` | `NOT_CREATED` | `PARTIAL` | `NOT_INTEGRATED` | 等视频进度 |
| 网页双语 | `P1-TIBETAN-BILINGUAL-COURSE-001` | `WAITING_DEPENDENCY` | `NOT_CREATED` | `NOT_STARTED` | `NOT_INTEGRATED` | 等翻译工具、视频笔记和共同 integration checkpoint |

## 共享写锁

机器互斥使用 registry 的稳定 `shared_locks`（例如 `OPENAPI`、`COURSE_CORE`、
`TRANSLATION_PRISMA`）；`shared_writes` 用来审查实际路径范围，不能用字符串完全
相等替代锁冲突判断。

| 共享事实 | 当前 owner | 释放条件 |
|---|---|---|
| `accepted-baselines.json`、integration checkpoint | Integration Lead | 更新后运行 validator、提交并推送 integration |
| `packages/contracts/openapi/openapi.yaml` | 已释放 | `P0-AI-TOOL-CONTRACTS-001` 已 INTEGRATED；后续 consumer 可写 |
| 翻译 Prisma schema 与本任务 migration | Integration Lead | 已在 checkpoint；主目录验证后转交后续 consumer |
| `backend/worker/src/main.ts` | Integration Lead | AI 与 translation consumer 共存 typecheck 已通过；运行时启停留待硬化 |
| 学生课程核心文件 | 当前 `P0-STUDENT-COURSE-SUBMIT-001` | 证据修复接受后，依次转给 video-progress、video-note |
| 双语课程 consumer 与翻译读取接口 | `P1-TIBETAN-BILINGUAL-COURSE-001` | 视频笔记和翻译工具均接受后才接管 |
| `project-ops/CURRENT.md` | Integration Lead | integration 实时验证后更新 |

## 每次检查点更新

每个 Goal 在 45–90 分钟或一个可验证子结果后更新：

```text
当前 HEAD
已完成的唯一结果
实际运行的测试及数量
新增证据路径
剩余最高风险
是否需要共享锁/CCR
下一条最小动作
Git status
```

任务分支只更新自己的 task JSON 和 handoff；Integration Lead 才更新看板、registry、
accepted baselines 和 `CURRENT.md`。
