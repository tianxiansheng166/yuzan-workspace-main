# Trae-2 Prompt：教师任务—学生学习—提交反馈闭环

## 你是谁

你是本轮后端开发的 Trae-2，运行在 Windows 物理机。你负责实现教师班级、任务布置、学生学习、提交和教师反馈的完整闭环。

## 你的环境

- 仓库：`D:\program\test_program\yuzanxinsheng\three\yuzan-next`
- 你的 worktree：`D:\program\test_program\yuzanxinsheng\three\worktrees\b31-101`
- 你的分支：`task/b31-101-teaching-loop`
- 基线 commit：`22e3e1443bf82cf3d5b9b14c3de606126ece5e39`
- PostgreSQL：`127.0.0.1:55432`
- MinIO：`127.0.0.1:59000`（API）/ `59001`（Console）
- Node：`24.18.0`
- pnpm：`10.13.1`

## 允许修改的路径

```text
apps/api/src/modules/classes/**
apps/api/src/modules/assignments/**
apps/api/src/modules/learning/**
apps/api/src/modules/submissions/**
apps/api/src/modules/feedback/**
apps/api/test/modules/classes/**
apps/api/test/modules/assignments/**
apps/api/test/modules/learning/**
apps/api/test/modules/submissions/**
apps/api/test/modules/feedback/**
```

## 禁止修改的路径

不得直接修改共享文件。需要变更时提交 request 到：

```text
docs/09-operations/backend-v31-change-requests/b31-101-schema-request.md
docs/09-operations/backend-v31-change-requests/b31-101-contract-request.md
```

禁止修改其他 Trae 负责的业务模块：

```text
apps/api/src/modules/assessment/**
apps/api/src/modules/recommendations/**
apps/api/src/modules/speech/**
apps/api/src/modules/reports/**
apps/api/src/modules/admin/**
apps/api/src/modules/curriculum-governance/**
apps/api/src/modules/product-plans/**
apps/api/src/modules/privacy/**
apps/api/src/modules/audit/**
apps/api/src/modules/volunteers/**
apps/api/src/modules/training/**
apps/api/src/modules/support-pairings/**
apps/api/src/modules/tools/**
apps/api/src/modules/translations/**
apps/api/src/modules/community/**
apps/api/src/modules/cooperation/**
apps/api/src/modules/operations/**
apps/api/src/modules/offline/**
apps/api/src/modules/reporting/**
```

也禁止修改：

```text
infra/database/prisma/schema.prisma
infra/database/prisma/migrations/**
packages/contracts/openapi/**
packages/contracts/src/generated*
apps/api/src/app.module*
apps/api/src/main*
apps/api/src/shared/database/**
apps/api/src/common/**
package.json
pnpm-lock.yaml
```

## 核心任务

基于 `03-domains/01-TEACHING-LEARNING-LOOP.md`（若存在）或前端页面契约，实现：

### 1. 班级管理（Classes）

- 教师在 active school 下查看班级列表；
- 班级 CRUD（仅 SCHOOL_ADMIN / PLATFORM_ADMIN 可创建/修改）；
- 班级与学生 membership 关联；
- 已删除班级不得返回给普通教师。

### 2. 任务布置（Assignments）

- 教师创建任务：选择班级/学生、课程版本、截止时间；
- Assignment 状态机：`DRAFT → SCHEDULED → OPEN → CLOSED → CANCELLED → ARCHIVED`；
- 支持 `AssignmentTargetType = CLASS | STUDENT`；
- 仅当前班级/学生可见；
- 已关闭任务不允许新提交。

### 3. 学生学习（Learning）

- 学生查看分配给自己的任务；
- 进入课程版本学习活动；
- 记录 `ActivityProgress`；
- 学习数据按 school scope 隔离。

### 4. 提交（Submissions）

- 学生提交作业/录音/文本；
- Submission 状态机：`IN_PROGRESS → SUBMITTED → PROCESSING → NEEDS_REVIEW → REVIEWED → RETURNED → ACCEPTED`；
- 支持幂等提交（`Idempotency-Key`）；
- 上传通过 MinIO 签名 URL。

### 5. 反馈（Feedback）

- 教师查看待批改提交；
- 教师给出反馈：`ACCEPT` 或 `RETURN`；
- 反馈记录关联 submission；
- 学生查看反馈（仅自己提交）。

## 必须遵守的标准

- 所有学校级 endpoint 路径以 `/api/v1/schools/{schoolId}/...` 开头；
- 使用 `AuthenticationGuard → TenantAuthorizationGuard → Policy/role → Domain` 四层授权；
- 对无权访问的资源返回 404（不泄露存在性）；
- 可编辑资源使用 `version` 或 `updatedAt` 乐观并发；
- 错误信息脱敏；
- 不使用 fixture 或内存仓库冒充真实完成。

## 需要 schema/contract 时

创建：

```text
docs/09-operations/backend-v31-change-requests/b31-101-schema-request.md
docs/09-operations/backend-v31-change-requests/b31-101-contract-request.md
```

必须包含实体/字段、约束、索引、endpoint、DTO、错误码、权限、测试需求、向后兼容性。

## 测试要求

- unit tests；
- repository tests（真实 PostgreSQL）；
- API tests；
- permission tests（tenant-negative，如访问其他学校的班级）；
- state transition tests；
- error sanitization tests。

运行测试：

```powershell
pnpm --filter @yuzan/api test
```

## 完成定义

- classes / assignments / learning / submissions / feedback 模块实现完整；
- 所有测试通过；
- 已提交必要的 schema/contract request；
- 本地 HEAD = 远程 HEAD；
- clean worktree；
- 无阻塞问题。

## 报告格式

完成时返回：

```text
Trae-2 READY
branch: task/b31-101-teaching-loop
worktree: D:\program\test_program\yuzanxinsheng\three\worktrees\b31-101
local HEAD: <commit>
remote HEAD: <commit>
tests: <count> passed
schema requests: <list or none>
contract requests: <list or none>
blocking issues: <list or none>
```
