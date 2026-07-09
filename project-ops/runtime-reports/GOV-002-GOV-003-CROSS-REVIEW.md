# GOV-002 OpenAPI 与 GOV-003 Prisma 数据模型交叉审查报告

> 角色：Wave 0 独立架构交叉审查员
> 审查时间：2026-07-09
> 范围：仅审查 GOV-002 OpenAPI 契约与 GOV-003 Prisma 数据模型的一致性
> 规则：未修改任何任务分支、main 或旧项目文件

---

## 1. 审查对象

### GOV-002 worktree

- 路径：`/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-002`
- 分支：`task/gov-002-contract`
- commit：`b58af4e3c5f78db0ce806116368987261c198523`
- git status：干净（空）

### GOV-003 worktree

- 路径：`/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-003`
- 分支：`task/gov-003-database`
- commit：`786e71a50b387af12751fddabc19a9d144d7ea4f`
- git status：干净（空）

### 已审查文件

GOV-002：

- `packages/contracts/openapi/openapi.yaml`
- `packages/contracts/src/generated.ts`
- `docs/03-architecture/02-API与契约规范.md`
- `/home/admin01/Documents/yuzan-workspace-main/runtime-reports/GOV-002-CROSS-REVIEW-EXCERPTS.md`（参考）

GOV-003：

- `infra/database/prisma/schema.prisma`
- `infra/database/prisma/migrations/20260709030219_gov_003_mvp/migration.sql`
- `docs/02-domain/01-领域模型总览.md`
- `docs/02-domain/02-实体字段字典.md`
- `docs/02-domain/03-gov002-schema-compatibility.md`
- `docs/02-domain/03-状态机.md`
- `docs/03-architecture/02-API与契约规范.md`

---

## 2. 十项一致性矩阵

### 2.1 学校租户边界

| 维度       | GOV-002 当前契约                                                                                            | GOV-003 当前模型                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 路径作用域 | 所有学校作用域接口使用 `/schools/{schoolId}` path parameter（UUID）                                         | 所有租户级表直接持有 `schoolId`；通过复合外键 `([schoolId, parentId])` 强制父子记录在同一学校  |
| 成员校验   | 文档要求服务端结合 `Membership` 校验用户是否属于该学校，越权返回 `403`，资源不存在返回 `404`                | `Membership` 有 `(schoolId, userId, role)` 唯一约束；`Session.activeSchoolId` 记录会话活动学校 |
| 数据库强制 | URL `schoolId` 与用户身份的 Membership 关系**只能由服务层强制**，数据库无法直接关联 HTTP 路径参数与用户身份 | 父子资源同校关系**已由数据库复合外键 + 复合唯一键强制**                                        |

- **是否一致**：概念一致，实现分层合理。
- **问题级别**：ACCEPTED
- **应修改哪个任务**：无需修改
- **精确修改位置**：无
- **推荐决策**：保持当前设计。服务层负责把 URL `schoolId` 转换为数据库查询作用域，并在用户不属于学校时返回 403。
- **不修改的风险**：无。属于已明确的架构约定。

---

### 2.2 Assignment

| 维度     | GOV-002 当前契约                                                                                        | GOV-003 当前模型                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 创建请求 | `CreateAssignmentRequest` required `[classId, courseVersionId, title, startsAt, dueAt]`，单一 `classId` | `Assignment` 表已**移除 `classId`**，目标由 `AssignmentTarget` 承载；`AssignmentTarget` 支持 `CLASS`（`classId`）和 `STUDENT`（`enrollmentId`）两种目标 |
| 响应     | `Assignment` required `[id, classId, courseVersionId, title, status, startsAt, dueAt, revision]`        | `Assignment` 表无 `classId`；`targets` 关系为数组                                                                                                       |
| 开放操作 | `POST /schools/{schoolId}/assignments/{assignmentId}:open`                                              | `Assignment.status` 枚举一致：`DRAFT, SCHEDULED, OPEN, CLOSED, CANCELLED, ARCHIVED`                                                                     |

- **是否一致**：**不一致，核心字段模型冲突**。
- **问题级别**：BLOCKER
- **应修改哪个任务**：GOV-002
- **精确修改位置**：
  - `packages/contracts/openapi/openapi.yaml` 中 `CreateAssignmentRequest`、`Assignment` schema；
  - `POST /schools/{schoolId}/assignments` 请求/响应；
  - 生成文件 `packages/contracts/src/generated.ts` 由重新生成覆盖。
- **推荐决策**：
  1. `CreateAssignmentRequest` 移除单一 `classId`，改为 `targets` 数组（元素含 `targetType: CLASS | STUDENT` 及对应 `classId` 或 `enrollmentId`）。
  2. 允许先创建无目标草稿（targets 为空），但发布/开放前服务层校验至少有一个目标。
  3. `Assignment` 响应暴露 `targets` 数组，不再暴露单一 `classId`。
  4. 支持一个 Assignment 同时投放多个班级和学生（由 `AssignmentTarget` 唯一约束控制）。
- **不修改的风险**：后续业务代码无法直接根据 OpenAPI 生成类型实现多目标投放；契约与数据库字段名不兼容，必须二选一做转换层，增加错误和返工。

---

### 2.3 Submission

| 维度     | GOV-002 当前契约                                                                         | GOV-003 当前模型                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| endpoint | `POST /schools/{schoolId}/assignments/{assignmentId}/submissions`                        | `Submission` 表                                                                                                                                         |
| 请求体   | `SubmitAssignmentRequest` required `[attemptNo, answers]`；无 `enrollmentId`/`studentId` | `Submission` required: `schoolId`, `assignmentId`, `enrollmentId`, `attemptNo`                                                                          |
| 响应     | `Submission` required `[id, assignmentId, status, attemptNo, revision, submittedAt]`     | `Submission` 有 `submittedAt DateTime?`；`status` 枚举含 `IN_PROGRESS, PENDING_SYNC, SUBMITTED, PROCESSING, NEEDS_REVIEW, REVIEWED, RETURNED, ACCEPTED` |
| 身份推导 | 当前学生身份由认证用户 + schoolId 推导                                                   | `enrollmentId` 将提交绑定到学校内班级身份，不直接引用跨租户 `User`                                                                                      |

- **是否一致**：部分一致，但状态枚举和 `submittedAt` 可空性存在冲突。
- **问题级别**：MUST_FIX
- **应修改哪个任务**：GOV-002
- **精确修改位置**：
  - `packages/contracts/openapi/openapi.yaml` 中 `Submission` schema 的 `status` 枚举和 `submittedAt` 可空性。
- **推荐决策**：
  1. 明确 `SubmitAssignmentRequest` 不传 `enrollmentId`，由服务层根据认证用户 + `schoolId` 查询 `Enrollment` 后写入。
  2. `Submission.status` 枚举应包含 `IN_PROGRESS` 和 `PENDING_SYNC`，或文档明确说明 API 仅暴露已到达服务端后的状态（但后者与学生今日任务中的 `PENDING_SYNC` 等 UI 状态矛盾，建议包含全部状态）。
  3. `submittedAt` 改为 `string | null`（或 `format: date-time` 的可空字段），与 Prisma 可空保持一致。
- **不修改的风险**：客户端会收到与数据库状态机不一致的枚举；草稿/中间状态调用 API 时 `submittedAt` 无法返回必填值。

---

### 2.4 Idempotency-Key

| 维度     | GOV-002 当前契约                                               | GOV-003 当前模型                                                                                                                          |
| -------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Header   | `Idempotency-Key` required=true，用于 submissions 和 sync/push | `Submission.idempotencyKey String?`；`Submission` 唯一约束 `@@unique([enrollmentId, idempotencyKey])`                                     |
| 同步     | `SyncOperation.operationId` 作为幂等标识                       | `SyncOperation` 无单独 `idempotencyKey` 字段，幂等边界为 `@@unique([actorUserId, operationId])`；`SyncJob.clientOperationId` 按请求级去重 |
| 保留期   | 描述为“具体保留期限由服务端策略决定”                           | 文档同样未写死保留期                                                                                                                      |
| 重复请求 | “重复请求返回首次业务结果”                                     | 由唯一约束支撑                                                                                                                            |

- **是否一致**：**概念一致，但 required header 与 nullable 字段存在语义矛盾**。
- **问题级别**：MUST_FIX
- **应修改哪个任务**：GOV-002（主导）；GOV-003 文档需同步澄清
- **精确修改位置**：
  - `packages/contracts/openapi/openapi.yaml` 中 `IdempotencyKey` 参数定义；
  - `POST /schools/{schoolId}/assignments/{assignmentId}/submissions` 的 `Idempotency-Key` 是否 required；
  - GOV-003 `docs/02-domain/02-实体字段字典.md` 中 Submission 相关描述。
- **推荐决策**：
  - **结论 A：最终 Submission 必须有 idempotencyKey**。OpenAPI 保持 `required: true`，但服务层区分“草稿保存”（不创建最终 Submission 或处于 `IN_PROGRESS` 状态）与“最终提交”（必须含 key）。Prisma 的 `idempotencyKey` 在最终提交时必须非空。
  - 或者 **结论 B：允许 nullable，但仅当 status 为 `IN_PROGRESS` 或 `PENDING_SYNC`**。此时 OpenAPI 应将 `Idempotency-Key` 改为 optional，并在服务层对 `SUBMITTED` 及之后状态校验 key 非空。
  - 建议采用 **结论 A**，因为契约中 `Idempotency-Key` 已 required，且最终提交幂等是硬性需求；草稿状态可以另走内部端点或不被视为最终 Submission。
- **不修改的风险**：客户端与服务端对“必填幂等键”的理解不一致；重复提交可能产生多个 `Submission` 记录，破坏 `IN_PROGRESS`/`PENDING_SYNC` 状态语义。

---

### 2.5 AnswerInput 与 ActivityAttempt

| 维度   | GOV-002 当前契约                                                                                                                                  | GOV-003 当前模型                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结构   | `AnswerInput` required `[activityId, kind]`；`kind` 枚举 `[CHOICE, TEXT, SPEECH]`；`value` 为 `string\|number\|boolean\|array\|object\|null` 占位 | `ActivityAttempt`：`kind String`, `value Json?`, `autoResult Json?`；`LearningActivity.type` 枚举 `[TEXT, VIDEO, AUDIO, CHOICE, FILL_BLANK, SPEECH]` |
| 音频   | `audioAssetId?: string \| null`                                                                                                                   | `AudioAsset.attemptId` 与 `ActivityAttempt` 一对一                                                                                                   |
| 唯一性 | 无                                                                                                                                                | `@@unique([submissionId, activityId])`：一次 Submission 内同一 activity 只允许一个 ActivityAttempt                                                   |
| 重试   | `attemptNo` 由客户端传入                                                                                                                          | 语音重试等需生成新的 `Submission`（新的 `attemptNo`）                                                                                                |

- **是否一致**：**字段命名和部分枚举不一致**。
- **问题级别**：MUST_FIX
- **应修改哪个任务**：GOV-002
- **精确修改位置**：
  - `packages/contracts/openapi/openapi.yaml` 中 `AnswerInput` schema。
- **推荐决策**：
  1. `AnswerInput.kind` 枚举需要与 `ActivityAttempt.kind` 和 `LearningActivity.type` 对齐。当前 OpenAPI 仅含 `CHOICE/TEXT/SPEECH`，缺少 `FILL_BLANK` 等；`TEXT` 在两者中均有但语义需明确。
  2. `value` 不能继续为任意 JSON。建议给出**最小可冻结结构**：
     ```yaml
     AnswerInput:
       oneOf:
         - $ref: "#/components/schemas/TextAnswer"
         - $ref: "#/components/schemas/ChoiceAnswer"
         - $ref: "#/components/schemas/SpeechAnswer"
       discriminator:
         propertyName: kind
     ```
     其中：
     - `TextAnswer`: `{ kind: TEXT, value: string }`
     - `ChoiceAnswer`: `{ kind: CHOICE, value: string[] }`（选项 ID 数组）
     - `SpeechAnswer`: `{ kind: SPEECH, audioAssetId: string }`（value 可选）
  3. 明确 `audioAssetId` 与 `AudioAsset` 的一对一关系。
  4. 文档说明一次 Submission 内同一 activity 只能有一个 attempt，语音重试需新建 Submission。
- **不修改的风险**：前端生成类型无约束，可能上传任意 JSON；服务端解析困难；后续评分和语音处理无法依赖稳定结构。

---

### 2.6 Feedback 与并发控制

| 维度 | GOV-002 当前契约                                                               | GOV-003 当前模型                                                                      |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 请求 | `ReleaseFeedbackRequest`：`decision, comment, score?`                          | `Feedback`：`decision`, `comment`, `score?`, `authorUserId`, `revision`, `releasedAt` |
| 响应 | `Feedback`：`id, submissionId, decision, comment, score, releasedAt, revision` | `Submission.feedback` 为数组关系                                                      |
| 并发 | `If-Match` header required，description 说“冲突时返回 409”                     | `Feedback.revision Int @default(1)`；`Submission.revision` 也存在                     |

- **是否一致**：**概念一致，细节需文档化**。
- **问题级别**：SHOULD_FIX
- **应修改哪个任务**：GOV-002（文档）
- **精确修改位置**：
  - `packages/contracts/openapi/openapi.yaml` 中 `IfMatch` 参数描述；
  - `docs/03-architecture/02-API与契约规范.md` 并发控制章节。
- **推荐决策**：
  1. 明确 `If-Match` 对应数据库 `revision` 整型字段，值为字符串形式的整数（如 `"3"`）。
  2. 统一冲突响应为 `409 Conflict`（当前已是）。
  3. 明确 `Feedback` 在 MVP 中是否唯一。Prisma 中 `Submission.feedback` 为数组，但 OpenAPI 返回单条；建议 MVP 按“一个 Submission 最终只有一条有效 Feedback”处理，旧版本由服务层/审计日志保留，不在 API 暴露。
- **不修改的风险**：客户端与后端对 `If-Match` 格式理解不一致；返回多条 Feedback 时客户端无所适从。

---

### 2.7 Sync push/pull

| 维度      | GOV-002 当前契约                                                                                                                               | GOV-003 当前模型                                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push 请求 | `SyncPushRequest`：`deviceId + operations[]`；`SyncOperation` 含 `operationId, entityType, entityId, action, baseRevision, payload, createdAt` | `SyncJob`：`schoolId, deviceId, clientOperationId, status, summary, errorCode`；`SyncOperation`：`deviceId, actorUserId, operationId, entityType, entityId, action, baseRevision, payloadHash, status, result` |
| payload   | `SyncPayload` 仅含 `position, completed`                                                                                                       | 数据库只存 `payloadHash`，不存 payload 原文                                                                                                                                                                    |
| Pull 响应 | `SyncPullResponse`：`SyncChange[]`（含 `changeId, entityType, entityId, revision, changedAt, payload`）                                        | 无独立 `SyncChange` 表；`SyncCursor`：`deviceId, entityType enum, lastSyncedAt, lastEntityId`                                                                                                                  |
| cursor    | query `cursor: string`                                                                                                                         | `lastSyncedAt + lastEntityId` 编码为不透明字符串                                                                                                                                                               |
| receipt   | `SyncReceipt`：`status enum [ACKNOWLEDGED, CONFLICT, PERMANENT_FAILURE]`                                                                       | `SyncOperationStatus` 含 `QUEUED, ACKNOWLEDGED, CONFLICT, PERMANENT_FAILURE`                                                                                                                                   |

- **是否一致**：**层级和字段映射不清晰**。
- **问题级别**：MUST_FIX
- **应修改哪个任务**：GOV-002 为主；GOV-003 为辅
- **精确修改位置**：
  - GOV-002：`packages/contracts/openapi/openapi.yaml` 中 `SyncOperation`, `SyncChange`, `SyncPushRequest`, `SyncPullResponse`, `SyncPayload`；
  - GOV-003：可选，将 `SyncOperation.entityType` 从 `String` 改为枚举，或至少文档化允许值。
- **推荐决策**：
  1. **明确层级**：一次 `sync/push` 请求对应一个 `SyncJob`（由 `clientOperationId` 唯一），请求内的每个 operation 对应一条 `SyncOperation`（由 `operationId` 在 `(actorUserId, operationId)` 边界内唯一）。
  2. `SyncOperation.operationId` 映射到数据库 `SyncOperation.operationId`。
  3. `SyncReceipt.status` 是 `SyncOperation` 处理后的状态，忽略 `QUEUED` 是合理的（返回时已过队列阶段）。
  4. `SyncChange` 是服务端视角的变更视图，可由 `SyncOperation` 处理结果或其他实体变更日志投影生成；契约无需新增表，但需文档化。
  5. `entityType` 在 OpenAPI 中应限制为当前 MVP 支持的类型：`progress`, `submission`（后续可扩展）；GOV-003 的 `SyncCursorEntityType` 枚举为 `ASSIGNMENT, SUBMISSION, PROGRESS, CONTENT_PACKAGE, FEEDBACK`，但 `SyncOperation.entityType` 是自由字符串，建议对齐。
  6. `payload` 持久化策略：若服务端需要重放或审计，应增加 `payloadJson` 字段；MVP 可仅保留 hash，但契约需说明 payload 仅在传输中使用。
- **不修改的风险**：同步模块实现时无法确定 operation 与 job 的对应关系；cursor 编解码不一致导致增量拉取遗漏或重复。

---

### 2.8 AssignmentTarget 的数据库 CHECK

| 维度               | GOV-003 当前模型                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHECK 约束         | `AssignmentTarget_target_check`：`(targetType='CLASS' AND classId IS NOT NULL AND enrollmentId IS NULL) OR (targetType='STUDENT' AND enrollmentId IS NOT NULL AND classId IS NULL)` |
| Prisma schema 表达 | **未表达**，CHECK 仅在 migration.sql 中手工加入                                                                                                                                     |

- **是否一致**：单一模型内部一致性问题，不涉及 GOV-002。
- **问题级别**：MUST_FIX
- **应修改哪个任务**：GOV-003
- **精确修改位置**：
  - `infra/database/prisma/schema.prisma` 中 `AssignmentTarget` 模型；
  - `infra/database/prisma/migrations/20260709030219_gov_003_mvp/migration.sql` 中 CHECK 约束；
  - 新增或补充迁移测试。
- **推荐决策**：
  1. 当前 CHECK **未覆盖“两者同时为空”** 的情况。根据文档“`Assignment` 至少需要一个 `AssignmentTarget`”，应增加服务层校验；数据库层至少应保证一行记录若是目标则字段合法。
  2. 建议在 Prisma schema 中使用 `@@map` 和 `dbgenerated` 之外的方案，或在后续 migration 中保留 CHECK。
  3. 覆盖矩阵：
     - CLASS + classId：是
     - STUDENT + enrollmentId：是
     - 两者同时为空：**否，需服务层或 CHECK 补充**
     - 两者同时非空：是（CHECK 拒绝）
     - targetType 与字段不一致：是（CHECK 拒绝）
  4. 在领域文档和迁移测试中增加守卫，防止后续 `prisma migrate dev` 生成的新 migration 丢失 CHECK。
- **不修改的风险**：可插入 targetType=CLASS 但 classId 为空的记录；后续 migration 重建表时可能丢失约束。

---

### 2.9 软删除与 API 可见性

| 维度             | GOV-002 当前契约                    | GOV-003 当前模型                                                                                  |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| 软删除实体       | API 未明确说明                      | `School`, `Course`, `Assignment`, `Submission`, `Feedback`, `Resource`, `Device` 均有 `deletedAt` |
| 查询语义         | NotFound 描述为“资源不存在或不可见” | 服务层查询应追加 `deletedAt IS NULL`                                                              |
| 恢复/idempotency | 未提及                              | 删除后关键标识符不复用；`Submission` 唯一键仍占用                                                 |

- **是否一致**：API 未明确软删除语义，但方向不冲突。
- **问题级别**：SHOULD_FIX
- **应修改哪个任务**：GOV-002（文档）
- **精确修改位置**：
  - `packages/contracts/openapi/openapi.yaml` 中 `NotFound` 响应描述；
  - `docs/03-architecture/02-API与契约规范.md` 增加软删除语义章节。
- **推荐决策**：
  1. 明确被软删除资源返回 `404 Not Found`（对一般 API 消费者不可见）。
  2. 明确管理端如需恢复，需独立管理 API（不在当前 MVP 范围）。
  3. 明确删除后 `Submission` 的 idempotency key 仍占用，重复提交不能重建已删除记录。
- **不修改的风险**：API 消费者可能从 404 推断出资源“从未存在”，而实际为软删除，存在信息泄漏风险。

---

### 2.10 Campus

| 维度 | GOV-002 当前契约              | GOV-003 当前模型                                     |
| ---- | ----------------------------- | ---------------------------------------------------- |
| API  | 完全没有 Campus 相关 endpoint | `Campus` 表存在；`Class.campusId`, `Device.campusId` |
| 用途 | 无                            | 班级按校区归属、设备按校区下发内容包                 |

- **是否一致**：数据库内部预留，API 不暴露。
- **问题级别**：ACCEPTED
- **应修改哪个任务**：无需修改
- **精确修改位置**：无
- **推荐决策**：MVP 中 Campus 作为数据库内部预留，API 不暴露。后续管理 API 按需引入。
- **不修改的风险**：无。

---

## 3. 最终决策表

| ID    | 主题                             | 级别       | GOV-002 修改 | GOV-003 修改    | 推荐决策                                                                                                    | 合并前必须完成 |
| ----- | -------------------------------- | ---------- | ------------ | --------------- | ----------------------------------------------------------------------------------------------------------- | -------------- |
| CR-01 | Assignment 目标模型              | BLOCKER    | 是           | 否              | `CreateAssignmentRequest` 改为 `targets` 数组；`Assignment` 响应暴露 `targets`；移除单一 `classId`          | 是             |
| CR-02 | Submission status 枚举           | MUST_FIX   | 是           | 否              | OpenAPI `Submission.status` 增加 `IN_PROGRESS`/`PENDING_SYNC`，或文档说明 API 只暴露已提交后状态            | 是             |
| CR-03 | Submission.submittedAt 可空性    | MUST_FIX   | 是           | 否              | OpenAPI `submittedAt` 改为 `string \| null`                                                                 | 是             |
| CR-04 | Idempotency-Key required         | MUST_FIX   | 是           | 否（文档同步）  | 明确最终提交必须 idempotencyKey；或改为 optional 并区分草稿/最终状态                                        | 是             |
| CR-05 | AnswerInput value 结构           | MUST_FIX   | 是           | 否              | 定义 CHOICE/TEXT/SPEECH 的 oneOf/discriminator 最小结构                                                     | 是             |
| CR-06 | AnswerInput kind 与 ActivityType | MUST_FIX   | 是           | 否              | 对齐 kind 枚举与 `ActivityAttempt.kind` / `LearningActivity.type`                                           | 是             |
| CR-07 | Sync 模型层级                    | MUST_FIX   | 是           | 是（可选 enum） | 明确 `SyncJob.clientOperationId` 与 `SyncOperation.operationId` 关系；定义 cursor 编码；决定 payload 持久化 | 是             |
| CR-08 | Sync entityType/action 枚举      | MUST_FIX   | 是           | 可选            | OpenAPI 中 `entityType`/`action` 使用枚举；GOV-003 可考虑 `SyncOperation.entityType` 也改为 enum            | 是             |
| CR-09 | AssignmentTarget CHECK 覆盖      | MUST_FIX   | 否           | 是              | 增加“两者同时为空”的拒绝（服务层或 CHECK），并在迁移测试中守卫                                              | 是             |
| CR-10 | If-Match / revision 映射         | SHOULD_FIX | 是（文档）   | 否              | 明确 `If-Match` 值为字符串形式的 `revision` 整数，冲突返回 409                                              | 否             |
| CR-11 | 软删除 API 语义                  | SHOULD_FIX | 是（文档）   | 否              | 在 OpenAPI 响应描述中说明软删除资源返回 404                                                                 | 否             |
| CR-12 | 学校租户边界                     | ACCEPTED   | 否           | 否              | 已一致，数据库强制父子同校，服务层强制 Membership                                                           | 否             |
| CR-13 | Campus API 暴露                  | ACCEPTED   | 否           | 否              | 数据库内部预留，MVP API 不暴露                                                                              | 否             |
| CR-14 | Feedback 并发控制                | ACCEPTED   | 否           | 否              | 概念一致，`revision` 字段已存在                                                                             | 否             |

---

## 4. BLOCKER 列表

| ID    | 主题                | 说明                                                                                                           |
| ----- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| CR-01 | Assignment 目标模型 | GOV-002 仍使用单一 `classId`，而 GOV-003 已迁移到 `AssignmentTarget` 多目标模型，直接阻塞任务创建/响应的实现。 |

---

## 5. MUST_FIX 列表

| ID    | 主题                        | 说明                                                    |
| ----- | --------------------------- | ------------------------------------------------------- |
| CR-02 | Submission status 枚举      | OpenAPI 缺少 Prisma 中的 `IN_PROGRESS`/`PENDING_SYNC`。 |
| CR-03 | submittedAt 可空性          | OpenAPI required，Prisma nullable。                     |
| CR-04 | Idempotency-Key required    | required header 与 nullable 字段语义矛盾。              |
| CR-05 | AnswerInput value 结构      | 当前为任意 JSON 占位，需定义最小冻结结构。              |
| CR-06 | AnswerInput kind 枚举       | 与 `ActivityType`/`ActivityAttempt.kind` 不一致。       |
| CR-07 | Sync 模型层级               | `SyncJob` 与 `SyncOperation`、`cursor` 编码关系未明确。 |
| CR-08 | Sync entityType/action 枚举 | OpenAPI 中自由字符串，应限制为 MVP 支持类型。           |
| CR-09 | AssignmentTarget CHECK      | CHECK 不覆盖两者同时为空；Prisma schema 未表达 CHECK。  |

---

## 6. GOV-002 精确修改清单

1. **`packages/contracts/openapi/openapi.yaml`**：
   - `CreateAssignmentRequest`：移除 `classId`，新增 `targets` 数组字段。
   - 新增 `AssignmentTargetInput` schema。
   - `Assignment` schema：移除 `classId`，新增 `targets` 数组字段。
   - 新增 `AssignmentTarget` response schema。
   - `Submission` schema：`status` 枚举增加 `IN_PROGRESS`、`PENDING_SYNC`；`submittedAt` 改为可空。
   - `IdempotencyKey` 参数：根据 CR-04 决策调整 `required` 并补充描述。
   - `AnswerInput` schema：改为 oneOf + discriminator，定义 `TextAnswer`/`ChoiceAnswer`/`SpeechAnswer`。
   - `SyncOperation`：限制 `entityType` 和 `action` 枚举；说明 `operationId` 与 `SyncJob.clientOperationId` 的层级关系。
   - `SyncPullResponse` / `SyncChange`：文档化 `changeId` 和 `payload` 的来源。
   - `IfMatch` 参数描述：补充值为字符串形式 `revision` 整数。
   - `NotFound` 响应描述：补充软删除资源不可见。

2. **`packages/contracts/src/generated.ts`**：
   - 重新运行 `openapi-typescript` 生成，不得手工修改。

3. **`docs/03-architecture/02-API与契约规范.md`**（gov-002 版本）：
   - 补充软删除语义、If-Match 格式、同步层级说明。

---

## 7. GOV-003 精确修改清单

1. **`infra/database/prisma/schema.prisma`**：
   - `AssignmentTarget`：考虑使用 Prisma 原生机制或 `dbgenerated` 保留 CHECK 约束；至少补充文档说明 CHECK 在 migration 中手工维护。
   - 可选：`SyncOperation.entityType` 改为 enum，与 `SyncCursorEntityType` 对齐。

2. **`infra/database/prisma/migrations/20260709030219_gov_003_mvp/migration.sql`**：
   - 考虑补充 `AssignmentTarget_target_check` 的“两者同时为空”拒绝分支；若由服务层保证，则需在迁移注释中注明。

3. **迁移测试/领域文档**：
   - 增加测试或断言，验证后续 migration 不会丢失 `AssignmentTarget_target_check`。
   - `docs/02-domain/02-实体字段字典.md`：同步 `idempotencyKey` 语义（最终提交必须非空 vs 草稿可空）。

---

## 8. 可延后事项（DEFERRED）

- Campus 管理 API。
- 软删除资源恢复端点。
- 更复杂的 `AnswerInput` 类型（如 FILL_BLANK、VIDEO、AUDIO 活动类型）。
- Sync 冲突详情端点（当前由 `SyncReceipt.errorCode` 覆盖）。
- Feedback 历史版本 API（当前按单条有效 Feedback 处理）。

---

## 9. 推荐合并顺序

1. **先完成修改**：
   - GOV-003 先补充 `AssignmentTarget` CHECK 覆盖与迁移测试（影响小，风险低）。
   - GOV-002 随后按本报告 MUST_FIX/BLOCKER 清单调整契约（OpenAPI 是前端类型和后续业务代码的事实源，必须先稳定）。

2. **合并顺序**：
   - **先合并 GOV-003**（数据模型是契约约束依据，且当前 main 已含 GOV-001 文档修改）。
   - **再合并 GOV-002**（此时契约已与模型对齐，可直接生成类型并进入业务实现）。

理由：

- 两个分支当前修改文件不直接冲突（GOV-002 改 `packages/contracts/` 和 `README/.env.example`；GOV-003 改 `infra/database/` 和 `docs/02-domain/`）。
- 但 GOV-002 的契约依赖 GOV-003 的数据模型；数据模型先冻结，契约再对齐，可减少二次修改。
- GOV-003 的修改量小（CHECK + 文档），可快速合入；GOV-002 的修改量大（Assignment 目标模型、Submission 状态、AnswerInput 等），需要更多时间。

---

## 10. 合并后验证命令

在两个分支分别修改并提交后，在 main 执行：

```bash
# 1. 合并 GOV-003
git checkout main
git merge --ff-only task/gov-003-database

# 2. 合并 GOV-002
git merge --ff-only task/gov-002-contract

# 3. 安装与校验
source ~/.nvm/nvm.sh && nvm use 24
pnpm install --frozen-lockfile
pnpm format:check
pnpm db:generate
pnpm db:validate
pnpm typecheck
pnpm build
pnpm test
pnpm check
```

预期：

- `install`、`format:check`、`db:generate`、`db:validate`、`typecheck`、`build` 全部通过。
- `test` / `check` 仅因 OpenAPI lint 之外的已知问题失败；本次审查修复后，OpenAPI lint 应通过。

---

## 11. 风险结论

- **BLOCKER 数量**：1（Assignment 目标模型）
- **MUST_FIX 数量**：8
- **总体风险**：高。GOV-002 当前契约与 GOV-003 数据模型在 Assignment、Submission、AnswerInput、Sync 等核心教学链路存在显著不一致。若直接合并两个分支，后续业务实现将被迫在契约与数据库之间做大量转换和妥协，极易引入状态机错误和租户边界漏洞。
- **建议**：在 GOV-002 中按本报告清单完成 MUST_FIX/BLOCKER 项，GOV-003 补充 CHECK 与文档后，按“先 GOV-003、后 GOV-002”的顺序合并。

---

## 12. 最终状态确认

- GOV-002 worktree git status：干净（空）
- GOV-003 worktree git status：干净（空）
- 未修改任何任务分支文件
