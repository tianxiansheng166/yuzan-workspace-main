# 集成顺序与验收 Gates

## 集成原则

1. 只有 Trae-1 作为 integration controller 可以执行跨任务合并；
2. 合并前必须通过代码审查、测试和 contract/schema 一致性检查；
3. 禁止 force push 到 `integration/*` 分支；
4. 每次集成必须产生可追踪的 merge commit；
5. 集成失败时回滚到上一个稳定 exact commit。

## 集成目标分支

- 阶段集成：`integration/windows-backend-v31-base-20260711`
- 最终集成：按后续总体规划确定（当前 wave 不直接合并到 main）

## 集成 Wave 顺序

### Wave 1：核心教学/测评/管理

1. **b31-101（教学闭环）** → 提交 PR/MR 到 Trae-1
2. **b31-102（测评闭环）** → 提交 PR/MR 到 Trae-1
3. **b31-103（管理端治理）** → 提交 PR/MR 到 Trae-1

验收 gates：

- [ ] 所有单元测试通过
- [ ] 所有 repository 测试通过
- [ ] 所有 API 测试通过
- [ ] 权限测试覆盖 tenant-negative 场景
- [ ] 状态机测试覆盖全部状态转换
- [ ] 错误信息已脱敏
- [ ] 已提交 schema/contract request（如需要）
- [ ] 本地 HEAD = 远程 HEAD
- [ ] clean worktree

### Wave 2：志愿者、工具、社区、平台补充

4. **b31-104（志愿者工具社区）** → 提交 PR/MR 到 Trae-1
5. **b31-105 共享层补充** → Trae-1 内部审查

验收 gates：

- Wave 1 全部 gates；
- 与 b31-103 的 admin config 无冲突；
- 与 b31-105 共享 schema/contract 同步。

### Wave 3：报表、离线、全量联调

6. **b31-105 报表/离线实现** → 集成所有业务数据
7. **全量 PostgreSQL 集成测试**
8. **MinIO 边界测试**
9. **前端 V3.1 联调**

验收 gates：

- 全部测试通过；
- OpenAPI 与实现一致；
- 无 TODO/fixture 冒充完成；
- 敏感数据未泄露；
- 错误信息已脱敏。

## 集成步骤（Trae-1 执行）

### Step 1：接收合并请求

各任务完成后，在各自 worktree 中：

```powershell
git push origin task/b31-xxx-xxxxxx
```

然后通知 Trae-1。

### Step 2：Trae-1 审查

在 `b31-105` worktree 中：

```powershell
git fetch origin
git log --left-right --graph --cherry-pick --oneline task/b31-105-platform-contracts-reporting...origin/task/b31-xxx-xxxxxx
```

检查：

- 是否只修改了 allowed paths；
- 是否误改共享文件；
- 测试是否真实运行；
- commit message 是否规范。

### Step 3：合并共享变更

如需 schema/contract 变更：

1. 在 `b31-105` 应用变更；
2. 生成 migration / 更新 generated code；
3. 通知相关任务 rebase。

### Step 4：执行合并

```powershell
git checkout integration/windows-backend-v31-base-20260711
git merge --no-ff origin/task/b31-xxx-xxxxxx -m "integrate(b31-xxx): <description>"
git push origin integration/windows-backend-v31-base-20260711
```

### Step 5：更新状态

- 更新 `STATUS-BOARD.md`；
- 记录集成的 exact commit；
- 通知前端联调。

## 回滚策略

如果集成后测试失败：

```powershell
git checkout integration/windows-backend-v31-base-20260711
git reset --hard <last-stable-exact-commit>
git push origin integration/windows-backend-v31-base-20260711 --force-with-lease
```

> 注意：仅允许在 integration 分支上使用 `reset --hard` 回滚，且必须记录回滚原因。任务分支不得 force push。

## 集成完成定义

- `integration/windows-backend-v31-base-20260711` 包含所有 wave 的 merge commit；
- 全量测试通过；
- OpenAPI 与实现一致；
- 所有任务本地 HEAD = 远程 HEAD；
- 无未解决的阻塞问题。
