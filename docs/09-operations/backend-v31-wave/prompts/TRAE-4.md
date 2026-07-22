# Trae-4 Prompt：管理端、课程治理、测评配置、推荐规则、套餐与隐私审计

## 你是谁

你是本轮后端开发的 Trae-4，运行在 Windows 物理机。你负责实现管理端核心功能：学校管理、用户角色、课程治理、测评内容配置、推荐规则、产品套餐、隐私与审计。

## 你的环境

- 仓库：`D:\program\test_program\yuzanxinsheng\three\yuzan-next`
- 你的 worktree：`D:\program\test_program\yuzanxinsheng\three\worktrees\b31-103`
- 你的分支：`task/b31-103-admin-products`
- 基线 commit：`22e3e1443bf82cf3d5b9b14c3de606126ece5e39`
- PostgreSQL：`127.0.0.1:55432`
- MinIO：`127.0.0.1:59000`（API）/ `59001`（Console）
- Node：`24.18.0`
- pnpm：`10.13.1`

## 允许修改的路径

```text
backend/api/src/modules/admin/**
backend/api/src/modules/curriculum-governance/**
backend/api/src/modules/product-plans/**
backend/api/src/modules/privacy/**
backend/api/src/modules/audit/**
backend/api/test/modules/admin/**
backend/api/test/modules/curriculum-governance/**
backend/api/test/modules/product-plans/**
backend/api/test/modules/privacy/**
backend/api/test/modules/audit/**
```

## 禁止修改的路径

不得直接修改共享文件。需要变更时提交 request 到：

```text
docs/09-operations/backend-v31-change-requests/b31-103-schema-request.md
docs/09-operations/backend-v31-change-requests/b31-103-contract-request.md
```

禁止修改其他 Trae 负责的业务模块：

```text
backend/api/src/modules/classes/**
backend/api/src/modules/assignments/**
backend/api/src/modules/learning/**
backend/api/src/modules/submissions/**
backend/api/src/modules/feedback/**
backend/api/src/modules/assessment/**
backend/api/src/modules/recommendations/**
backend/api/src/modules/speech/**
backend/api/src/modules/reports/**
backend/api/src/modules/volunteers/**
backend/api/src/modules/training/**
backend/api/src/modules/support-pairings/**
backend/api/src/modules/tools/**
backend/api/src/modules/translations/**
backend/api/src/modules/community/**
backend/api/src/modules/cooperation/**
backend/api/src/modules/operations/**
backend/api/src/modules/offline/**
backend/api/src/modules/reporting/**
```

也禁止修改：

```text
infra/database/prisma/schema.prisma
infra/database/prisma/migrations/**
packages/contracts/openapi/**
packages/contracts/src/generated*
backend/api/src/app.module*
backend/api/src/main*
backend/api/src/shared/database/**
backend/api/src/common/**
package.json
pnpm-lock.yaml
```

## 核心任务

基于 `03-domains/04-ADMIN-GOVERNANCE.md` 和 `03-domains/07-PRODUCTS-COMMUNITY-SUPPORT.md`，实现：

### 1. Admin Dashboard

- 学校数、活跃用户、课程发布、测评任务、学习完成、provider 状态、系统错误、待审核聚合；
- 不得每次扫描全表；使用授权聚合查询或快照。

### 2. 学校管理（Admin Schools）

- 学校创建、更新、启停、归档；
- 套餐订阅；
- 学段、管理员、课程授权；
- 使用统计；
- 不允许硬删除已有业务学校。

### 3. 用户与角色（Admin Users/Roles）

- 邀请、批量导入；
- membership、role、status；
- 撤销会话；
- 不返回密码字段。

### 4. 课程治理（Curriculum Governance）

- 课程版本列表；
- 提交审核、`CHANGES_REQUESTED`、approve、publish、retire/archive；
- ResourceRef rights；
- 双语审核状态；
- 审核历史。

### 5. 测评内容配置（Admin Assessment Content）

- reading material、written form、dimensions；
- material version；
- preview、publish/archive。

### 6. 推荐规则（Admin Recommendation Rules）

- `issueCode + dimension + severity range → courseVersion + priority + sessions + reason template`；
- 支持有效期、版本、冲突检测；
- 草稿与发布；
- 不允许两个同优先级规则无确定顺序。

### 7. 测评链接管理（Admin Assessment Links）

- 查看任务链接、停用、到期、使用次数；
- 不显示完整历史 token；
- 重新生成需要审计。

### 8. 产品套餐（Admin Product Plans）

- 普惠版 / 专业版 / 旗舰版；
- 价格区间、折扣系数、服务项、资金来源；
- 公开展示版本；
- 合同版本与公开页面解耦；
- 金额存整数最小货币单位，不使用 float。

### 9. 隐私审计（Admin Privacy Audit）

- retention policies；
- consent versions；
- data deletion requests；
- audit search；
- provider calls；
- sensitive access。

### 10. 系统 Provider 配置（Admin System Providers）

- 只保存 provider type、enabled、endpoint alias、model、health、configured flag、last check；
- 秘密必须来自 secret store/env，不从 API 返回。

## 必须遵守的标准

- 管理端 endpoint 以 `/api/v1/admin/...` 或 `/api/v1/schools/{schoolId}/admin/...` 形式存在；
- 平台级管理需要 `PLATFORM_ADMIN`；
- 学校级管理需要 `SCHOOL_ADMIN` 或更高；
- 不得泄露密码、secret、对象存储内部路径；
- 可编辑资源使用乐观并发；
- 审计日志记录敏感操作。

## 需要 schema/contract 时

创建：

```text
docs/09-operations/backend-v31-change-requests/b31-103-schema-request.md
docs/09-operations/backend-v31-change-requests/b31-103-contract-request.md
```

必须包含实体/字段、约束、索引、endpoint、DTO、错误码、权限、测试需求、向后兼容性。

## 测试要求

- unit tests；
- repository tests（真实 PostgreSQL）；
- API tests；
- permission tests（平台管理员 vs 学校管理员 vs 教师）；
- state transition tests（课程版本状态机、套餐发布状态）；
- audit log tests；
- error sanitization tests。

运行测试：

```powershell
pnpm --filter @yuzan/api test
```

## 完成定义

- admin / curriculum-governance / product-plans / privacy / audit 模块实现完整；
- 所有测试通过；
- 已提交必要的 schema/contract request；
- 本地 HEAD = 远程 HEAD；
- clean worktree；
- 无阻塞问题。

## 报告格式

完成时返回：

```text
Trae-4 READY
branch: task/b31-103-admin-products
worktree: D:\program\test_program\yuzanxinsheng\three\worktrees\b31-103
local HEAD: <commit>
remote HEAD: <commit>
tests: <count> passed
schema requests: <list or none>
contract requests: <list or none>
blocking issues: <list or none>
```
