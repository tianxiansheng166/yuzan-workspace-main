# GOV-DEV-FRAMEWORK-001 Handoff

- Owner: Codex
- Reviewer: Integration Lead
- Branch: `task/gov-dev-framework-001`
- Base commit: `d22d8e14a78ee7bd78a2513fa099bbc93a538c45`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成：后续 AI 可从一个短契约和任务 JSON 开工，按需取上下文，并用统一门禁完成
  白名单检查、最小测试证据、自审、交接、提交和干净状态验证；
- P0 贡献：给“古诗文朗读与理解训练”黄金闭环的顺序开发提供统一控制面，不新增
  产品功能；
- 明确未做：未修改前后端运行时、OpenAPI、Prisma、数据库、依赖或产品页面。

## 实现与修改范围

- 新增 `AI-DEVELOPMENT-CONTRACT.md`，收敛产品方向、上下文预算、实现规则、风险分级、
  最小测试、自审和完成定义；
- 新增 `CONTEXT-ROUTER.md`，把默认通读改成按任务类型读取 2–6 个直接相关资料；
- 新增 `NEXT-DEVELOPMENT-QUEUE.md`，把唯一 P0 拆成六个串行候选出口并设置停止线；
- 新增排程、执行、审查提示词及任务/handoff 模板；
- 新增 `task-gate.ps1`，验证任务字段、branch/base、changed paths、共享 owner、CCR、
  测试证据、handoff、领先提交和 clean status；
- 新增聚焦 smoke，并把入口、工作流、安全自治和 PR 模板对齐到同一生命周期；
- 修复并记录 Windows PowerShell 5.1 对无 BOM UTF-8 文本/脚本的兼容问题。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| Framework smoke / PowerShell 7 | `& .\scripts\repo\test-development-framework.ps1` | `PASS`：12 files / 4 JSON / 4 scripts |
| Framework smoke / Windows PowerShell 5.1 | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\repo\test-development-framework.ps1` | `PASS`：12 files / 4 JSON / 4 scripts |
| Patch hygiene | `git diff --check` | `PASS` |
| Preflight negative gate | 对当前脏实现运行 `task-gate.ps1 -Mode preflight` | `PASS`：只因 clean-worktree 条件拒绝 |
| Review gate | `task-gate.ps1 -Mode review` | `PASS`：PowerShell 7 与 Windows PowerShell 5.1，19 changed paths |
| Finish gate | `task-gate.ps1 -Mode finish` | `PASS`：PowerShell 7 与 Windows PowerShell 5.1，19 changed paths、领先 base 2 commits、worktree clean |

## 自审

- [x] 差异只服务开发控制框架，并在任务 `allowed_paths` 内
- [x] 没有固定 ID、静态业务数据、假成功或 demo fallback
- [x] 未改变 runtime、tenant 权限或 provider 状态
- [x] 最高风险（入口一致性、JSON/PowerShell 兼容、Git 门禁）有直接检查
- [x] 无密钥、真实学生数据或来源不明资产
- [x] `task-gate.ps1 -Mode review` 通过

## 风险、限制与回滚

- 已知风险：门禁只验证任务声明和证据，不执行任意字符串形式的测试命令，避免把任务
  JSON 变成无约束命令执行入口；
- 已知限制：旧 `GOV-ROOT-*` 任务没有回填新 schema；新门禁从新任务开始执行；
- 假设：Integration Lead 继续负责选择 merge target、集成复验和更新 `CURRENT.md`；
- 回滚：revert 本任务提交即可；没有产品数据或 schema 迁移。

## 集成说明

- 合并顺序：本治理任务应先于后续 P0 功能任务；
- Integration Lead 需要复验：Windows PowerShell smoke、review/finish 输出、分支 clean；
- 实现 commit：`555254e888699f5083b24952c87f3b3e975d5dd7`；
- 推送分支：`task/gov-dev-framework-001`，最终交付 commit 以本 handoff 所在 HEAD 为准。
