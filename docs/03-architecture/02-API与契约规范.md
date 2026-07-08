# API 与契约规范

## 事实源

`packages/contracts/openapi/openapi.yaml` 是外部 HTTP 契约事实源。前端类型和 mock 应由它生成。任何字段新增、删除、枚举变化、状态码变化都要走 Contract Change Request。

## URL 与版本

- 基础路径：`/api/v1`
- 资源使用复数名词：`/schools/{schoolId}/classes`
- 动作只在无法自然表达状态转换时使用：`/course-versions/{id}:publish`
- 不在 URL 暴露数据库实现。

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
- 键保存期限写入接口文档。

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
