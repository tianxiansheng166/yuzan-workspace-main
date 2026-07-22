# ACTIVE_SCHOOL_CONTRACT_FROZEN

任务：`ACTIVE_SCHOOL_CONTRACT_FREEZE_001`

状态：**FROZEN**

核验范围：后端共享 Auth/Organization 边界（`task/b31-105-platform-contracts-reporting` worktree）。

---

## 结论

正式 active-school 选择能力已实现，OpenAPI 契约与 generated types 已补齐，身份/会话/租户边界测试通过。前端可依赖服务端 `/auth/select-school` 与 `/me` 契约，不得使用本地 `activeSchoolId` 冒充已选学校。

---

## implementation

- `backend/api/src/modules/identity/identity.controller.ts`
  - `POST /auth/select-school`
  - 读取当前 access token（Authorization Bearer 或 `access_token` cookie）
  - 调用 `IdentityService.selectActiveSchoolWithAccessToken`
  - 旋转 session：吊销旧 session pair，创建新 token pair 并写入 `activeSchoolId`
  - 设置新的 `access_token` / `refresh_token` httpOnly cookies
  - 返回 `AuthSessionResponse`

- `backend/api/src/modules/identity/identity.service.ts`
  - `selectActiveSchool(userId, schoolId)`：校验用户 ACTIVE、membership ACTIVE、学校活跃且未删除、角色受支持
  - `selectActiveSchoolWithAccessToken(accessToken, schoolId)`：校验当前 access token 未过期/未吊销，然后执行选择并吊销旧 session

## endpoint

```text
POST /auth/select-school
```

同组身份端点：

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /me
```

## request

- DTO：`SelectSchoolDto`（`backend/api/src/modules/identity/dto/select-school.dto.ts`）
- 字段：`schoolId: UUID`
- 校验：`@IsUUID()`

OpenAPI schema：`#/components/schemas/SelectSchoolRequest`

## response

- 成功：`200 OK` + `AuthSessionResponse`
- 失败：
  - `400 Bad Request`：DTO 校验失败
  - `401 Unauthorized`：未提供 access token 或 token 过期/吊销
  - `403 Forbidden`：membership 非 ACTIVE、学校不允许、角色不受支持

响应 payload 示例：

```json
{
  "data": {
    "accessToken": "...",
    "activeSchoolId": "<uuid>",
    "expiresIn": 900,
    "user": {
      "id": "<uuid>",
      "displayName": "...",
      "preferredLocale": "zh-CN",
      "activeSchoolId": "<uuid>",
      "memberships": [
        { "schoolId": "<uuid>", "schoolName": "...", "role": "TEACHER" }
      ]
    }
  },
  "meta": { "requestId": "identity-select-school" }
}
```

## session mutation

- `Session` / `SessionPair` 模型字段 `activeSchoolId`（nullable UUID）
- 选择学校时：
  1. 通过 access token hash 查找当前 session pair
  2. 吊销当前 session pair（`revokedAt` 置为当前时间）
  3. 新建 session pair，写入新的 `activeSchoolId`
  4. 返回新的 access/refresh token
- refresh 旋转时：新 pair 继承当前 `activeSchoolId`，若该学校已不可用则返回 `AUTH_TENANT_NOT_ALLOWED`

## membership validation

- `findByUserAndSchool` 查询条件：
  - `membership.status = ACTIVE`
  - `school.isActive = true`
  - `school.deletedAt = null`
- 多学校用户登录时 `activeSchoolId` 为 `null`，必须显式调用 `/auth/select-school`
- 未知/不受支持角色在 `rejectUnsupportedRoles` / `isMembershipRole` 中 fail closed

## school validation

- 通过 membership 关联查询自动过滤：学校必须 `isActive = true` 且 `deletedAt IS NULL`
- 软删除学校或禁用学校的 membership 不会被返回，选择时返回 `AUTH_TENANT_NOT_ALLOWED`

## tenant behavior

- 单一 active membership：登录后自动设置 `activeSchoolId`
- 多个 active memberships：登录后 `activeSchoolId = null`，必须显式选择
- 选择后 `/me` 通过 `CurrentTenant` decorator 返回服务端确认的 `activeSchoolId`
- 后续请求由 `AuthGuard` + `TenantGuard` 从服务端 session 重建 `TenantContext`，拒绝客户端伪造

## OpenAPI

- 文件：`packages/contracts/openapi/openapi.yaml`
- 路径：`/auth/select-school`（operationId: `selectSchool`）
- schema：`SelectSchoolRequest`、`AuthSessionResponse`、`AuthSession`、`CurrentUserResponse`、`CurrentUser`、`Membership`
- `/me` 路径存在，返回 `CurrentUserResponse`，并在 `CurrentUser` 中暴露 `activeSchoolId`

## generated types

- 文件：`packages/contracts/src/generated.ts`
- 已生成：
  - `paths["/auth/select-school"]`
  - `operations["selectSchool"]`
  - `components["schemas"]["SelectSchoolRequest"]`
  - `components["schemas"]["AuthSession"]` 包含 `activeSchoolId: string | null`
  - `components["schemas"]["CurrentUser"]` 包含 `activeSchoolId?: string`

生成命令：`pnpm contract:types`（基于 `packages/contracts/openapi/openapi.yaml`）

## tests

- `backend/api/test/auth/identity.service.spec.ts`：38 tests
  - 覆盖登录默认选择单学校
  - 覆盖多学校时 `activeSchoolId = null`
  - 覆盖 `selectActiveSchool` 成功与失败（无 membership、 suspended、非 active 学校等）
  - 覆盖 refresh 旋转、并发刷新、token 过期、session 吊销
- `backend/api/test/auth/identity.controller.spec.ts`：9 tests
  - 覆盖 controller 路由元数据（包括 `/auth/select-school`）
  - 覆盖 DTO 校验、错误统一化、logout 无响应体
- `backend/api/test/auth/session-auth-context.source.spec.ts`：5 tests
- 本次运行结果：**52 passed, 0 failed**

命令：

```bash
pnpm --filter @yuzan/api test -- test/auth
```

## full commit

- 分支：`task/b31-105-platform-contracts-reporting`
- worktree：`D:\program\test_program\yuzanxinsheng\three\worktrees\b31-105`
- HEAD：`9433b26cd5bd39bace954e9bcfa122e99cfdeafb`
- 提交信息：`docs(ops): apply MODEL_ALLOCATION_POLICY_V2 to backend v31 dispatch`

本次 freeze 校验产生的未提交修改：

- `backend/api/src/modules/identity/identity.service.ts`：修正 `selectActiveSchool` 注释，明确其对应正式 OpenAPI `/auth/select-school` 端点
- `backend/api/test/auth/identity.controller.spec.ts`：补充 `selectSchool` 路由元数据断言

## remote commit

- 远程分支：`origin/task/b31-105-platform-contracts-reporting`
- HEAD：`9433b26cd5bd39bace954e9bcfa122e99cfdeafb`
- 本地与远程一致

## frontend binding notes

- API client：`apps/web/app/lib/api/client.ts`
  - 已绑定 `selectSchool(schoolId: string)` -> `POST /auth/select-school`
  - 已绑定 `currentUser()` -> `GET /me`
  - 自动 refresh 机制在 401 时调用 `/auth/refresh`，refresh 响应包含新的 `activeSchoolId`
- Session gateway：`apps/web/app/features/auth/adapters/browser-session-gateway.ts`
  - 只保存 `role`、`serviceMode`、`expiresAt` 等轻量会话记录
  - **不保存本地 `schoolId`**；学校上下文以服务端 session 与 `/me` 返回的 `activeSchoolId` 为准
- Type：`apps/web/app/lib/api/types.ts` 中 `CurrentUser.activeSchoolId?: string`

---

## 备注与限制

1. `/auth/me` 在契约中不存在；当前契约路径为 `/me`，返回结构与 prompt 中 `/auth/me` 的预期一致（CurrentUser + activeSchoolId）。如前端已按 `/auth/me` 实现，需统一调整为 `/me`。
2. 全量 `pnpm typecheck` 在 b31-105 worktree 中因 `@yuzan/database` 类型解析与部分 Prisma 模型未生成而失败；身份模块单元测试独立通过。该问题为 worktree 级 Prisma client 生成/解析问题，非 active-school 逻辑缺陷。
3. 当前无独立服务端缓存层；session 切换通过 token 旋转自然使旧 access token 失效，无需额外缓存失效逻辑。
