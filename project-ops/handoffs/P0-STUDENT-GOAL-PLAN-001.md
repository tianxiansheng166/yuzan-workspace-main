# P0-STUDENT-GOAL-PLAN-001 Handoff

- Owner: Codex
- Reviewer: Integration Lead
- Branch: `task/p0-student-goal-plan-001`
- Base commit: `17cbbe0e39dcf1c401edef50508b1876ee82e6fd`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：仓库现在有一条统一的 start/resume 命令，可从当前分支
  自动发现任务并读取最小上下文；同时有一份学生端连续闭环路线图和一份可以直接
  粘贴到目标模式、驱动首个学生真实闭环的提示词。
- 推进黄金闭环的环节：先闭合“课程→关联练习→真实录音/书面作答→提交→课程
  持久化完成”，再顺序推进普通课程、独立练习、听说模拟、报告/再练和教师干预。
- 明确未做：没有修改学生业务源码、API、OpenAPI、Prisma、运行时或数据库；没有
  实现教师、管理、Agent、翻译或首个学生业务闭环。

## 实现与修改范围

- 实现摘要：
  - 新增 `task-context.ps1`，支持 `auto/start/resume`；
  - 按 branch 自动匹配唯一 active task JSON；
  - start 调用 preflight，resume 调用新增 resume 门禁；
  - 自动输出短契约、任务 JSON、2–6 个 required 文件、已有 handoff 和 Git 现场；
  - 限制单文件 100 KiB、总上下文 200 KiB，拒绝仓库外路径、目录和二进制；
  - 不写缓存或临时上下文文件；
  - 将自动入口写入 AGENTS、README、短契约、上下文路由、工作流和通用提示词；
  - 基于当前源码形成学生端闭环路线图和目标模式提示词；
  - 更新唯一开发队列，让课程关联练习成为第一个业务任务；
  - 新增跨 PowerShell 版本 smoke 和上下文预算负向检查。
- 主要文件：
  - `scripts/repo/task-context.ps1`
  - `scripts/repo/task-gate.ps1`
  - `scripts/repo/test-task-context.ps1`
  - `project-ops/plans/P0-STUDENT-CLOSED-LOOPS.md`
  - `project-ops/prompts/P0-STUDENT-GOAL-MODE-PROMPT.md`
  - `AGENTS.md`
  - `README-FIRST.md`
- 复用的现有模型/契约/组件：
  - active task JSON 与 `context.required`；
  - `task-gate.ps1` 的 branch/base/allowed_paths 检查；
  - 开发短契约、上下文路由、handoff 和 finish 门禁；
  - 当前 `StudentCoursesService`、`PracticeService`、通用练习执行器和 seed 事实。
- 共享事实或 CCR：修改的是仓库级 AI 入口和治理脚本，已在任务
  `shared_owner_changes` 声明；没有修改 OpenAPI/Prisma，不需要 CCR。

## 当前源码核对结论

- 学生课程后端已经提供真实课程目录、嵌套详情、课程 submission、活动进度和课程
  练习完成接口；
- practice 后端已经支持携带 `assignmentId/submissionId/activityId` 创建或恢复
  课程练习 attempt，并校验 school、student、submission、activity 和 definition；
- 通用练习执行器已经有真实录音、书面答案、提交、processing/report/history；
- 当前主要断点是课程详情 adapter 仍按旧顶层结构读取、创建 submission 响应读取
  错误、课程练习使用错误单数路由、完整课程上下文未传递、提交后的回写恢复未建立；
- 普通活动 DTO 和课程 submit revision 也有漂移，但已明确留给第二个学生闭环；
- development/test seed 当前可创建四门学生课程和六套练习；旧 evidence 不代表
  当前运行；
- 翻译模块默认 `UnavailableTranslationRepository`，不进入首个闭环。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| Task context / Goal package, PowerShell 7 | `& .\scripts\repo\test-task-context.ps1` | `PASS`；自动发现、resume、预算负向检查、规划与提示词锚点通过 |
| Task context / Goal package, Windows PowerShell 5.1 | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\repo\test-task-context.ps1` | `PASS` |
| Framework regression, PowerShell 7 | `& .\scripts\repo\test-development-framework.ps1` | `PASS`；16 files、5 JSON、6 ASCII PowerShell scripts |
| Framework regression, Windows PowerShell 5.1 | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\repo\test-development-framework.ps1` | `PASS` |
| Patch hygiene | `git diff --check` | `PASS`；无输出 |
| Context size sample | `task-context.ps1 -Mode resume` 后统计 UTF-8 输出 | `PASS`；102,998 bytes，低于 200 KiB 总预算 |

本任务不修改产品运行时，因此没有把 HTTP 200、页面截图或旧业务 evidence 当作本任务
通过条件。

## 读者自检

由于本任务不使用子代理，读者测试采用“无聊天前提的 12 个问题→文档明确章节”
映射，并由 smoke 检查稳定锚点：

| 陌生执行者问题 | 文档答案位置 | 结果 |
|---|---|---|
| 当前只做哪个闭环？ | 路线图 §0、§5 | 明确 |
| 为什么不先做教师/管理/翻译？ | §1、§2.3、§3 | 明确 |
| 哪些后端/执行器能力已存在？ | §2.1 | 明确 |
| 前后端字段哪里漂移？ | §2.2 A–H | 明确 |
| 三个课程上下文 ID 为什么必需？ | §2.2 E、§6 S4 | 明确 |
| 动态 ID 从哪里取得？ | §6 S7 | 明确 |
| 提交成功但课程回写失败怎么办？ | §6 S6 | 明确 |
| provider unavailable 是否阻断活动完成？ | §6 S6 | 明确 |
| 怎样最快证明不是假闭环？ | §7 | 明确 |
| 哪些条件满足才能完成？ | §12 | 明确 |
| AI 每次如何自动续作？ | §11 | 明确 |
| 如何保证提交、推送和 Git 干净？ | §6 S8、§12 | 明确 |

## 自审

- [x] 差异只服务任务结果且均在 `allowed_paths`
- [x] 无固定 ID、静态业务数据、假成功或 demo fallback
- [x] 相关失败/权限/offline/provider 状态在计划中真实要求
- [x] 最高风险有直接 smoke，未把 0 测试写成通过
- [x] 无密钥、真实学生数据或来源不明资产
- [x] `task-gate.ps1 -Mode review` 通过

## 风险、限制与回滚

- 已知风险：
  - 外部 AI 如果完全忽略仓库 `AGENTS.md`，仓库本身不能强制其运行入口；目标模式
    提示词已把命令设为第一条开发动作；
  - active task 的 branch 必须唯一匹配；没有任务 JSON 时仍需先建立任务；
  - required 文件仍是完整文件读取，因此任务 owner 必须保持 2–6 个精确文件并受
    100/200 KiB 预算约束。
- 已知限制：
  - 这是治理与执行包，不是学生业务实现；
  - 当前源码和 seed 结论是 2026-07-23 快照，目标模式开工时必须重核；
  - business task 不能自动合并 main，仍由 Integration Lead 复验。
- 假设：
  - 本分支先于后续 `P0-STUDENT-COURSE-PRACTICE-001` 被接受或被用作其精确控制基线；
  - 后续 AI 运行支持仓库 PowerShell 脚本和 Git worktree。
- 回滚步骤：revert 本任务在 base 之后的提交；它没有产品运行时或数据迁移副作用。

## 集成说明

- 依赖与合并顺序：
  1. `task/gov-dev-framework-001` / `17cbbe0...`；
  2. 本任务；
  3. `P0-STUDENT-COURSE-PRACTICE-001`。
- Integration Lead 需要复验：
  - 在匹配 active task 的任务分支运行 `task-context.ps1 -Mode auto`；
  - 两套 PowerShell smoke；
  - 目标模式提示词的 base 解析与 worktree 安全边界；
  - 后续业务任务仍从当前源码动态发现所有 ID。
- 推送分支/commit：`task/p0-student-goal-plan-001`；本 handoff 随最终任务提交推送，
  reviewer 以远端 branch HEAD 和交付回复中的完整 commit 为准。
