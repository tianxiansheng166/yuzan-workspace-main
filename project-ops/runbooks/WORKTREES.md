# 并发 Worktree 手册

- 主仓库：`../yuzan-next`
- 并发目录：`../worktrees`
- 一个任务一个 `task/*` 分支和 worktree；
- 禁止复制完整 `.git` 仓库作为 worker；
- worktree 只在任务活动期间安装依赖；合并后清理；
- 创建前记录准确 `base_commit`，依赖变化后由 Integration Lead 通知 rebase；
- 共享文件只由指定 owner 修改。

## 合并与验看

worktree 只承担并行开发。任务达到可观察 checkpoint 即按
`DEVELOPMENT-WORKFLOW.md` 合入 integration，不需等待整个功能完成；integration 经硬化
后才提升到 `main`，而主目录是唯一默认启动位置。任务中间验证必须在 handoff 写明
worktree、branch、commit，且不得宣称为主目录最新版本。

旧 worker 位于 `../legacy-archive/workers-before-p0-20260722`，只用于恢复和差异审计。
