# Backend V3.1 Five-Trae Dispatch

> 总控文档入口。用于协调五个 Trae 角色在 Windows 物理机上的真实并发后端开发。

## 目标

基于 `yuzan-backend-development-pack-v3.1` 和已通过 B31-001 复核的 Windows 后端基线，建立五个互不冲突的任务分支/工作树，并生成可直接分发给各角色的 worker prompts。

## 当前基线

- 源分支：`task/windows-product-function-convergence-001`
- 精确提交：`22e3e1443bf82cf3d5b9b14c3de606126ece5e39`
- 集成基线分支：`integration/windows-backend-v31-base-20260711`
- 复核报告：见 [BASELINE.md](./BASELINE.md)

## 任务速览

| 角色 | 任务分支 | Worktree | 负责域 |
|------|----------|----------|--------|
| Trae-1 | `task/b31-105-platform-contracts-reporting` | `worktrees/b31-105` | 平台、Schema、Contracts、共享基础、报表/离线、集成总控 |
| Trae-2 | `task/b31-101-teaching-loop` | `worktrees/b31-101` | 教师任务—学生学习—提交反馈闭环 |
| Trae-3 | `task/b31-102-assessment-loop` | `worktrees/b31-102` | AI 智能测评、报告、推荐和复测闭环 |
| Trae-4 | `task/b31-103-admin-products` | `worktrees/b31-103` | 管理端、课程治理、测评配置、推荐规则、套餐与隐私审计 |
| Trae-5 | `task/b31-104-volunteer-tools-community` | `worktrees/b31-104` | 志愿者培训、服务、一对一帮扶、MindMate、MindGraph、藏汉翻译、社区和合作申请 |

## 文档索引

- [BASELINE.md](./BASELINE.md)：基线复核结果与测试证据
- [TASK-LOCKS.json](./TASK-LOCKS.json)：任务分配、分支、worktree、允许路径
- [SHARED-FILE-OWNERSHIP.md](./SHARED-FILE-OWNERSHIP.md)：共享文件唯一所有权与变更请求流程
- [DEPENDENCY-GRAPH.md](./DEPENDENCY-GRAPH.md)：任务间依赖关系
- [MIGRATION-ORDER.md](./MIGRATION-ORDER.md)：Schema 变更与迁移顺序
- [API-FREEZE.md](./API-FREEZE.md)：API 冻结规则与版本控制
- [STATUS-BOARD.md](./STATUS-BOARD.md)：各任务实时状态看板
- [INTEGRATION-ORDER.md](./INTEGRATION-ORDER.md)：代码集成顺序与验收 gates
- [prompts/](./prompts/)：五个 Trae 角色的详细工作提示

## 关键约束

1. 只有 Trae-1 能直接修改共享文件（schema、contracts、root wiring 等）。
2. 其他角色需要共享变更时，必须提交 `docs/09-operations/backend-v31-change-requests/<task-id>-schema-request.md` 或 `<task-id>-contract-request.md`。
3. 所有学校级数据必须经过 Authentication → Tenant → Policy → Domain 四层授权。
4. 不得用 TODO、fixture、内存仓库或 demo gateway 冒充完成。
5. 所有集成测试必须在真实 PostgreSQL `127.0.0.1:55432` 和 MinIO `127.0.0.1:59000` 上通过。
6. 普通 push，禁止 force push/amend 已推送提交。

## 使用流程

1. 各角色先阅读本 README 和对应 `prompts/TRAE-N.md`。
2. 在各自 worktree 中开发，遵守 `allowed_paths`。
3. 需要共享文件变更时，按 [SHARED-FILE-OWNERSHIP.md](./SHARED-FILE-OWNERSHIP.md) 提交 request。
4. Trae-1 审核 request，统一在 `b31-105` 分支应用共享变更。
5. 各任务完成后按 [INTEGRATION-ORDER.md](./INTEGRATION-ORDER.md) 提交合并。
