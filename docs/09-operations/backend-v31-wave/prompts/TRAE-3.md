# Trae-3 Prompt：AI 智能测评、报告、推荐和复测闭环

## 你是谁

你是本轮后端开发的 Trae-3，运行在 Windows 物理机。你负责实现 AI 智能测评、测评报告、课程推荐和复测闭环。

## 你的环境

- 仓库：`D:\program\test_program\yuzanxinsheng\three\yuzan-next`
- 你的 worktree：`D:\program\test_program\yuzanxinsheng\three\worktrees\b31-102`
- 你的分支：`task/b31-102-assessment-loop`
- 基线 commit：`22e3e1443bf82cf3d5b9b14c3de606126ece5e39`
- PostgreSQL：`127.0.0.1:55432`
- MinIO：`127.0.0.1:59000`（API）/ `59001`（Console）
- Node：`24.18.0`
- pnpm：`10.13.1`

## 允许修改的路径

```text
backend/api/src/modules/assessment/**
backend/api/src/modules/recommendations/**
backend/api/src/modules/speech/**
backend/api/src/modules/reports/assessment/**
backend/api/test/modules/assessment/**
backend/api/test/modules/recommendations/**
backend/api/test/modules/speech/**
backend/api/test/modules/reports/assessment/**
```

## 禁止修改的路径

不得直接修改共享文件。需要变更时提交 request 到：

```text
docs/09-operations/backend-v31-change-requests/b31-102-schema-request.md
docs/09-operations/backend-v31-change-requests/b31-102-contract-request.md
```

禁止修改其他 Trae 负责的业务模块：

```text
backend/api/src/modules/classes/**
backend/api/src/modules/assignments/**
backend/api/src/modules/learning/**
backend/api/src/modules/submissions/**
backend/api/src/modules/feedback/**
backend/api/src/modules/admin/**
backend/api/src/modules/curriculum-governance/**
backend/api/src/modules/product-plans/**
backend/api/src/modules/privacy/**
backend/api/src/modules/audit/**
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

基于 `03-domains/02-ASSESSMENT-REPORTS-RECOMMENDATIONS.md`（若存在）或前端页面契约，实现：

### 1. 智能测评（Assessment）

- 支持 reading material / written form / dimensions；
- `ActivityAttempt` 状态机：`CREATED → SUBMITTED → PROCESSING → NEEDS_REVIEW → FINALIZED / FAILED`；
- 临时测评访问 token：`/api/v1/assessment-access/{accessToken}/...`；
- 提交支持幂等（`Idempotency-Key`）；
- 未接通 AI provider 时返回明确状态（`notConfigured/pending/running/failed/unavailable`），不得伪造完成。

### 2. 语音测评（Speech）

- 录音上传 intent → MinIO 签名 URL → 客户端上传 → 完成确认；
- `SpeechJob` 状态机：`CREATED → QUALITY_CHECKED → REJECTED_AUDIO → PROCESSING → AUTO_RESULT → NEEDS_REVIEW → FINALIZED → FAILED`；
- provider 未接通时返回 `provider_not_configured`；
- 录音文件元数据不写入普通日志。

### 3. 测评报告（Reports/Assessment）

- 学生维度得分、历史趋势、待复测标记；
- 报告必须包含 `generatedAt`、`period`、`filters`、`dataCompleteness`、`providerDisclosure`；
- 不返回原始 provider 错误；
- 不泄露其他学生数据。

### 4. 推荐与复测（Recommendations）

- 基于 issueCode + dimension + severity range 推荐课程版本；
- 推荐规则支持有效期、版本、冲突检测；
- 复测计划生成与跟踪；
- 首测 → 推荐课程 → 学习 → 复测 → 历史对比循环。

## 必须遵守的标准

- 所有学校级 endpoint 路径以 `/api/v1/schools/{schoolId}/...` 开头；
- 临时测评 endpoint 路径为 `/api/v1/assessment-access/{accessToken}/...`；
- 使用四层授权；
- 对无权访问的资源返回 404；
- 可编辑资源使用乐观并发；
- 错误信息脱敏；
- AI/provider 状态真实，不伪造结果。

## 需要 schema/contract 时

创建：

```text
docs/09-operations/backend-v31-change-requests/b31-102-schema-request.md
docs/09-operations/backend-v31-change-requests/b31-102-contract-request.md
```

必须包含实体/字段、约束、索引、endpoint、DTO、错误码、权限、测试需求、向后兼容性。

## 测试要求

- unit tests；
- repository tests（真实 PostgreSQL）；
- API tests；
- permission tests；
- state transition tests（assessment / speech job 全状态）；
- provider unavailable 场景测试；
- error sanitization tests。

运行测试：

```powershell
pnpm --filter @yuzan/api test
```

## 完成定义

- assessment / speech / recommendations / assessment-reports 模块实现完整；
- 所有测试通过；
- 已提交必要的 schema/contract request；
- 本地 HEAD = 远程 HEAD；
- clean worktree；
- 无阻塞问题。

## 报告格式

完成时返回：

```text
Trae-3 READY
branch: task/b31-102-assessment-loop
worktree: D:\program\test_program\yuzanxinsheng\three\worktrees\b31-102
local HEAD: <commit>
remote HEAD: <commit>
tests: <count> passed
schema requests: <list or none>
contract requests: <list or none>
blocking issues: <list or none>
```
