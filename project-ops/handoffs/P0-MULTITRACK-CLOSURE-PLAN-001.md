# P0-MULTITRACK-CLOSURE-PLAN-001 Handoff

- Owner: Codex
- Reviewer: Integration Lead
- Branch: `task/p0-multitrack-closure-plan-001`
- Base commit: `ca14c57f0534e4e8ddf3e273128668b6c12e685e`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：形成基于当前源码/证据的学生、教师 AI 教案、藏汉翻译
  多路线任务图，并提供可直接用于 Goal 模式的独立提示词、机器派发、跟踪、审查、
  checkpoint 和合并规范。
- 推进黄金闭环的环节：保留学生真实学习证据主轴，同时把已有教师教案和翻译半成品
  纳入独立分支、真实 provider、人工复核和统一集成门禁。
- 明确未做：未修改任何业务源码、Prisma/OpenAPI、运行环境或用户数据；未合并
  `main`；未把课程提交证据修复、教师教案或翻译工具冒充完成。

## 当前事实审计

- `P0-STUDENT-COURSE-PRACTICE-001` 的 `ca14c57` 是已核远端的可信课程练习基线。
- `P0-STUDENT-COURSE-SUBMIT-001` 有本地实现，但 handoff/远端和证据不一致，正式
  状态降为 `EVIDENCE_REPAIR`，只恢复现有分支。
- 视频已有 Resource/签名 URL/播放器外壳，但缺课程可播 URL、服务端进度与恢复；
  笔记已有 CRUD/revision，但缺真实视频上的用户闭环证据。
- 教师教案已有 Job/Draft/Revision/BullMQ/Flowise，阻断是字段/schema 漂移、真实
  credential/flow ID/健康检查、回写重试和 school scope。
- 翻译生产路径仍绑定 unavailable repository，页面脚本损坏，并缺用户归属、真实
  provider、持久化、受控加密、限流和人工审批。

## 实现与修改范围

- 稳定短契约：`project-ops/AI-DEVELOPMENT-CONTRACT.md`
- 事实规划：`project-ops/plans/P0-MULTITRACK-CLOSED-LOOPS.md`
- 机器任务图与接受表：
  `project-ops/multitrack-tasks.json`、
  `project-ops/accepted-baselines.json`
- 跟踪与集成：
  `project-ops/MULTITRACK-BOARD.md`、
  `project-ops/runbooks/MULTITRACK-INTEGRATION.md`
- 总协调提示词和 9 个任务/集成提示词：`project-ops/prompts/**`
- 自动门禁：
  `project-ops/scripts/validate-multitrack-plan.ps1`、
  `project-ops/scripts/resolve-multitrack-task.ps1`
- 稳定决策：`project-ops/decisions/ADR-001-CONTROLLED-P0-MULTITRACK.md`
- 复用策略：当前复用 Course/Submission/AssessmentSession、Resource/对象存储、
  BullMQ/Flowise 和身份/学校边界；H5P/QTI/OneRoster/Uppy/tusd/
  Langfuse/OpenTelemetry 仅作为后续 adapter 候选，不整体迁移教学平台。

## 调度和共享事实

- 唯一权威控制面：`origin/integration/p0-multitrack-001`。
- 接受依赖必须同时满足 accepted entry、完整 commit、远端 task branch HEAD 一致。
- `shared_locks` 是机器互斥；`shared_writes` 是 reviewer 路径范围。
- 多依赖任务从 `current_checkpoint_commit` 开分支，并证明全部 accepted commits
  和 checkpoint 都位于远端 integration 历史。
- 当前可先恢复 Course Submit；规划任务被控制面接受后可同时派发 AI Contracts 和
  Independent Practice；教师教案与翻译工具等 AI Contracts 接受后并行。
- Video Progress 等 Course Submit + AI Contracts 的共同 checkpoint；Video Note
  再串行；Bilingual 等 Translation Tool + Video Note 的共同 checkpoint。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| JSON 与自动上下文 | `Get-ChildItem project-ops/tasks ... ConvertFrom-Json; .\scripts\repo\task-context.ps1 -Mode resume` | `PASS`；任务自动恢复，识别 branch/task/changed paths |
| PowerShell 7 任务图 | `.\project-ops\scripts\validate-multitrack-plan.ps1` | `PASS`；8 tasks、4 accepted entries、8 prompts、远端 HEAD 核对 |
| Windows PowerShell 5.1 任务图 | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\project-ops\scripts\validate-multitrack-plan.ps1` | `PASS`；与 PowerShell 7 一致 |
| 可执行派发解析 | `powershell.exe ... resolve-multitrack-task.ps1 -TaskId P0-STUDENT-COURSE-SUBMIT-001` | `PASS`；解析 `READY_TO_RESUME`、现有 worktree 和 `ca14c57...` |
| Markdown/空白 | `git diff --check` | `PASS` |
| 陌生执行者回归 | 独立只读 reader test，逐项复核 acceptance、base、checkpoint、锁和状态 | 最终 `P0/P1=0`；最后一项 checkpoint 祖先约束已补入 validator/resolver |
| Task review | `.\scripts\repo\task-gate.ps1 -Mode review -TaskFile project-ops/tasks/active/P0-MULTITRACK-CLOSURE-PLAN-001.json` | 先后准确拒绝错误 evidence 字段和 2 处 staged 行尾空格；修正后复跑 `PASS`，24 changed paths |

## 自审

- [x] 差异只服务任务结果且均在 `project-ops/**`
- [x] 未写固定业务 ID、静态业务结果、假成功或 demo fallback
- [x] provider unavailable、证据修复和人工复核状态如实呈现
- [x] 最高风险由 reader test、双 PowerShell、远端 HEAD 和 resolver 直接验证
- [x] 未保存密钥、真实学生数据或敏感 provider 内容
- [x] `task-gate.ps1 -Mode review` 通过

## 风险、限制与回滚

- 已知风险：真实 AI/翻译 provider、许可/数据出境和密钥尚未就绪时，对应业务任务
  会保持 `BLOCKED`；这不是规划任务失败。
- 已知限制：本任务只交付治理与 Goal 任务包，不证明业务闭环；课程提交分支仍需
  证据修复。
- 假设：Integration Lead 持续维护唯一 control branch，不允许 task owner 直接改
  accepted baselines。
- 受保护现场：canonical 的 `.learnings/ERRORS.md` 和未追踪的对标分析文档未被
  修改、暂存或带入本分支。
- 回滚步骤：revert 本规划分支和后续 control metadata commits；没有业务 schema、
  runtime 或用户数据需要回滚。不要 reset/删除用户工作区。

## 集成说明

- 规划分支 review/finish/push 后，以其远端完整 HEAD 一次性 bootstrap
  `integration/p0-multitrack-001`。
- 只在 control branch 把本规划任务写为 `VERIFIED`，登记初始 checkpoint，并解锁
  AI Contracts/Independent Practice。
- 最终远端 HEAD 不能在同一提交中自引用；推送后使用 `git rev-parse HEAD` 与
  `git ls-remote --heads origin task/p0-multitrack-closure-plan-001` 现场核对。
- 未经用户或 Integration Lead 单独授权，不合并 `main`、不部署、不删除 worktree。
