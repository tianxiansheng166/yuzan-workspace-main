# 任务领取规则

## 一次一个主任务

一个 AI 一次只能主领一个 `IN_PROGRESS` 任务。代码审查可以并行，但不得同时“顺手实现”第二个功能。

## 领取步骤

1. 在 `task-board.csv` 找 `READY`。
2. 打开 `tasks/<ID>.json`。
3. 检查 `depends_on`。
4. 创建 `task/<id>-<slug>` 分支和独立 worktree。
5. 将任务状态改为 `CLAIMED` 的操作由 Integration Lead 执行。
6. 记录 owner、模型/工具、基线 commit、预计结束时间。

## 冲突预防

- 任务按 feature directory 划分；
- shared owner 单独处理契约；
- UI 和 API 可以基于 mock 并行；
- 同一业务切片由 Integration Lead 安排 API→Web 或明确接口冻结点；
- 发现多个任务需要同一文件时，先拆出共享前置任务。

## 超时与释放

超过约定时间无可审查产物：

- owner 提交 WIP 和交接；
- 任务回到 `READY`；
- 新 owner 从已提交 commit 继续；
- 不保留只存在于聊天里的关键决策。
