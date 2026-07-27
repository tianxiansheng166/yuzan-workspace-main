# P0-SEC-AUTH-DEMO-FALLBACK-REMOVAL Handoff

- Owner: `codex-auth-builder`
- Reviewer: independent verifier
- Branch: `task/p0-sec-auth-demo-fallback-removal`
- Base commit: `41a0ff3656af7888d4c2e46eb180eeffc3414115`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：受保护角色页入口先隐藏页面并用 `GET /api/v1/me` 复核会话；共享客户端现已正确识别 canonical API 返回的扁平 CurrentUser（`data.id / memberships / activeSchoolId`），规范化后再以服务端 `activeSchoolId` 定位当前 membership 并核对路由角色。真实 STUDENT 会话可稳定显示 `/student/today`；角色不匹配时页面始终隐藏并跳转该有效会话的授权首页，保留 token/user/school；撤销、过期、畸形会话或其他 401 才清除会话并跳转 `/login`。
- 推进黄金闭环的环节：教师/学生跨页面闭环的真实身份前置条件。
- 明确未做：新增登录方式、找回密码、身份后端契约或测试账号。

## 实现与修改范围

- 实现摘要：attempt 4 只修复 review round 2 的学生角色首页循环。真实 `/me` 返回 CurrentUser 字段直接位于 `data`，旧客户端却只读取 `data.user`，导致 `/me=200` 后仍按“无用户”跳 `/select-school`。`me()` 现在兼容 canonical 扁平形状和既有 wrapped 形状，拒绝缺少有效用户的 200 响应，并返回统一的 `{ user, activeSchoolId }` 供入口授权。attempt 3 的角色映射与 reveal 前校验不变。
- 主要文件：`frontend/login/app.js`、`frontend/login/index.html`、`frontend/login/styles.css`、`frontend/login/login.js`、`frontend/assets/api-client.js`，以及任务内定向测试脚本。
- 复用的现有模型/契约/组件：`POST /api/v1/auth/login`、`YuzanApi` 会话存储。
- 共享事实或 CCR：无。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| attempt 4 `/me` 契约与角色入口定向回归 | `node frontend/login/truthful-login.test.mjs` | `PASS`：使用真实扁平 CurrentUser 响应形状证明 STUDENT→`/student/today` 与 TEACHER→`/teacher` 正常 reveal；STUDENT→`/teacher`、TEACHER→`/student` 仍保持 hidden 并回授权首页；撤销 401 与畸形会话仍清空 |
| 真实 STUDENT 注册与角色首页 | `pwsh -NoProfile -File frontend/login/run-truthful-login-preflight.ps1` 的 `authenticated-student` 场景 | `PASS`：390x844 Chromium 动态注册返回 201，三次真实 `/me` 均 200，server-issued school scope 与 STUDENT membership 一致；浏览器稳定在 `/student/today/`，直接访问 `/teacher/` 后回到学生首页，token/user/school 保留、demo 为空、console/page error 为 0 |
| 真实页面 API 断开 | `pwsh -NoProfile -File frontend/login/run-truthful-login-preflight.ps1` 的 `api-unavailable` 场景 | `PASS`：390x844、POST 真实网络 502、留在 `/login`、fresh context 无认证状态 |
| 浏览器撤销会话 | 同一命令的 `revoked-session` 场景 | `PASS`：390x844，从 `/teacher` 发出 `GET /api/v1/me` 并收到夹具 401，随后进入 `/login`；token/user/school/demo 全为空；独立 fresh context 也进入登录页且存储为空；page error 为 0 |
| 真实 API 错误凭据 | 同一命令的 `invalid-credentials` 场景 | `PASS`：动态不存在账号、真实 API 401、留在 `/login`、fresh context 无认证状态 |
| API 构建 | `fnm env --shell powershell \| Out-String \| Invoke-Expression; fnm use 24; pnpm --filter @yuzan/api build` | `PASS`：Node 24.18.0 / pnpm 10.13.1 / Nest build 0 |
| Patch hygiene | `git diff --check` | `PASS`：无输出 |

attempt 4 重新运行完整 Builder 浏览器预检，覆盖 API unavailable、invalid credentials、revoked session 与 authenticated STUDENT；这些证据不冒充独立 Verifier 的 `VERIFIED`。

## 自审

- [x] 差异只服务任务结果且均在 `allowed_paths`
- [x] 无固定 ID、静态业务数据、假成功或 demo fallback
- [x] 相关失败/权限/offline/provider 状态真实
- [x] 最高风险有直接测试，未把 0 测试写成通过
- [x] 无密钥、真实学生数据或来源不明资产
- [x] `task-gate.ps1 -Mode review` 通过

## 风险、限制与回滚

- 已知风险：受保护页在 `/me` 和角色核对完成前保持不可见；若服务端返回的 `activeSchoolId` 找不到对应 membership，会安全跳转 `/select-school` 且不清除有效会话。
- 已知限制：Builder 正向旅程使用真实注册/API/数据库，但独立 Verifier 仍需在新环境确认页面 settle，并执行真实 out-of-band logout；Builder 不签发 `VERIFIED`。
- 假设：现有 Identity 登录 API 契约保持不变。
- 回滚步骤：回退本任务提交，但不得恢复已确认的假成功路径。

## 集成说明

- 依赖与合并顺序：本任务无前置依赖；需先于移动登录视觉任务和教师学生闭环合入。
- Integration Lead 需要复验：真实 `/me` 扁平响应下 STUDENT 登录后稳定停留在 `/student/today`；真实 STUDENT 会话直接导航 `/teacher` 与真实 TEACHER 会话直接导航 `/student` 时，目标角色内容从未可见、有效会话保留并进入授权首页；撤销会话仍清除。
- 推送分支/commit：由本次 `COMPLETE_CANDIDATE` 的完整 SHA 为准。
