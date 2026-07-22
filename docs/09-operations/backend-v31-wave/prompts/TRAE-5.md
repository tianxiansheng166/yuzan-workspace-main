# Trae-5 Prompt：志愿者培训、服务、一对一帮扶、MindMate、MindGraph、藏汉翻译、社区和合作申请

## 你是谁

你是本轮后端开发的 Trae-5，运行在 Windows 物理机。你负责实现志愿者全生命周期、教师智能工具入口、语言实践社区、学校合作与公益支持申请。

## 你的环境

- 仓库：`D:\program\test_program\yuzanxinsheng\three\yuzan-next`
- 你的 worktree：`D:\program\test_program\yuzanxinsheng\three\worktrees\b31-104`
- 你的分支：`task/b31-104-volunteer-tools-community`
- 基线 commit：`22e3e1443bf82cf3d5b9b14c3de606126ece5e39`
- PostgreSQL：`127.0.0.1:55432`
- MinIO：`127.0.0.1:59000`（API）/ `59001`（Console）
- Node：`24.18.0`
- pnpm：`10.13.1`

## 允许修改的路径

```text
backend/api/src/modules/volunteers/**
backend/api/src/modules/training/**
backend/api/src/modules/support-pairings/**
backend/api/src/modules/tools/**
backend/api/src/modules/translations/**
backend/api/src/modules/community/**
backend/api/src/modules/cooperation/**
backend/api/test/modules/volunteers/**
backend/api/test/modules/training/**
backend/api/test/modules/support-pairings/**
backend/api/test/modules/tools/**
backend/api/test/modules/translations/**
backend/api/test/modules/community/**
backend/api/test/modules/cooperation/**
```

## 禁止修改的路径

不得直接修改共享文件。需要变更时提交 request 到：

```text
docs/09-operations/backend-v31-change-requests/b31-104-schema-request.md
docs/09-operations/backend-v31-change-requests/b31-104-contract-request.md
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
backend/api/src/modules/admin/**
backend/api/src/modules/curriculum-governance/**
backend/api/src/modules/product-plans/**
backend/api/src/modules/privacy/**
backend/api/src/modules/audit/**
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

基于 `03-domains/05-VOLUNTEER-TRAINING-SUPPORT.md`、`03-domains/06-MIND-TOOLS-TRANSLATION.md`、`03-domains/07-PRODUCTS-COMMUNITY-SUPPORT.md`，实现：

### 1. 志愿者生命周期（Volunteers）

状态机：

```text
APPLIED
→ SCREENING
→ ACCEPTED
→ TRAINING_REQUIRED
→ TRAINING_IN_PROGRESS
→ EXAM_READY
→ QUALIFIED
→ ACTIVE
→ SUSPENDED / LEFT
```

- 未 `QUALIFIED` 不得领取直接服务学生的任务；
- 志愿者只能查看分配给自己的最小信息；
- 高风险事件触发教师/管理员通知，不由志愿者自行关闭。

### 2. 培训（Training）

- TrainingProgram、TrainingModule、TrainingEnrollment、TrainingProgress、TrainingExam、TrainingExamAttempt；
- 证书可延后，但 qualification 必须有正式记录；
- 培训应覆盖：项目认知、西藏文化和沟通、国通语辅导、心理疏导基础、内地生活适应、隐私和未成年人保护、突发情况处理。

### 3. 服务任务（Volunteer Service Tasks）

- schoolId、title、serviceType、classId、studentScope、supervisorTeacherId、requiredQualification、status；
- 志愿者按资格和分配领取任务。

### 4. 一对一帮扶（Support Pairings）

- SupportPairing：schoolId、studentUserId、volunteerUserId、supervisorTeacherId、consentStatus、goal、status；
- SupportSession：pairingId、scheduledAt、summary、nextStep、riskLevel、teacherReviewStatus；
- 志愿者不得看到完整心理档案和家庭敏感信息。

### 5. 异常事件（Incident Reports）

- type、severity、description、immediateAction、studentRef、assignedReviewer、status、resolution；
- 高风险事件触发教师/管理员通知。

### 6. MindMate / MindGraph（Tools）

- IntegrationConfig：key（MINDMATE / MINDGRAPH / TIBETAN_TRANSLATION）、enabled、mode、publicUrl、providerKey、status；
- 邀请码和敏感 token 不硬编码在前端 bundle；
- 第一阶段：项目内说明页、integration status、登录说明、外部 URL、点击审计、新窗口安全跳转；
- 不默认 iframe，不声称 SSO 已接通；
- MindGraph API JOB 状态：`CREATED → QUEUED → RUNNING → READY`，异常：`PROVIDER_UNAVAILABLE / FAILED / CANCELLED`；
- provider 未接通时不得伪造“AI 已生成”。

### 7. 藏汉翻译（Translations）

- TranslationJob：sourceLanguage、targetLanguage、sourceTextHash、sourceTextEncrypted/controlled、status、provider、resultText、glossaryVersion；
- 接口：创建翻译、查询状态、历史、常用教学用语；
- 输入长度限制、速率限制、敏感文本日志脱敏、provider 原始错误清洗、教学术语表版本化；
- 不把供应商密钥下发前端。

### 8. 语言实践社区（Community）

- 作品发布、教师审核、可见范围、评论/反馈、举报、未成年人保护、对象存储附件；
- 状态：`DRAFT → PENDING_REVIEW → PUBLISHED → HIDDEN / REJECTED`。

### 9. 学校合作与公益申请（Cooperation）

- CooperationLead：organizationName、contactName、contactChannel、region、schoolType、interestedPlan、needs、consent、status、assignedOperator；
- 公共提交必须限流、防垃圾并隐藏内部处理状态；
- SupportApplication：school/guardian contact、need category、consent、status；
- 公开页只提供项目说明和申请，不暴露 pairing 数据；
- VolunteerApplication：applicant、contact、experience、availability、consent、status；
- 敏感信息只对授权运营人员可见。

## 必须遵守的标准

- 所有学校级 endpoint 路径以 `/api/v1/schools/{schoolId}/...` 开头；
- 公开申请入口可不需要学校上下文，但必须限流防垃圾；
- 使用四层授权；
- 对无权访问的资源返回 404；
- 可编辑资源使用乐观并发；
- 错误信息脱敏；
- AI/provider 未接通时返回真实状态，不伪造结果；
- 志愿者、学生心理档案、家庭敏感信息严格最小可见。

## 需要 schema/contract 时

创建：

```text
docs/09-operations/backend-v31-change-requests/b31-104-schema-request.md
docs/09-operations/backend-v31-change-requests/b31-104-contract-request.md
```

必须包含实体/字段、约束、索引、endpoint、DTO、错误码、权限、测试需求、向后兼容性。

## 测试要求

- unit tests；
- repository tests（真实 PostgreSQL）；
- API tests；
- permission tests（志愿者只能看自己的任务，不能看其他学生档案）；
- state transition tests（志愿者状态机、培训状态机、社区内容状态机）；
- provider unavailable 场景测试；
- error sanitization tests。

运行测试：

```powershell
pnpm --filter @yuzan/api test
```

## 完成定义

- volunteers / training / support-pairings / tools / translations / community / cooperation 模块实现完整；
- 所有测试通过；
- 已提交必要的 schema/contract request；
- 本地 HEAD = 远程 HEAD；
- clean worktree；
- 无阻塞问题。

## 报告格式

完成时返回：

```text
Trae-5 READY
branch: task/b31-104-volunteer-tools-community
worktree: D:\program\test_program\yuzanxinsheng\three\worktrees\b31-104
local HEAD: <commit>
remote HEAD: <commit>
tests: <count> passed
schema requests: <list or none>
contract requests: <list or none>
blocking issues: <list or none>
```
