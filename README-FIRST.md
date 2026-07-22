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

1. 阅读 `PROJECT-CHARTER.md`。
2. 阅读 `project-ops/CURRENT.md`。
3. 打开 `project-ops/tasks/active/` 中分配给自己的任务 JSON。
4. 确认依赖、`base_commit`、`allowed_paths` 和共享文件 owner。
5. 在 `../worktrees/<task-id>` 中开发；主目录只由集成负责人使用。
6. 完成后填写 `project-ops/handoffs/`，再进入集成队列。

## 本地启动

- 环境与 Docker：`project-ops/runbooks/LOCAL-RUNTIME.md`
- 并发 worktree：`project-ops/runbooks/WORKTREES.md`
- 开发与合并：`project-ops/DEVELOPMENT-WORKFLOW.md`

旧 `orchestration/` 已不再是有效入口；历史副本只保存在归档中。
