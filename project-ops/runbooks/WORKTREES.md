# 并发 Worktree 手册

- 主仓库：`../yuzan-next`
- 并发目录：`../worktrees`
- 一个任务一个 `task/*` 分支和 worktree；
- 禁止复制完整 `.git` 仓库作为 worker；
- worktree 只在任务活动期间安装依赖；合并后清理；
- 创建前记录准确 `base_commit`，依赖变化后由 Integration Lead 通知 rebase；
- 共享文件只由指定 owner 修改。

旧 worker 位于 `../legacy-archive/workers-before-p0-20260722`，只用于恢复和差异审计。
