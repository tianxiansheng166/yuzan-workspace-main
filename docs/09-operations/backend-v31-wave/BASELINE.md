# B31-001 基线复核报告

## 复核环境

- 执行时间：2026-07-11
- 执行者：Trae-1（Windows 物理机总控）
- 仓库：`D:\program\test_program\yuzanxinsheng\three\yuzan-next`
- 复核 worktree：`worktrees\windows-product-function-convergence-001`
- PostgreSQL：127.0.0.1:55432
- MinIO：127.0.0.1:59000 / 59001
- Node：24.18.0
- pnpm：10.13.1

## 基线来源

- 源分支：`task/windows-product-function-convergence-001`
- 源精确提交：`22e3e1443bf82cf3d5b9b14c3de606126ece5e39`
- 提交信息：`fix(baseline): stabilize Windows backend vertical slice for B31-001 review`
- Remote synchronized：是（`origin/task/windows-product-function-convergence-001` 与本地 HEAD 一致）
- 集成基线分支：`integration/windows-backend-v31-base-20260711`
- 集成基线精确提交：`22e3e1443bf82cf3d5b9b14c3de606126ece5e39`

## 复核项与结果

| 复核项 | 结果 | 证据 |
|--------|------|------|
| 单一 Pool | 通过 | `apps/api/src/shared/database/database.module.ts` 使用 `useFactory` 单例 `PrismaService` |
| 单一 Prisma Client | 通过 | 仅 `PrismaService` 实例化 `@yuzan/database` PrismaClient，全局模块导出 |
| Startup / Shutdown | 通过 | `PrismaService` 实现 `OnModuleInit` / `OnModuleDestroy` |
| Refresh Rotation | 通过 | `apps/api/src/modules/identity/` 中 refresh token 轮换持久化 |
| Refresh Replay 保护 | 通过 | refresh token 单次使用，旧 token 失效 |
| Active Membership | 通过 | 中间件/守卫校验 membership status = `ACTIVE` |
| Active School | 通过 | Tenant 上下文过滤 `deletedAt IS NULL` 且 status 有效 |
| Deleted School 过滤 | 通过 | 所有学校级查询带 `deletedAt` 过滤 |
| Tenant Fail Closed | 通过 | 无 active school 上下文时拒绝访问 |
| Course Draft School Scope | 通过 | `CurriculumModule` 中 course draft CRUD 绑定 `schoolId` + `authorUserId` |
| Author Validation | 通过 | update/publish 操作校验当前用户为 author 或具备课程治理权限 |
| Atomic Concurrency | 通过 | course draft update 使用 `version` 条件更新，冲突返回 409 |
| Error Sanitization | 通过 | `database.errors.ts` 中 `sanitizeDriverError` 不返回 SQL/host/schema/token |
| OpenAPI Consistency | 通过 | 现有契约与 `packages/contracts/openapi/` 一致 |
| PostgreSQL Integration Tests | 通过 | `apps/api/test/database/database-runtime.integration.spec.ts` 通过 |
| Identity Repository Tests | 通过 | `apps/api/test/integration/identity/prisma-identity.repository.spec.ts` 通过 |
| API Health | 通过 | `HealthModule` 暴露 `/health` |

## 关键修复（相对于原始实现）

1. **测试清理顺序**：调整 `database-runtime.integration.spec.ts` 与 `prisma-identity.repository.spec.ts` 的表清理顺序，先删除依赖 `User`/`School` 的外键表（`CourseVersion`、`Course` 等），避免外键约束冲突。
2. **测试并发控制**：`apps/api/package.json` 的 test 脚本增加 `--pool=forks --poolOptions.forks.singleFork`，确保集成测试顺序执行，避免共享数据库状态竞争。

## 测试命令

```powershell
# 在 apps/api 目录执行
pnpm test
```

当前测试策略：顺序执行，覆盖数据库 runtime、identity repository、课程垂直切片。

## 基线可用性

- 是否允许作为后续 base：**允许**
- 五个任务分支已从此 exact commit 创建：是
- 任务分支均已推送 origin：是
- 后续开发不得回退到此基线之前的提交。
