# CURRENT-STATE: 项目状态中心

> 更新于：2026-07-09  
> 记录依据：实际 Git 数据

## 当前 main HEAD

- `79971885933911630f651a84f90c7655759f7898`
- 提交信息：`GOV-003: 冻结 Prisma MVP 数据模型`

## 已合并任务

| 任务    | 分支                         | 合并提交  | 状态   |
| ------- | ---------------------------- | --------- | ------ |
| GOV-001 | `task/gov-001-governance`    | `fa0d7e0` | MERGED |
| GOV-003 | `task/gov-003-database`      | `7997188` | MERGED |
| GOV-004 | `task/gov-004-design-system` | `2f02b87` | MERGED |

## 尚未合并任务

| 任务    | 分支                     | 当前 commit                                | 状态                                   |
| ------- | ------------------------ | ------------------------------------------ | -------------------------------------- |
| GOV-002 | `task/gov-002-contract`  | `2496f59e00f735372af403498d8b831d1169c3c1` | REBASED_NOT_MERGED，等待最终契约修订   |
| MIG-001 | `task/mig-001-migration` | `56a8b76`                                  | NOT_MERGED，旧资产审计与脱敏导出进行中 |

## 已知验证结果

- `pnpm install --frozen-lockfile`：通过
- `pnpm db:generate`：通过
- `pnpm db:validate`：通过
- `pnpm typecheck`：通过
- `pnpm build`：通过
- `pnpm format:check` / `prettier --check`：通过
- `pnpm test` / `pnpm check`：失败，失败来源为 `@yuzan/contracts` 的 OpenAPI lint（18 errors / 16 warnings），属于 GOV-002 未合并的已知基线问题

## 已知基线问题

1. GOV-002 OpenAPI 契约存在 lint 错误，导致 `test`、`lint`、`check` 非零退出。
2. GOV-002 已 rebase 但未合并，不得在 GOV-002 完成前宣称 MVP 契约基线已冻结。
3. MIG-001 仍在进行中，旧资产脱敏导出结论尚未进入 main。

## 说明

- 本文件只记录事实，不修改任务内容。
- GOV-002 的合并状态必须以 main 分支实际包含其 commit 为准；当前 main 未包含 `2496f59`。
- MIG-001 的状态通过实际分支检查确认，未猜测。
