# P0 多路线跟踪看板

> 更新时间：2026-07-24 21:00 +08:00
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
| 治理 | `P0-MULTITRACK-CLOSURE-PLAN-001` | `CLOSED` | `COMPLETED` | `VERIFIED` | `NOT_INTEGRATED` | 控制面已建立；保留规划 commit 为初始 checkpoint |
| 学生课程 | `P0-STUDENT-COURSE-PRACTICE-001` | `N/A` | `COMPLETED` | `VERIFIED` | `NOT_INTEGRATED` | 等待 integration |
| 学生课程 | `P0-STUDENT-COURSE-SUBMIT-001` | `READY_TO_RESUME` | `IN_PROGRESS` | `EVIDENCE_REPAIR` | `NOT_INTEGRATED` | 真实录音、提交脚本、三尺寸、动态 DB、handoff/remote 一致 |
| 共享契约 | `P0-AI-TOOL-CONTRACTS-001` | `CLOSED` | `COMPLETED` | `VERIFIED` | `INTEGRATED` | 已合入 integration/p0-multitrack-001 (e1505b3)；OPENAPI 锁已释放 |
| 学生练习 | `P0-STUDENT-INDEPENDENT-PRACTICE-001` | `CLOSED` | `COMPLETED` | `VERIFIED` | `NOT_INTEGRATED` | 已接受；释放 ASSESSMENT_CORE 锁；等待 integration |
| 教师教案 | `P0-TEACHER-AI-LESSON-PLAN-001` | `READY_TO_RESUME` | `IN_PROGRESS` | `PARTIAL` | `NOT_INTEGRATED` | worktree 已创建(base=1d0cd1b)；开始实现 |
| 藏汉翻译 | `P0-TIBETAN-TRANSLATION-TOOL-001` | `READY_TO_RESUME` | `IN_PROGRESS` | `PARTIAL` | `NOT_INTEGRATED` | worktree 已创建(base=1d0cd1b)；开始实现 |
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
| 翻译 Prisma schema 与本任务 migration | `P0-TIBETAN-TRANSLATION-TOOL-001` | 迁移/回滚与任务 finish 通过 |
| `backend/worker/src/main.ts` | `P0-TIBETAN-TRANSLATION-TOOL-001` | translation consumer 启停测试通过 |
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
