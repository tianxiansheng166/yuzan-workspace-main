# API 冻结规则

## 基线 API 状态

基线 `22e3e1443bf82cf3d5b9b14c3de606126ece5e39` 已暴露的 API：

- `GET /health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/revoke-session`
- `GET /api/v1/schools`（active school list）
- `POST /api/v1/schools/:schoolId/select`
- `GET /api/v1/schools/:schoolId/courses`
- `POST /api/v1/schools/:schoolId/courses`
- `GET /api/v1/schools/:schoolId/courses/:courseId`
- `PATCH /api/v1/schools/:schoolId/courses/:courseId`

以上 endpoint 的语义、路径、请求/响应 DTO 在当前 wave 中保持冻结。

## 冻结规则

### 1. 已冻结 endpoint

基线已存在的 endpoint：

- 不得修改 path；
- 不得删除字段；
- 不得修改字段语义；
- 新增可选字段需经过 Trae-1 审核并更新 OpenAPI；
- 新增必填字段视为破坏变更，必须走 contract request。

### 2. 新增 endpoint

每个任务新增的 endpoint 必须：

- 符合 `02-architecture/API-STANDARDS.md`；
- 前缀为 `/api/v1`；
- 学校级资源路径为 `/api/v1/schools/{schoolId}/...`；
- 提交 contract request；
- 由 Trae-1 写入 OpenAPI 草案并在 `API-FREEZE.md` 登记。

### 3. 错误码

错误码统一为 `SNAKE_CASE_ALL_CAPS`，例如：

- `CONCURRENT_MODIFICATION`
- `ASSIGNMENT_NOT_FOUND`
- `ASSESSMENT_ATTEMPT_NOT_SUBMITTABLE`
- `PERMISSION_DENIED`
- `TENANT_REQUIRED`

新增错误码需在 contract request 中登记。

### 4. OpenAPI 同步

- 代码实现必须与 `packages/contracts/openapi/` 中的 OpenAPI 文件同步；
- Trae-1 负责维护 OpenAPI 主版本；
- 各任务不得直接修改 OpenAPI 文件，除非 Trae-1 授权。

### 5. API Freeze 节点

| 阶段 | 时间 | 冻结范围 |
|------|------|----------|
| Wave 1 | b31-101/102/103 开发中 | 基线 endpoint 冻结 |
| Wave 2 | b31-104/105 开发中 | Wave 1 新增 endpoint 冻结 |
| Wave 3 | 前端联调前 | 所有 V3.1 endpoint 冻结 |

## 变更登记

每次 API 变更后，Trae-1 更新本文件以下内容：

```markdown
### YYYY-MM-DD 变更记录

- 新增 `POST /api/v1/schools/{schoolId}/assignments`
- 修改 `GET /api/v1/schools/{schoolId}/courses` 增加 `status` 过滤参数
- 责任人：Trae-X
```

## 当前变更记录

- 2026-07-11：初始化 API-FREEZE，基线 endpoint 冻结。
- 2026-07-11：新增 Reporting endpoints:
  - `GET /api/v1/schools/{schoolId}/reports` — 列出报表
  - `POST /api/v1/schools/{schoolId}/reports` — 请求生成报表
  - `GET /api/v1/schools/{schoolId}/reports/{reportId}` — 获取报表详情
  - `GET /api/v1/schools/{schoolId}/student-growth/{enrollmentId}` — 获取学生成长档案
- 2026-07-11：新增 Offline endpoints:
  - `GET /api/v1/schools/{schoolId}/offline-packages` — 列出离线内容包
  - `POST /api/v1/schools/{schoolId}/offline-packages` — 请求构建离线内容包
  - `GET /api/v1/schools/{schoolId}/offline-packages/{packageId}` — 获取离线内容包详情
  - `POST /api/v1/schools/{schoolId}/offline-packages/{packageId}:download` — 授权下载
  - `POST /api/v1/schools/{schoolId}/sync-batches` — 提交同步批次
  - `GET /api/v1/schools/{schoolId}/sync-batches/{batchId}` — 获取同步批次状态
- 2026-07-11：新增 Operations endpoints:
  - `GET /api/v1/operations/status` — 系统运维状态（Public，无需认证）
- 责任人：Trae-1
