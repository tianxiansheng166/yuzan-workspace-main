# MULTI-MACHINE-PLAYBOOK: 多机器协作手册

## 1. GitHub 是跨机器唯一交换中心

- 所有代码、分支、tag 和运营文档通过 GitHub 同步。
- 不允许通过 U 盘、聊天窗口、邮件附件或共享文件夹传递代码 patch。

## 2. 每台机器独立 clone

- 物理机执行：`git clone git@github.com:tianxiansheng166/yuzan-workspace-main.git`
- 不要在虚拟机与物理机之间直接复制 `.git` 目录或 worktree。

## 3. 每台机器独立创建 worktree

- 使用本仓库的 `orchestration/scripts/bootstrap_worktree.sh` 或独立 `git worktree add`。
- 物理机的 worktree 路径由物理机自行决定，不得直接复用虚拟机路径。

## 4. 不复制虚拟机 worktree 到物理机

- worktree 是本地执行环境，不是版本管理内容。
- 物理机只拉取分支，然后在本机重建 worktree。

## 5. 一个任务只能有一个 owner

- 每个任务在 `TASK-REGISTRY.yaml` 中登记唯一的 `ownerMachine` 和 `ownerAgent`。
- 任务 owner 变更必须通过提交更新 `TASK-REGISTRY.yaml`。

## 6. 一个分支同一时间只能由一台机器写

- 任务 owner 在开始工作前，确认远程该分支无他人未合并的更新。
- 若发现冲突，先沟通再 rebase，禁止普通 force push 覆盖他人提交。

## 7. 开发 AI 不直接操作 main

- 任何 AI 不得在任务分支之外向 main 推送代码。
- 集成操作由 VM-UBUNTU 上的集成总控执行。

## 8. main 只由 VM 集成总控合并

- 合并方式：fast-forward only（`git merge --ff-only`）。
- 合并前必须确认 main 干净、任务分支干净、验证命令已执行。

## 9. 所有任务完成后 push

- 任务分支上的 commit 必须完整、可验证。
- push 前运行该任务要求的验证命令并记录结果。

## 10. 远程分支已被其他机器使用后不得普通 force push

- 若物理机已 push 到远程 task 分支，虚拟机再需修改时必须先 `git fetch` 并 rebase。
- 严禁 `git push --force` 覆盖远程已有提交。

## 11. 修改审查优先新 commit

- 审查反馈通过新增 commit 解决，不 amend 已 push 的提交。
- 只有在本地未 push 时，才允许 amend/squash 以整理历史。

## 12. 最终集成前 rebase 最新 main

- 任务分支合并前必须 rebase 到最新 main。
- rebase 后重新运行验证命令。

## 13. 验证通过后 fast-forward 合并

- 验证通过、审查通过后，由 VM-UBUNTU 执行 `git merge --ff-only`。
- 合并后立即 push main，并更新 `TASK-REGISTRY.yaml`。
