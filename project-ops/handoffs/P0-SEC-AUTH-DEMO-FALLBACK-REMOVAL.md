# P0-SEC-AUTH-DEMO-FALLBACK-REMOVAL Handoff

- Owner: `codex-auth-builder`
- Reviewer: independent verifier
- Branch: `task/p0-sec-auth-demo-fallback-removal`
- Base commit: `41a0ff3656af7888d4c2e46eb180eeffc3414115`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：只有认证 API 返回非空 access token 与真实 user 后才保存会话；每次受保护角色页入口/刷新会先隐藏页面并用 `GET /api/v1/me` 复核持久会话，只有复核成功才显示页面。撤销、过期或其他 401 会同步清除 token/user/active-school 并跳转 `/login`；fresh context 直接跳转且不创建 demo 状态。
- 推进黄金闭环的环节：教师/学生跨页面闭环的真实身份前置条件。
- 明确未做：新增登录方式、找回密码、身份后端契约或测试账号。

## 实现与修改范围

- 实现摘要：保留 attempt 1 的登录 fail-closed 修复，并补齐独立复验发现的角色页 fail-open：共享客户端识别 teacher/student/admin/volunteer/research/assessment/select-school 入口，在任何业务请求和可见渲染前等待 `/me`；401 清除全部认证键并替换到登录页。共享请求继续统一处理服务端 401，不生成或保留 demo session。
- 主要文件：`frontend/login/app.js`、`frontend/login/index.html`、`frontend/login/styles.css`、`frontend/login/login.js`、`frontend/assets/api-client.js`，以及任务内定向测试脚本。
- 复用的现有模型/契约/组件：`POST /api/v1/auth/login`、`YuzanApi` 会话存储。
- 共享事实或 CCR：无。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 静态与会话原子性回归 | `node frontend/login/truthful-login.test.mjs` | `PASS`：畸形 200、网络异常、角色页撤销 401、fresh context 和有效 `/me` 入口均直接覆盖 |
| 真实页面 API 断开 | `pwsh -NoProfile -File frontend/login/run-truthful-login-preflight.ps1` 的 `api-unavailable` 场景 | `PASS`：390x844、POST 真实网络 502、留在 `/login`、fresh context 无认证状态 |
| 浏览器撤销会话 | 同一命令的 `revoked-session` 场景 | `PASS`：390x844，从 `/teacher` 发出 `GET /api/v1/me` 并收到夹具 401，随后进入 `/login`；token/user/school/demo 全为空；独立 fresh context 也进入登录页且存储为空；page error 为 0 |
| 真实 API 错误凭据 | 同一命令的 `invalid-credentials` 场景 | `PASS`：动态不存在账号、真实 API 401、留在 `/login`、fresh context 无认证状态 |
| API 构建 | `fnm env --shell powershell \| Out-String \| Invoke-Expression; fnm use 24; pnpm --filter @yuzan/api build` | `PASS`：Node 24.18.0 / pnpm 10.13.1 / Nest build 0 |
| Patch hygiene | `git diff --check` | `PASS`：无输出 |

attempt 2 首次浏览器撤销夹具因 Playwright URL glob 与 init-script 重放问题失败两次，修正为仅在 teacher 文档写入撤销前状态，并直接记录 `/me` request 后整套命令通过；这些失败未写成通过。浏览器失败场景的 console 各包含一条预期的 502/401 failed-resource，`unexpected_console_errors=[]`、`page_errors=[]`。截图位于本机临时目录，不作为验收替代品。

## 自审

- [x] 差异只服务任务结果且均在 `allowed_paths`
- [x] 无固定 ID、静态业务数据、假成功或 demo fallback
- [x] 相关失败/权限/offline/provider 状态真实
- [x] 最高风险有直接测试，未把 0 测试写成通过
- [x] 无密钥、真实学生数据或来源不明资产
- [x] `task-gate.ps1 -Mode review` 通过

## 风险、限制与回滚

- 已知风险：受保护页在 `/me` 完成前保持不可见；API 网络不可达也会跳转登录，但只有确认的 401/UNAUTHORIZED 才清除持久会话。
- 已知限制：Builder 撤销预检使用浏览器网络层对真实 `/api/v1/me` 请求回 401，未冒充独立 verifier 的“真实登录后 out-of-band logout”验收；独立 Verifier 仍需用真实教师会话执行该完整复现。
- 假设：现有 Identity 登录 API 契约保持不变。
- 回滚步骤：回退本任务提交，但不得恢复已确认的假成功路径。

## 集成说明

- 依赖与合并顺序：本任务无前置依赖；需先于移动登录视觉任务和教师学生闭环合入。
- Integration Lead 需要复验：真实页面 API 不可用、错误凭据、新浏览器上下文无会话，以及真实教师登录后 out-of-band `POST /api/v1/auth/logout` 再刷新 `/teacher/`。
- 推送分支/commit：由本次 `COMPLETE_CANDIDATE` 的完整 SHA 为准。
