# 开发、审查与集成流程

## 分支职责

- `main`：已验证、可部署基线，不直接开发；
- `integration/<mvp>`：同一时间只保留一条活动集成线；
- `task/<id>-<slug>`：单个纵向任务；
- `hotfix/<id>`：生产紧急修复。

## 任务开始

任务 JSON 必须包含：用户旅程、依赖、`base_commit`、`allowed_paths`、共享文件请求、测试范围、合并顺序和回滚方式。依赖 API/schema 的前端任务只能基于已冻结的契约提交开工。

## 并发边界

- 每个任务使用 `../worktrees/<task-id>`；
- OpenAPI、Prisma、根依赖、CI、全局路由和 UI token 采用单写者；
- 两个任务需要同一共享文件时，先创建共享前置任务；
- 功能 owner 运行局部测试，集成负责人按合并窗口运行全量检查，避免每个小任务重复全仓审计。

## 合并节奏

1. 任务 owner 提交可运行的小检查点和 handoff。
2. Reviewer 做风险对应审查，不代替 owner 大范围返工。
3. Integration Lead 按依赖顺序合并：共享事实 → 后端提供者 → 前端消费者 → E2E。
4. 集成失败时用新修复提交恢复，不重写共享历史。
5. 验证完成后更新 `CURRENT.md`，再删除任务 worktree。
