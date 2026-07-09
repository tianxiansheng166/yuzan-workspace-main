# GOV-002 交叉审查摘录（WAITING_FOR_GOV-003-CROSS-REVIEW）

> 来源 commit：`b58af4e3c5f78db0ce806116368987261c198523`
> 分支：`task/gov-002-contract`
> 生成时间：2026-07-09
> 用途：供 GOV-003 对照数据库实体与业务实现，不得修改任务分支文件。

---

## 1. SchoolId

### YAML 原文

```yaml
SchoolId:
  in: path
  name: schoolId
  required: true
  description: 学校（租户）标识
  schema:
    type: string
    format: uuid
    example: "00000000-0000-0000-0000-000000000000"
```

### 被哪些 endpoint 引用

所有学校作用域 path：

- `GET /schools/{schoolId}/course-versions`
- `POST /schools/{schoolId}/course-versions`
- `POST /schools/{schoolId}/course-versions/{courseVersionId}:publish`
- `GET /schools/{schoolId}/classes`
- `POST /schools/{schoolId}/assignments`
- `POST /schools/{schoolId}/assignments/{assignmentId}:open`
- `GET /schools/{schoolId}/students/me/today`
- `PUT /schools/{schoolId}/activities/{activityId}/progress`
- `POST /schools/{schoolId}/assignments/{assignmentId}/submissions`
- `POST /schools/{schoolId}/submissions/{submissionId}/feedback`
- `POST /schools/{schoolId}/sync/push`
- `GET /schools/{schoolId}/sync/pull`

### generated.ts 对应类型名

`components["parameters"]["SchoolId"]` → `string`

### 当前是否稳定

是，已作为统一 path parameter 使用。

### 需要 GOV-003 对照的数据库实体

- `School.id`（`String @db.Uuid`）
- `Membership`（`schoolId + userId + role`）
- `Session.activeSchoolId`（会话级活动学校）

### 已知不确定项

- **WAITING_FOR_GOv-003**：服务端是否在所有上述 endpoint 上均通过 `Membership` 校验 `schoolId` 与用户身份的一致性，而不是仅信任 URL 中的 `schoolId`。
- 403/404 边界：用户不属于学校时返回 403；资源在该学校下不存在或不可见时返回 404。

---

## 2. ErrorBody

### YAML 原文

```yaml
ErrorBody:
  type: object
  required: [code, message, requestId]
  properties:
    code:
      type: string
      pattern: "^[A-Z][A-Z0-9_]*$"
      minLength: 1
    message:
      type: string
    details:
      type: object
      additionalProperties:
        oneOf:
          - type: string
          - type: number
          - type: boolean
          - type: "null"
          - type: array
            items:
              type: string
    requestId:
      type: string
      format: uuid
```

### 被哪些 endpoint 引用

通过 `ErrorResponse` 被所有错误响应引用：

- `BadRequest`
- `Unauthorized`
- `Forbidden`
- `NotFound`
- `Conflict`
- `ServiceUnavailable`
- `TooManyRequests`
- `InternalServerError`

### generated.ts 对应类型名

`components["schemas"]["ErrorBody"]`

### 当前是否稳定

是。`details` 已由无约束任意 JSON 收紧为 `string | number | boolean | null | string[]`。

### 需要 GOV-003 对照的数据库实体

- 无需直接对照表，但 `requestId` 应来自可观测性/日志上下文，与 `AuditLog.requestId` 可关联。

### 已知不确定项

- `details` 的具体键名和数组元素类型未在领域文档中精确定义，当前为最小通用约束。

---

## 3. AnswerInput

### YAML 原文

```yaml
AnswerInput:
  type: object
  required: [activityId, kind]
  properties:
    activityId:
      type: string
      format: uuid
    kind:
      type: string
      enum: [CHOICE, TEXT, SPEECH]
    value:
      type: [string, number, boolean, array, object, "null"]
      description: 答案内容占位类型，具体按 CHOICE/TEXT/SPEECH 的结构化形态待领域模型确认
    audioAssetId:
      type: [string, "null"]
      format: uuid
```

### 被哪些 endpoint 引用

- `POST /schools/{schoolId}/assignments/{assignmentId}/submissions`（`SubmitAssignmentRequest.answers`）

### generated.ts 对应类型名

`components["schemas"]["AnswerInput"]`

### 当前是否稳定

否。`value` 类型仍为占位，未定义具体结构。

### 需要 GOV-003 对照的数据库实体

- `Answer`（`submissionId`, `activityId`, `kind`, `value Json?`, `autoResult Json?`）
- `LearningActivity.type`（`TEXT | VIDEO | AUDIO | CHOICE | FILL_BLANK | SPEECH`）
- `Question`（`kind`, `prompt`, `answerKey`）

### 已知不确定项

- **WAITING_FOR_GOv-003**：`AnswerInput.value` 与 `Answer.value` 的具体 JSON 结构。契约当前为 `string | number | boolean | array | object | null` 占位，需 GOV-003 确认是否按 `CHOICE/TEXT/SPEECH` 使用 oneOf + discriminator，或保持与 Prisma `Json?` 一致。
- `audioAssetId` 与 `Answer.audioAsset` 的一对一关系是否仍成立。

---

## 4. 提交 assignment submission 的请求 schema（SubmitAssignmentRequest）

### YAML 原文

```yaml
SubmitAssignmentRequest:
  type: object
  required: [attemptNo, answers]
  properties:
    attemptNo:
      type: integer
      minimum: 1
    deviceId:
      type: [string, "null"]
      format: uuid
    answers:
      type: array
      items:
        $ref: "#/components/schemas/AnswerInput"
```

### 被哪些 endpoint 引用

- `POST /schools/{schoolId}/assignments/{assignmentId}/submissions`

### generated.ts 对应类型名

`components["schemas"]["SubmitAssignmentRequest"]`

### 当前是否稳定

基本稳定，但受 `AnswerInput.value` 不确定性影响。

### 需要 GOV-003 对照的数据库实体

- `Submission`（`assignmentId`, `studentId`, `attemptNo`, `idempotencyKey`, `deviceId`, `revision`, `submittedAt`）
- `Answer`
- `Device`

### 已知不确定项

- **WAITING_FOR_GOv-003**：`Submission` 与 `ActivityAttempt` 的关系。Prisma 中无 `ActivityAttempt` 表，是否一个 `Submission` 即一次 attempt，还是 attempt 为更高层概念？
- `attemptNo` 的生成规则（客户端传入 vs 服务端计算）。

---

## 5. Submission 相关响应 schema（Submission / SubmissionResponse）

### YAML 原文

```yaml
Submission:
  type: object
  required: [id, assignmentId, status, attemptNo, revision, submittedAt]
  properties:
    id:
      type: string
      format: uuid
    assignmentId:
      type: string
      format: uuid
    status:
      type: string
      enum: [SUBMITTED, PROCESSING, NEEDS_REVIEW, REVIEWED, RETURNED, ACCEPTED]
    attemptNo:
      type: integer
    revision:
      type: integer
    submittedAt:
      type: string
      format: date-time

SubmissionResponse:
  type: object
  required: [data, meta]
  properties:
    data:
      $ref: "#/components/schemas/Submission"
    meta:
      $ref: "#/components/schemas/EnvelopeMeta"
```

### 被哪些 endpoint 引用

- `POST /schools/{schoolId}/assignments/{assignmentId}/submissions` → `SubmissionResponse`

### generated.ts 对应类型名

- `components["schemas"]["Submission"]`
- `components["schemas"]["SubmissionResponse"]`

### 当前是否稳定

基本稳定，但 `status` 枚举与 Prisma `SubmissionStatus` 存在差异。

### 需要 GOV-003 对照的数据库实体

- `Submission`（`SubmissionStatus`: `IN_PROGRESS | PENDING_SYNC | SUBMITTED | PROCESSING | NEEDS_REVIEW | REVIEWED | RETURNED | ACCEPTED`）

### 已知不确定项

- **WAITING_FOR_GOv-003**：契约 `Submission.status` 枚举缺少 Prisma 中的 `IN_PROGRESS` 和 `PENDING_SYNC`。GOV-003 需确认 API 层是否只暴露已提交后的状态，还是应包含本地/同步中状态。
- `submittedAt` 在 Prisma 中为可空，但契约中 required。

---

## 6. Feedback 相关请求与响应 schema（ReleaseFeedbackRequest / Feedback / FeedbackResponse）

### YAML 原文

```yaml
ReleaseFeedbackRequest:
  type: object
  required: [decision, comment]
  properties:
    decision:
      type: string
      enum: [ACCEPT, RETURN]
    comment:
      type: string
      minLength: 1
      maxLength: 4000
    score:
      type: [number, "null"]
      minimum: 0
      maximum: 100

Feedback:
  type: object
  required: [id, submissionId, decision, comment, releasedAt, revision]
  properties:
    id:
      type: string
      format: uuid
    submissionId:
      type: string
      format: uuid
    decision:
      type: string
      enum: [ACCEPT, RETURN]
    comment:
      type: string
    score:
      type: [number, "null"]
    releasedAt:
      type: string
      format: date-time
    revision:
      type: integer

FeedbackResponse:
  type: object
  required: [data, meta]
  properties:
    data:
      $ref: "#/components/schemas/Feedback"
    meta:
      $ref: "#/components/schemas/EnvelopeMeta"
```

### 被哪些 endpoint 引用

- `POST /schools/{schoolId}/submissions/{submissionId}/feedback` → `ReleaseFeedbackRequest` / `FeedbackResponse`

### generated.ts 对应类型名

- `components["schemas"]["ReleaseFeedbackRequest"]`
- `components["schemas"]["Feedback"]`
- `components["schemas"]["FeedbackResponse"]`

### 当前是否稳定

结构基本确定，但部分字段与 Prisma 存在差异。

### 需要 GOV-003 对照的数据库实体

- `Feedback`（`submissionId`, `authorUserId`, `decision`, `comment`, `score`, `revision`, `releasedAt`）

### 已知不确定项

- **WAITING_FOR_GOv-003**：
  - `Feedback` 是否允许多条（当前 Prisma `Submission.feedback` 为数组关系）。契约返回的是单条 `Feedback`，GOV-003 需确认是“最新一条”还是“唯一一条”。
  - `authorUserId` 在契约中未暴露，是否需要匿名化处理。
  - `revision` 是否与 `If-Match` 的乐观锁语义一致。

---

## 7. SyncOperation

### YAML 原文

```yaml
SyncOperation:
  type: object
  required: [operationId, entityType, entityId, action, payload, createdAt]
  properties:
    operationId:
      type: string
      format: uuid
    entityType:
      type: string
    entityId:
      type: string
    action:
      type: string
    baseRevision:
      type: [integer, "null"]
    payload:
      $ref: "#/components/schemas/SyncPayload"
    createdAt:
      type: string
      format: date-time
```

### 被哪些 endpoint 引用

- `POST /schools/{schoolId}/sync/push`（`SyncPushRequest.operations`）

### generated.ts 对应类型名

`components["schemas"]["SyncOperation"]`

### 当前是否稳定

否。`entityType`、`action` 未枚举，`payload` 结构未完全定义。

### 需要 GOV-003 对照的数据库实体

- `SyncOperation`（`deviceId`, `actorUserId`, `operationId`, `entityType`, `entityId`, `action`, `baseRevision`, `payloadHash`, `status`, `result`, `createdAt`）

### 已知不确定项

- **WAITING_FOR_GOv-003**：`SyncOperation.payload` 的具体结构。Prisma 中只有 `payloadHash`，没有 payload 原文字段。GOV-003 需确认同步 payload 是仅用于传输即时处理，还是也需要持久化。
- `action` 是否应枚举为 `upsert | delete` 等。
- `entityType` 当前为自由字符串，是否应限制为 `progress | submission | feedback` 等。

---

## 8. SyncChange

### YAML 原文

```yaml
SyncChange:
  type: object
  required: [changeId, entityType, entityId, revision, changedAt, payload]
  properties:
    changeId:
      type: string
    entityType:
      type: string
    entityId:
      type: string
    revision:
      type: integer
    changedAt:
      type: string
      format: date-time
    payload:
      $ref: "#/components/schemas/SyncPayload"
```

### 被哪些 endpoint 引用

- `GET /schools/{schoolId}/sync/pull`（`SyncPullResponse.data`）

### generated.ts 对应类型名

`components["schemas"]["SyncChange"]`

### 当前是否稳定

否。`entityType`、`changeId`、`payload` 结构未完全定义。

### 需要 GOV-003 对照的数据库实体

- Prisma 中无独立 `SyncChange` 模型。可能对应 `SyncOperation` 的处理结果视图，或需新增表。

### 已知不确定项

- **WAITING_FOR_GOv-003**：`SyncChange` 在数据库中如何表示。Prisma 仅有 `SyncOperation`，没有 `SyncChange`。GOV-003 需确认是否需要新增 `SyncChange` 表，或 `SyncChange` 只是 `SyncOperation` 服务端视角的投影。
- **WAITING_FOR_GOv-003**：`SyncChange.payload` 与 `SyncOperation.payload` 是否采用同一结构，以及是否需要按 `entityType` 区分。

---

## 9. Sync push 请求与响应（SyncPushRequest / SyncPushResponse / SyncReceipt）

### YAML 原文

```yaml
SyncPushRequest:
  type: object
  required: [deviceId, operations]
  properties:
    deviceId:
      type: string
      format: uuid
    operations:
      type: array
      maxItems: 100
      items:
        $ref: "#/components/schemas/SyncOperation"

SyncReceipt:
  type: object
  required: [operationId, status]
  properties:
    operationId:
      type: string
      format: uuid
    status:
      type: string
      enum: [ACKNOWLEDGED, CONFLICT, PERMANENT_FAILURE]
    serverRevision:
      type: [integer, "null"]
    errorCode:
      type: [string, "null"]

SyncPushResponse:
  type: object
  required: [data, meta]
  properties:
    data:
      type: array
      items:
        $ref: "#/components/schemas/SyncReceipt"
    meta:
      $ref: "#/components/schemas/EnvelopeMeta"
```

### 被哪些 endpoint 引用

- `POST /schools/{schoolId}/sync/push` → `SyncPushRequest` / `SyncPushResponse`

### generated.ts 对应类型名

- `components["schemas"]["SyncPushRequest"]`
- `components["schemas"]["SyncReceipt"]`
- `components["schemas"]["SyncPushResponse"]`

### 当前是否稳定

基本框架稳定，但 `SyncOperation.payload` 不确定会影响 push 语义。

### 需要 GOV-003 对照的数据库实体

- `Device`
- `SyncOperation`

### 已知不确定项

- `SyncReceipt.status` 与 Prisma `SyncOperationStatus` 不完全对齐（Prisma 有 `QUEUED`，契约无）。
- `serverRevision` 回填规则需 GOV-003 确认。

---

## 10. Sync pull 请求与响应（SyncPullResponse）

### YAML 原文

```yaml
SyncPullResponse:
  type: object
  required: [data, meta]
  properties:
    data:
      type: array
      items:
        $ref: "#/components/schemas/SyncChange"
    meta:
      $ref: "#/components/schemas/EnvelopeMeta"
```

### 被哪些 endpoint 引用

- `GET /schools/{schoolId}/sync/pull`

### generated.ts 对应类型名

`components["schemas"]["SyncPullResponse"]`

### 当前是否稳定

否，受 `SyncChange` 不确定性影响。

### 需要 GOV-003 对照的数据库实体

- 无直接对应表，需确认 `SyncChange` 的存储/生成方式。

### 已知不确定项

- pull 的游标语义、change 排序、分页策略未在契约中精确定义。

---

## 11. Idempotency-Key 参数

### YAML 原文

```yaml
IdempotencyKey:
  in: header
  name: Idempotency-Key
  required: true
  description: 幂等键，与认证主体、路由和请求摘要绑定；重复请求返回首次业务结果，具体保留期限由服务端策略决定
  schema:
    type: string
    minLength: 16
    maxLength: 128
```

### 被哪些 endpoint 引用

- `POST /schools/{schoolId}/assignments/{assignmentId}/submissions`
- `POST /schools/{schoolId}/sync/push`

### generated.ts 对应类型名

`components["parameters"]["IdempotencyKey"]` → `string`

### 当前是否稳定

参数定义稳定，但保留期限未写死。

### 需要 GOV-003 对照的数据库实体

- `Submission.idempotencyKey`（`@@unique([studentId, idempotencyKey])`）
- `SyncOperation`（`@@unique([actorUserId, operationId])`，operationId 由客户端生成）

### 已知不确定项

- **WAITING_FOR_GOv-003**：幂等键的存储位置。`Submission` 表有 `idempotencyKey` 字段，但 `SyncOperation` 表使用 `operationId` 作为客户端幂等标识，未单独存储 `Idempotency-Key` header 值。GOV-003 需确认是否需要统一存储 header 值，或依赖 `operationId` / `idempotencyKey` 字段。
- 保留期限策略未在契约中定义，由服务端决定。

---

## 12. If-Match 参数

### YAML 原文

```yaml
IfMatch:
  in: header
  name: If-Match
  required: true
  description: 客户端持有的资源 revision，冲突时返回 409
  schema:
    type: string
```

### 被哪些 endpoint 引用

- `PUT /schools/{schoolId}/activities/{activityId}/progress`
- `POST /schools/{schoolId}/submissions/{submissionId}/feedback`

### generated.ts 对应类型名

`components["parameters"]["IfMatch"]` → `string`

### 当前是否稳定

参数定义稳定。

### 需要 GOV-003 对照的数据库实体

- `ActivityProgress.revision`
- `Feedback.revision`
- `Assignment.revision`

### 已知不确定项

- **WAITING_FOR_GOv-003**：`If-Match` 值是否直接对应数据库 `revision` 整型字段，还是 ETag 字符串（如 `"123"` 或 W/"123"）。契约中 `If-Match` 为 `string`，但 `revision` 为 `integer`，GOV-003 需确认转换规则。
- `Assignment` 有 `revision` 但无使用 `If-Match` 的 endpoint，是否需要补充并发控制。

---

## 13. Assignment 创建请求（CreateAssignmentRequest）

### YAML 原文

```yaml
CreateAssignmentRequest:
  type: object
  required: [classId, courseVersionId, title, startsAt, dueAt]
  properties:
    classId:
      type: string
      format: uuid
    courseVersionId:
      type: string
      format: uuid
    title:
      type: string
      minLength: 1
      maxLength: 160
    startsAt:
      type: string
      format: date-time
    dueAt:
      type: string
      format: date-time
    offlineRequired:
      type: boolean
      default: false
```

### 被哪些 endpoint 引用

- `POST /schools/{schoolId}/assignments`

### generated.ts 对应类型名

`components["schemas"]["CreateAssignmentRequest"]`

### 当前是否稳定

稳定。

### 需要 GOV-003 对照的数据库实体

- `Assignment`（`schoolId`, `classId`, `courseVersionId`, `title`, `status`, `startsAt`, `dueAt`, `offlineRequired`, `revision`）

### 已知不确定项

- **WAITING_FOR_GOv-003**：`AssignmentTarget` 概念。Prisma 中 `Assignment` 直接引用 `classId`，没有独立的 `AssignmentTarget` 表。契约中也无 `AssignmentTarget`。GOV-003 需确认未来是否需要支持多班级/多学生目标，以及是否现在就需要抽象 `AssignmentTarget`。
- `completionRule` 在 Prisma 中为 `Json?`，契约请求中未体现。

---

## 14. Assignment 响应（Assignment / AssignmentResponse）

### YAML 原文

```yaml
Assignment:
  type: object
  required:
    [id, classId, courseVersionId, title, status, startsAt, dueAt, revision]
  properties:
    id:
      type: string
      format: uuid
    classId:
      type: string
      format: uuid
    courseVersionId:
      type: string
      format: uuid
    title:
      type: string
    status:
      $ref: "#/components/schemas/AssignmentStatus"
    startsAt:
      type: string
      format: date-time
    dueAt:
      type: string
      format: date-time
    revision:
      type: integer
      minimum: 1
    offlineRequired:
      type: boolean

AssignmentResponse:
  type: object
  required: [data, meta]
  properties:
    data:
      $ref: "#/components/schemas/Assignment"
    meta:
      $ref: "#/components/schemas/EnvelopeMeta"
```

### 被哪些 endpoint 引用

- `POST /schools/{schoolId}/assignments` → `AssignmentResponse`
- `POST /schools/{schoolId}/assignments/{assignmentId}:open` → `AssignmentResponse`

### generated.ts 对应类型名

- `components["schemas"]["Assignment"]`
- `components["schemas"]["AssignmentResponse"]`

### 当前是否稳定

稳定。

### 需要 GOV-003 对照的数据库实体

- `Assignment`
- `AssignmentStatus` 枚举

### 已知不确定项

- `Assignment` 有 `revision` 但无 endpoint 使用 `If-Match`，GOV-003 需确认开放任务等状态转换是否需要乐观锁。

---

## 15. Activity progress 请求与响应（SaveProgressRequest / Progress / ProgressResponse）

### YAML 原文

```yaml
SaveProgressRequest:
  type: object
  required: [position, completed]
  properties:
    position:
      type: number
      minimum: 0
    completed:
      type: boolean
    clientUpdatedAt:
      type: string
      format: date-time

Progress:
  type: object
  required: [activityId, position, completed, revision, updatedAt]
  properties:
    activityId:
      type: string
      format: uuid
    position:
      type: number
    completed:
      type: boolean
    revision:
      type: integer
    updatedAt:
      type: string
      format: date-time

ProgressResponse:
  type: object
  required: [data, meta]
  properties:
    data:
      $ref: "#/components/schemas/Progress"
    meta:
      $ref: "#/components/schemas/EnvelopeMeta"
```

### 被哪些 endpoint 引用

- `PUT /schools/{schoolId}/activities/{activityId}/progress` → `SaveProgressRequest` / `ProgressResponse`

### generated.ts 对应类型名

- `components["schemas"]["SaveProgressRequest"]`
- `components["schemas"]["Progress"]`
- `components["schemas"]["ProgressResponse"]`

### 当前是否稳定

稳定，与 `packages/domain/src/sync/merge-progress.ts` 中的 `ProgressSnapshot` 一致。

### 需要 GOV-003 对照的数据库实体

- `ActivityProgress`（`activityId`, `studentId`, `position`, `completed`, `revision`, `updatedAt`）

### 已知不确定项

- `clientUpdatedAt` 在 Prisma 中无直接字段，GOV-003 需确认是否用于冲突解决逻辑。
- `position` 在 Prisma 中为 `Float`，契约为 `number`，一致。

---

## 汇总：WAITING_FOR_GOv-003 对照项

1. **AnswerInput.value**：具体 JSON 结构，CHOICE/TEXT/SPEECH 的 oneOf 形态。
2. **Submission 与 ActivityAttempt 的关系**：Prisma 无 `ActivityAttempt` 表，attempt 概念如何映射。
3. **AssignmentTarget**：当前 `Assignment` 直接引用 `classId`，未来是否需要独立目标表。
4. **Feedback**：是否允许多条、作者字段是否暴露、revision 乐观锁语义。
5. **idempotencyKey**：`Idempotency-Key` header 与 `Submission.idempotencyKey` / `SyncOperation.operationId` 的统一存储策略。
6. **SyncOperation.payload**：具体字段与持久化策略。
7. **SyncChange.payload**：与 `SyncOperation.payload` 是否一致，以及 `SyncChange` 的存储/生成方式。
8. **If-Match 对应的数据库版本字段**：`If-Match` 字符串与 `revision` 整型的转换规则。
9. **schoolId 租户一致性**：所有学校作用域 endpoint 是否均通过 `Membership` 校验，而不是仅信任 URL。
