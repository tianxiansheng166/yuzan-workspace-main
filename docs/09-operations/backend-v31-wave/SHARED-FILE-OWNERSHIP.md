# 共享文件唯一所有权

## 原则

为避免五个 Trae 并发修改同一文件导致冲突和集成失败，以下共享文件由 **Trae-1（平台/集成总控）独占**。其他角色需要变更时，必须提交变更请求，由 Trae-1 审核后统一应用。

## Trae-1 独占文件

| 文件/目录 | 说明 |
|-----------|------|
| `infra/database/prisma/schema.prisma` | 唯一数据库模型定义 |
| `infra/database/prisma/migrations/**` | 数据库迁移文件 |
| `packages/contracts/openapi/**` | OpenAPI 契约文件 |
| `packages/contracts/src/generated*` | 生成的契约代码 |
| `backend/api/src/app.module.ts` | 根模块 wiring |
| `backend/api/src/main.ts` | 应用入口 |
| `backend/api/src/shared/database/**` | 共享数据库 runtime |
| `backend/api/src/common/**` | 共享通用代码（guard、filter、interceptor 等） |
| `package.json` | 根依赖与脚本 |
| `pnpm-lock.yaml` | 依赖锁定文件 |

## 变更请求流程

### 1. 需要 schema 变更时

在各自分支创建：

```text
docs/09-operations/backend-v31-change-requests/<task-id>-schema-request.md
```

必须包含：

- 所需实体/字段及用途
- 字段类型、默认值、是否可空
- 约束（unique、foreign key、check）
- 索引及理由
- 向后兼容性说明
- 关联的 migration 需求
- 测试需求

### 2. 需要 contract 变更时

在各自分支创建：

```text
docs/09-operations/backend-v31-change-requests/<task-id>-contract-request.md
```

必须包含：

- endpoint path / method
- request DTO（字段、校验规则）
- response DTO（成功/错误）
- 错误码列表
- 权限要求
- 是否新增或修改现有 endpoint
- 向后兼容性说明

### 3. Trae-1 处理流程

1. 在 `b31-105` worktree 查看请求文件；
2. 评估对 schema、contracts、root wiring、其他任务的影响；
3. 必要时请求修改；
4. 统一修改共享文件，生成 migration / 更新 generated code；
5. 提交到 `task/b31-105-platform-contracts-reporting`；
6. 普通 push；
7. 在 STATUS-BOARD.md 记录变更；
8. 通知依赖任务重新 rebase。

## 禁止行为

- 任何 worker 直接修改 `schema.prisma`；
- 任何 worker 直接修改 `app.module.ts` 增加模块导入；
- 任何 worker 直接修改 `pnpm-lock.yaml`；
- 任何 worker 在共享目录中创建同名文件绕过所有权；
- 未提交变更请求就实现依赖共享文件的功能。

## 共享文件变更通知

每次 Trae-1 应用共享变更后，必须：

1. 更新 `STATUS-BOARD.md`；
2. 更新 `MIGRATION-ORDER.md`（如涉及 schema）；
3. 更新 `API-FREEZE.md`（如涉及 contract）；
4. 通知相关任务负责人 rebase 到最新 `task/b31-105-platform-contracts-reporting`。
