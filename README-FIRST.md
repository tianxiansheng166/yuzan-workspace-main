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

1. 阅读 `project-ops/AI-DEVELOPMENT-CONTRACT.md`；
2. 打开分配给自己的任务 JSON；
3. 只读取任务 `context.required` 指定的上下文；
4. 确认 branch、base、白名单和共享 owner；
5. 在 `../worktrees/<task-id>` 中运行 preflight 后开发。

没有任务 JSON 时，不直接写代码。用 `project-ops/templates/task.template.json`
建任务，并用 `project-ops/CONTEXT-ROUTER.md` 选择按需资料。

## 本地启动

- 环境与 Docker：`project-ops/runbooks/LOCAL-RUNTIME.md`
- 并发 worktree：`project-ops/runbooks/WORKTREES.md`
- 开发与合并：`project-ops/DEVELOPMENT-WORKFLOW.md`
- 当前开发队列：`project-ops/NEXT-DEVELOPMENT-QUEUE.md`
- 排程提示词：`project-ops/prompts/TASK-PLANNING-PROMPT.md`
- 执行提示词：`project-ops/prompts/IMPLEMENTATION-PROMPT.md`
- 审查提示词：`project-ops/prompts/REVIEW-PROMPT.md`

旧 `orchestration/` 已不再是有效入口；历史副本只保存在归档中。
