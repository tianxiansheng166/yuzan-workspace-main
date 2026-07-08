# API 与契约规范

## 事实源

`packages/contracts/openapi/openapi.yaml` 是外部 HTTP 契约事实源。前端类型和 mock 应由它生成。任何字段新增、删除、枚举变化、状态码变化都要走 Contract Change Request。

## URL 与版本

- 基础路径：`/api/v1`
- 资源使用复数名词：`/schools/{schoolId}/classes`
- 动作只在无法自然表达状态转换时使用：`/schools/{schoolId}/course-versions/{id}:publish`
- 不在 URL 暴露数据库实现。

## 学校租户作用域

v1 契约采用 URL 路径 `/schools/{schoolId}` 表达当前会话的活动学校。

**为什么采用路径表达租户作用域：**

- URL 路径使租户作用域对网关、缓存、日志和客户端都显式可见，避免请求头被遗漏或篡改；
- 同一用户可能属于多个学校，路径形式天然支持“切换学校即切换 URL”，不引入 `School-Id` 等第二套租户选择机制；
- 当前处于 v1 契约冻结前，尚无正式兼容消费者，路径调整成本可控。

v1 冻结后，路径变更必须通过版本号或迁移期进行，不得无版本号直接破坏路径。

学校作用域接口：

```text
/schools/{schoolId}/course-versions
/schools/{schoolId}/classes
/schools/{schoolId}/assignments
/schools/{schoolId}/students/me/today
/schools/{schoolId}/activities/{activityId}/progress
/schools/{schoolId}/assignments/{assignmentId}/submissions
/schools/{schoolId}/submissions/{submissionId}/feedback
/schools/{schoolId}/sync/push
/schools/{schoolId}/sync/pull
```

全局接口（不绑定学校作用域）：

```text
/health/live
/health/ready
/auth/login
/auth/refresh
/auth/logout
/me
```

要求：

- 所有学校作用域接口引用同一个可复用 `SchoolId` path parameter，`schoolId` 为 UUID 格式；
- 服务端必须结合 `Membership` 校验用户是否属于该学校，不能仅信任 URL 中的 `schoolId`；
- 用户不属于该学校时返回 `403 Forbidden`；
- 资源在该学校下不存在或不可见时返回 `404 Not Found`；
- 不使用 `School-Id` header 作为第二套租户选择机制；
- `operationId` 保持唯一且不包含版本号。

当前处于 v1 契约冻结前，尚无正式兼容消费者，因此本次路径调整被接受。v1 冻结后，路径变更必须通过版本号或迁移期进行。

## 响应

成功：

```json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

错误：

```json
{
  "error": {
    "code": "ASSIGNMENT_NOT_OPEN",
    "message": "当前任务尚未开放",
    "details": {},
    "requestId": "..."
  }
}
```

前端不能依据中文 `message` 判断逻辑，只使用稳定 `code`。

## 分页

游标优先：

```text
?limit=20&cursor=<opaque>
```

响应：

```json
{
  "data": [],
  "meta": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

## 幂等

- 创建提交、同步操作、文件完成上传等接口接收 `Idempotency-Key`；
- 键与认证主体、路由、请求摘要绑定；
- 重复请求返回第一次业务结果；
- 具体保留期限由服务端策略决定，当前版本不在契约中写死小时数。

## 并发控制

需要防止覆盖的资源返回 `ETag` 或 `revision`。客户端更新时发送 `If-Match`/revision；冲突返回 `409` 和可比较数据。

## 时间和标识

- ID 使用不透明 UUID/CUID，不将连续数据库 ID 暴露为安全边界；
- API 时间统一 RFC 3339 UTC；
- 学校时区只用于展示和截止规则计算；
- 金额如未来加入，以最小货币单位整数表示。

## 兼容性

- 可选字段新增通常向后兼容；
- 删除/重命名字段需要版本与迁移期；
- 枚举新增也可能破坏客户端，前端必须有 unknown fallback；
- OpenAPI lint 和 breaking-change 检查进入 CI。

## 待确认事项

- 正式法律授权名称和 URL 尚待产品所有者确认；发布生产文档前必须补充真实信息；在补充真实 URL 前，Redocly 会对 `info.license` 产生一条警告，该警告已被记录且不得用虚构 URL 消除。
- `AnswerInput.value` 的具体结构（按 CHOICE/TEXT/SPEECH 的 oneOf 形态）尚待领域模型确认，当前契约保留原始占位字段并在文档中标记。
- `SyncPayload`（`SyncOperation.payload` 与 `SyncChange.payload`）当前仅包含进度同步的已知字段（`position`、`completed`），其他 `entityType` 的负载结构待领域模型确认。
