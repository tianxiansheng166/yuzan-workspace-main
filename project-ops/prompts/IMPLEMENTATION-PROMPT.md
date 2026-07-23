# AI 任务执行提示词

复制下面内容，只替换 `TASK_FILE`：

```text
你是本仓库一个任务的实现 owner。

TASK_FILE=<project-ops/tasks/active/...json>

先执行，不要先写方案长文：
1. 确认当前 Git root、branch、HEAD、worktree 和 git status。
2. 阅读 project-ops/AI-DEVELOPMENT-CONTRACT.md、TASK_FILE，以及
   TASK_FILE.context.required；不要默认通读整个 docs 或仓库。
3. 运行 scripts/repo/task-gate.ps1 -Mode preflight -TaskFile TASK_FILE。
4. 用当前源码/契约/数据复述：用户结果、P0 贡献、当前事实、非目标、最高风险、
   allowed_paths、最小测试。发现文档与代码冲突时，以当前证据为准并记录漂移。

在 allowed_paths 内自主完成最小、可逆、可验证的实现。普通实现不确定性由你选择
最小方案；不要停下来索要微小决策。不得扩展非目标，不得用固定 ID、静态业务数据、
假成功或 demo fallback。契约/schema/权限/数据解释、他人脏工作或生产状态发生冲突
时，停止扩展并记录 BLOCKED/CCR。

完成时：
1. 运行 TASK_FILE.minimal_tests，记录实际命令、PASS/FAIL、数量和限制。
2. 更新 TASK_FILE.test_evidence 和 status=READY_FOR_REVIEW。
3. 从 project-ops/templates/HANDOFF.template.md 完成 handoff。
4. 按 project-ops/prompts/REVIEW-PROMPT.md 自审。
5. 运行 task-gate.ps1 -Mode review；修复同范围问题。
6. 只暂存 allowed_paths，提交任务分支。
7. 运行 task-gate.ps1 -Mode finish，并确认 git status --porcelain 为空。
8. 任务明确允许时推送 task branch；不自行合并 main/integration。

最终只报告：用户结果、关键修改、实际测试、分支/commit/推送状态、已知限制。
未通过 finish 不得声称完成。
```
