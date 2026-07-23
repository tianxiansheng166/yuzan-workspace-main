# 语赞心声开发入口

## 唯一主路径

```text
D:/program/test_program/yuzanxinsheng/three/yuzan-next
```

`three` 顶层只承担三类职责：

- `yuzan-next/`：唯一主项目与集成仓库；
- `worktrees/`：当前并发任务的 Git worktree；
- `legacy-archive/`：迁移前项目、旧 worker、依赖与恢复证据。

不要再从 `legacy-archive` 直接开发，也不要在 `three` 下创建新的完整克隆。

## 每次开始

在任务 worktree 中运行：

```powershell
& .\scripts\repo\task-context.ps1 -Mode auto
```

它会从当前 branch 自动发现任务，加载开发短契约、任务 JSON、最小必要上下文和
续作现场，并执行 start/preflight 或 resume 门禁。AI 不应再要求人工逐个附加这些
文件。

没有任务 JSON 时，不直接写代码。用 `project-ops/templates/task.template.json`
建任务，用 `project-ops/CONTEXT-ROUTER.md` 选择 2–6 个按需资料，先在独立
worktree 提交任务元数据，再运行上面的自动入口。

## 本地启动

- 环境与 Docker：`project-ops/runbooks/LOCAL-RUNTIME.md`
- 并发 worktree：`project-ops/runbooks/WORKTREES.md`
- 开发与合并：`project-ops/DEVELOPMENT-WORKFLOW.md`
- 当前开发队列：`project-ops/NEXT-DEVELOPMENT-QUEUE.md`
- 学生端闭环路线：`project-ops/plans/P0-STUDENT-CLOSED-LOOPS.md`
- 排程提示词：`project-ops/prompts/TASK-PLANNING-PROMPT.md`
- 执行提示词：`project-ops/prompts/IMPLEMENTATION-PROMPT.md`
- 审查提示词：`project-ops/prompts/REVIEW-PROMPT.md`
- 学生闭环目标模式：`project-ops/prompts/P0-STUDENT-GOAL-MODE-PROMPT.md`

旧 `orchestration/` 已不再是有效入口；历史副本只保存在归档中。
