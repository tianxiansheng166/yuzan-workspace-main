# BRANCH-INVENTORY: 分支与 worktree 清单

> 生成时间：2026-07-09  
> 来源命令：`git branch -vv` 和 `git worktree list`

## 本地分支

```text
* chore/repository-bootstrap-20260709  7997188  GOV-003: 冻结 Prisma MVP 数据模型
  main                                 7997188  GOV-003: 冻结 Prisma MVP 数据模型
+ task/gov-001-governance             fa0d7e0  (/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-001)  GOV-001: 初始化 monorepo 与开发环境基线
+ task/gov-002-contract               2496f59  (/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-002)  GOV-002: freeze OpenAPI v1 contract baseline
+ task/gov-003-database               7997188  (/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-003)  GOV-003: 冻结 Prisma MVP 数据模型
+ task/gov-004-design-system          2f02b87  (/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-004)  feat: establish GOV-004 design tokens and primitives
+ task/mig-001-migration              56a8b76  (/home/admin01/Documents/yuzan-workspace-main/worktrees/mig-001)  feat(migration): audit legacy assets for MIG-001
```

## worktree 列表

```text
/home/admin01/Documents/yuzan-workspace-main/yuzan-next         7997188  [chore/repository-bootstrap-20260709]
/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-001  fa0d7e0  [task/gov-001-governance]
/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-002  2496f59  [task/gov-002-contract]
/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-003  7997188  [task/gov-003-database]
/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-004  2f02b87  [task/gov-004-design-system]
/home/admin01/Documents/yuzan-workspace-main/worktrees/mig-001  56a8b76  [task/mig-001-migration]
```

## 说明

- `+` 表示该分支已关联 worktree。
- `chore/repository-bootstrap-20260709` 是本次迁移/运营资料提交专用的临时分支。
- GOV-002 分支 (`2496f59`) 与 main (`7997188`) 不同，说明尚未合并。
- MIG-001 分支 (`56a8b76`) 与 main 不同，说明尚未合并。
- 物理机 clone 后应独立创建自己的 worktree，不得直接复用上述虚拟机路径。
