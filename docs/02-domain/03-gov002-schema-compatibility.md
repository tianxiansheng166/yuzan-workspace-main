# GOV-003 Schema 与 GOV-002 OpenAPI 兼容性说明

本文件记录 GOV-003 冻结的 Prisma MVP 数据模型向 GOV-002 提供的最终契约输入，以及当前 OpenAPI 基线与 schema 之间的对照关系。GOV-002 尚未最终合并，以下标记反映 GOV-003 已确定的数据库侧决策。

## 提供给 GOV-002 的最终契约决策

### 1. Assignment

- 数据库已移除 `Assignment.classId`，任务投放目标唯一事实源为 `AssignmentTarget`。
- API `AssignmentResponse` 应通过 `targets` 数组暴露目标，内嵌元素包含：
  - `targetType`: `CLASS` 或 `STUDENT`
  - `classId`（`CLASS` 时必填）
  - `enrollmentId`（`STUDENT` 时必填）
- 允许创建无目标的 `DRAFT` 状态任务。
- 任务 `OPEN` 之前，服务层必须校验至少存在一个有效 `AssignmentTarget`。
- `GROUP` 等目标类型不在 MVP。

### 2. Submission

- API 不接收 `enrollmentId`；服务端由当前认证用户 + `schoolId` + `assignmentId` 推导对应的 `Enrollment`。
- `idempotencyKey` 为必填。`Submission` 是服务端持久化记录，`IN_PROGRESS` / `PENDING_SYNC` 是生命周期状态，不代表可无幂等键。
- `submittedAt` 在 `IN_PROGRESS` / `PENDING_SYNC` 时可为空；`SUBMITTED` 及之后状态必须有值。
- 完整状态枚举以 Prisma `SubmissionStatus` 为准：`IN_PROGRESS`、`PENDING_SYNC`、`SUBMITTED`、`PROCESSING`、`NEEDS_REVIEW`、`REVIEWED`、`RETURNED`、`ACCEPTED`。
- `attemptNo` 由服务端分配，受数据库唯一约束 `@@unique([assignmentId, enrollmentId, attemptNo])` 保护。

### 3. ActivityAttempt

- 一次 `Submission` 内每个 `LearningActivity` 只允许一条 `ActivityAttempt`。
- `AudioAsset` 绑定到 `ActivityAttempt`。
- 数据库 `ActivityAttempt.value` 为 `Json`；API 契约必须使用受约束的 `oneOf` 结构，不能因为是 JSON 就接收任意 payload。
- 语音重试等需要多次作答的场景通过新的 `Submission`（新的 `attemptNo`）表达。

### 4. Sync

- API `sync/push` 请求级标识映射到 `SyncJob.client_operation_id`。
- 请求内单个操作项标识映射到 `SyncOperation.operation_id`。
- `GET /sync/pull` 返回的 cursor 为不透明字符串；客户端不得解析 `last_synced_at` / `last_entity_id`。
- `SyncOperation.payload` 可只传输，数据库当前保留 `payload_hash` 与处理结果；完整 payload 由对象存储或缓存层承载，视后续契约细化。
- MVP `SyncOperation.entity_type` 由 GOV-002 契约限制枚举，数据库层为 `String`，服务层负责校验。

### 5. Feedback

- 数据库允许一个 `Submission` 关联多条 `Feedback`，用于保留历史修订。
- API 默认返回最新一条已 `released` 的有效 `Feedback`。
- `POST /submissions/{submissionId}/feedback` 的 `If-Match` 头对应 `Feedback.revision`；冲突返回 `409`。
- 旧 `Feedback` 不通过普通学生 API 列出；历史记录由后续审计或管理 API 暴露。

## 当前对照项

### schoolId 路径作用域

- OpenAPI：当前端点未在路径中显式携带 `schoolId`，依赖会话中的 active school。
- Schema：所有租户级表均直接持有 `schoolId`，并通过复合外键保证父子关系在同一学校内。
- 标记：**需要 GOV-002 最终提交后复核**。数据库层已具备学校隔离能力，API 路径/作用域表达由 GOV-002 确认。

### Assignment

- OpenAPI：`POST /assignments` 创建任务，`POST /assignments/{assignmentId}:open` 开放任务。
- Schema：`Assignment` 移除 `classId`，统一通过 `AssignmentTarget` 表达投放目标；固定引用 `CourseVersion`。
- 标记：**需要 GOV-002 最终提交后复核**。若 OpenAPI `CreateAssignmentRequest` 仍包含 `classId` 字段，则存在字段映射不一致。

### AssignmentTarget

- OpenAPI：当前基线未直接暴露 `AssignmentTarget` 资源。
- Schema：新增 `AssignmentTarget`，作为任务投放目标的唯一事实源，支持 `CLASS` 和 `STUDENT`。
- 标记：**当前缺失 / 暂缓**。API 层应在 `AssignmentResponse` 中通过 `targets` 数组暴露。

### Submission

- OpenAPI：`POST /assignments/{assignmentId}/submissions` 提交任务。
- Schema：`Submission` 通过 `enrollmentId` 绑定学校内班级身份（不再直接引用全局 `User`），`idempotencyKey` 必填，`attemptNo` 受数据库唯一约束保护。
- 标记：**需要 GOV-002 最终提交后复核**。若 OpenAPI `SubmitAssignmentRequest` 使用 `studentId` 或允许无 `Idempotency-Key`，需要调整。

### Feedback

- OpenAPI：`POST /submissions/{submissionId}/feedback` 发布反馈。
- Schema：`Feedback` 直接持有 `schoolId`，并通过复合外键关联 `Submission`；保留 `decision`、`comment`、`score`、`revision`、`releasedAt`。
- 标记：**已一致**（概念一致）。具体字段映射需 GOV-002 最终确认。

### idempotencyKey

- OpenAPI：`Idempotency-Key` 请求头在提交端点中标记为 `required`。
- Schema：`Submission.idempotencyKey` 为必填字段，无 key 的服务端草稿记录不在 MVP。
- 标记：**已一致**（概念一致）。

### AnswerInput / ActivityAttempt

- OpenAPI：`SubmitAssignmentRequest` 中 likely 包含 `AnswerInput` 或类似结构。
- Schema：原 `Answer` 已重命名为 `ActivityAttempt`，表示一次 `Submission` 中某个 `LearningActivity` 的作答记录；`AudioAsset` 绑定到 `ActivityAttempt`。
- 标记：**需要 GOV-002 最终提交后复核**。API 契约中的 `AnswerInput` 字段命名需与 `ActivityAttempt` 对齐，且必须约束 value 类型。

### Sync Push / Pull

- OpenAPI：`POST /sync/push`、`GET /sync/pull`。
- Schema：保留基线 `SyncOperation`；新增 `SyncJob`（含 `clientOperationId`）、`SyncCursor`（按 `deviceId + entityType` 唯一）。
- `SyncJob` 表示一次 `sync/push` 请求；`clientOperationId` 为请求级幂等标识。
- `SyncOperation` 必须归属一条 `SyncJob`，通过复合外键 `(schoolId, deviceId, syncJobId)` 保证 `schoolId`、`deviceId` 与 Job 一致；设备归属通过 `SyncOperation → SyncJob → Device` 获得。
- `SyncOperation.operationId` 唯一边界为 `(schoolId, actorUserId, operationId)`。
- API 对接：
  - 请求级 `Idempotency-Key` 或最终确定的 `clientOperationId` → `SyncJob.clientOperationId`；
  - `operations[].operationId` → `SyncOperation.operationId`；
  - 一个 push 请求创建或复用一条 `SyncJob`，每个 `operations[]` 项创建或复用一条 `SyncOperation`。
- 标记：**需要 GOV-002 最终提交后复核**。SyncJob/SyncOperation 字段映射、cursor 编码格式需后续契约任务明确。

### If-Match / 版本字段

- OpenAPI：`PUT /activities/{activityId}/progress` 与 `POST /submissions/{submissionId}/feedback` 使用 `If-Match` 头进行乐观锁控制。
- Schema：`ActivityProgress`、`Submission`、`Feedback` 均保留 `revision` 字段用于版本校验。
- 标记：**已一致**（概念一致）。

### 403 / 404 租户边界

- OpenAPI：使用 `403 Forbidden` 表示认证用户越权访问学校外资源。
- Schema：通过 `schoolId` 复合外键与复合唯一约束在数据库层隔离租户数据；服务层负责将学校作用域转换为 403/404。
- 标记：**已一致**（数据库层已隔离，HTTP 语义由服务层实现）。

## 汇总

| 类别                        | 数量 | 项                                                                                       |
| --------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| 已一致                      | 4    | Feedback、idempotencyKey、If-Match/版本字段、403/404 租户边界                            |
| 需要 GOV-002 最终提交后复核 | 4    | schoolId 路径作用域、Assignment、Submission、AnswerInput/ActivityAttempt、Sync Push/Pull |
| 当前缺失 / 暂缓             | 1    | AssignmentTarget 直接暴露                                                                |

## 剩余数据库风险

1. `AssignmentTarget` 在 MVP API 响应中的暴露形式需 GOV-002 确认。
2. `SyncJob.clientOperationId` 与 `SyncOperation.operationId` 的映射关系已明确：请求级标识 → `SyncJob.clientOperationId`，操作项标识 → `SyncOperation.operationId`；cursor 编码格式仍需 GOV-002 最终确定。
3. `SyncOperation.entity_type` 在数据库层为 `String`，MVP 枚举由 API 契约限制，服务层必须校验。
