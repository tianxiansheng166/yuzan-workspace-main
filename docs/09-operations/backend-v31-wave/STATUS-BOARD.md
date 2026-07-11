# Backend V3.1 Wave 状态看板

> 最后更新：2026-07-11

## 基线状态

| 项目 | 状态 | 备注 |
|------|------|------|
| B31-001 复核 | 完成 | 全部通过，详见 [BASELINE.md](./BASELINE.md) |
| 基线分支 | 已推送 | `integration/windows-backend-v31-base-20260711` @ `22e3e1443bf82cf3d5b9b14c3de606126ece5e39` |
| 任务分支 | 已推送 | 5 个任务分支均已创建并推送 origin |
| Worktree | 已创建 | 5 个任务 worktree 已创建 |

## 任务状态

| 任务 ID | 角色 | 分支 | 状态 | 本地 HEAD | 远程 HEAD | 备注 |
|---------|------|------|------|-----------|-----------|------|
| b31-105 | Trae-1 | `task/b31-105-platform-contracts-reporting` | IN_PROGRESS | `4bcea5f` | `4bcea5f` | Schema/contract/reporting/offline/operations implementation |
| b31-101 | Trae-2 | `task/b31-101-teaching-loop` | READY | `22e3e14` | `22e3e14` | 等待启动 |
| b31-102 | Trae-3 | `task/b31-102-assessment-loop` | READY | `22e3e14` | `22e3e14` | 等待启动 |
| b31-103 | Trae-4 | `task/b31-103-admin-products` | READY | `22e3e14` | `22e3e14` | 等待启动 |
| b31-104 | Trae-5 | `task/b31-104-volunteer-tools-community` | READY | `22e3e14` | `22e3e14` | 等待启动 |

## Schema Request 队列

| 任务 | 请求文件 | 状态 | 影响范围 | 处理人 |
|------|----------|------|----------|--------|
| b31-105 | 内部实现 | APPLIED | ReportType/ReportStatus/SyncBatchStatus 枚举 + Report/OfflineContentPackage/SyncBatch 表 | Trae-1 |

## Contract Request 队列

| 任务 | 请求文件 | 状态 | 影响范围 | 处理人 |
|------|----------|------|----------|--------|
| b31-105 | 内部实现 | APPLIED | Reporting/Offline/Operations 共 11 个新 endpoint | Trae-1 |

## 阻塞问题

| 问题 | 影响任务 | 状态 | 负责人 |
|------|----------|------|--------|
| 无 | - | - | - |

## 下一步行动

1. Trae-1 完成总控文档创建并 push；
2. Trae-2 ~ Trae-5 各自在 worktree 中阅读对应 prompt 并开始开发；
3. 各任务按 [DEPENDENCY-GRAPH.md](./DEPENDENCY-GRAPH.md) 提交 schema/contract request；
4. Trae-1 分批处理共享变更，更新本看板。

## 更新规则

- 每次共享文件变更后更新 Schema/Contract Request 队列；
- 每次任务状态变化（READY → IN_PROGRESS → REVIEW → DONE）更新任务状态表；
- 出现阻塞问题时立即登记；
- 由 Trae-1 维护本文件。
