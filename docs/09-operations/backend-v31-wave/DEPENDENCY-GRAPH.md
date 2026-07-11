# 任务依赖图

## 概述

本图描述 Backend V3.1 五个任务之间的依赖关系。依赖方向表示：下游任务需要上游任务产出的 schema、contract 或共享模块才能正确实现。

## 任务节点

- `b31-001`：Windows 后端基线复核（已完成）
- `b31-101`：教学闭环（Trae-2）
- `b31-102`：测评闭环（Trae-3）
- `b31-103`：管理端与产品治理（Trae-4）
- `b31-104`：志愿者、工具、社区与合作（Trae-5）
- `b31-105`：平台、Contracts、共享基础、报表/离线、集成总控（Trae-1）

## 依赖关系

```text
b31-001
  ├── b31-101 (teaching-loop)
  ├── b31-102 (assessment-loop)
  ├── b31-103 (admin-products)
  ├── b31-104 (volunteer-tools-community)
  └── b31-105 (platform-contracts-reporting)

b31-105
  ├── provides schema → b31-101, b31-102, b31-103, b31-104
  ├── provides contracts → b31-101, b31-102, b31-103, b31-104
  ├── provides shared modules → all
  └── integrates → all

b31-101 → b31-102
  (submission/learning data feeds assessment reports)

b31-102 → b31-103
  (assessment content/dimensions/rules managed by admin)

b31-101 → b31-103
  (class/assignment data managed by admin)

b31-103 → b31-104
  (volunteer qualification, support pairing, product plans require admin config)

b31-101 → b31-105
  (reporting/offline consumes learning/submission data)

b31-102 → b31-105
  (reporting consumes assessment/growth data)

b31-104 → b31-105
  (offline/content package reporting consumes volunteer/community data)
```

## 关键依赖说明

### 1. Schema 依赖

所有任务都依赖 `b31-105` 维护的 `schema.prisma`。各任务在开发前必须确认：

- 已有模型是否满足需求；
- 如不满足，已提交 schema request 并由 Trae-1 应用。

### 2. Contract 依赖

- `b31-101` 的教学闭环 API 会被 `b31-102` 的测评报告引用；
- `b31-102` 的测评 API 会被 `b31-103` 的管理端配置引用；
- `b31-103` 的管理端 API 会被 `b31-104` 的志愿者资格/套餐引用；
- `b31-105` 的报表/离线 API 会消费所有业务域数据。

### 3. 共享模块依赖

- `DatabaseModule`、`PrismaService`、`TenantContext`、`AuthGuard` 等由 `b31-105` 维护；
- 所有任务必须复用这些模块，不得自行创建第二套实现。

## 并行策略

### Wave 1（优先并行）

- `b31-101`
- `b31-102`
- `b31-103`

这三路可在基线确认后同时启动，因为它们的 schema request 可由 Trae-1 分批次处理。

### Wave 2（次优先并行）

- `b31-104`
- `b31-105` 的共享层补充

`b31-104` 依赖 `b31-103` 的部分配置（如套餐、学校合作审核），但核心志愿者/培训模块可独立启动。

### Wave 3（集成）

- `b31-105` 的报表/离线/联调
- 全量集成测试
- 前端 V3.1 联调

## 依赖冲突解决

若两个任务需要修改同一共享概念（如 `Assignment` 状态机）：

1. 双方先在各自分支提交 schema/contract request；
2. Trae-1 统一设计后应用到 `b31-105`；
3. 双方 rebase 到最新 `b31-105`；
4. 如果存在业务逻辑冲突，由 Trae-1 召集双方确认状态机。
