# P0-SEC-AUTH-DEMO-FALLBACK-REMOVAL Handoff

- Owner: `codex-auth-builder`
- Reviewer: independent verifier
- Branch: `task/p0-sec-auth-demo-fallback-removal`
- Base commit: `41a0ff3656af7888d4c2e46eb180eeffc3414115`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：只有认证 API 返回非空 access token 与真实 user 后才保存会话并进入角色页面；API 不可用、离线、错误凭据或畸形成功响应均留在登录页且不保留认证状态。
- 推进黄金闭环的环节：教师/学生跨页面闭环的真实身份前置条件。
- 明确未做：新增登录方式、找回密码、身份后端契约或测试账号。

## 实现与修改范围

- 实现摘要：移除当前与遗留登录脚本中的 demo-token、离线登录和异常回退；共享 API 客户端先清旧会话、校验服务端会话载荷后再原子保存；登录页以可访问状态区域显示 401/403/offline/5xx/invalid-session，不再用演示弹窗冒充完成。
- 主要文件：`frontend/login/app.js`、`frontend/login/index.html`、`frontend/login/styles.css`、`frontend/login/login.js`、`frontend/assets/api-client.js`，以及任务内定向测试脚本。
- 复用的现有模型/契约/组件：`POST /api/v1/auth/login`、`YuzanApi` 会话存储。
- 共享事实或 CCR：无。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 静态与会话原子性回归 | `node frontend/login/truthful-login.test.mjs` | `PASS`：畸形 200 与网络异常均拒绝且无认证持久化 |
| 真实页面 API 断开 | `pwsh -NoProfile -File frontend/login/run-truthful-login-preflight.ps1` 的 `api-unavailable` 场景 | `PASS`：390x844、POST 真实网络 502、留在 `/login`、fresh context 无认证状态 |
| 真实 API 错误凭据 | 同一命令的 `invalid-credentials` 场景 | `PASS`：动态不存在账号、真实 API 401、留在 `/login`、fresh context 无认证状态 |
| API 构建 | `fnm use 24; pnpm --filter @yuzan/api build` | `PASS`：Node 24.18.0 / pnpm 10.13.1 / Nest build 0 |
| Patch hygiene | `git diff --check` | `PASS`：无输出 |

首次 API build 因新 worktree 未挂载已安装的 package `node_modules` 返回 `nest is not recognized`；只连接 canonical 已安装依赖、没有执行安装或修改 lockfile，随后同一 build 通过。浏览器失败场景的 console 各包含一条预期的 502/401 failed-resource，`unexpected_console_errors=[]`、`page_errors=[]`。截图位于本机临时目录，不作为验收替代品。

## 自审

- [x] 差异只服务任务结果且均在 `allowed_paths`
- [x] 无固定 ID、静态业务数据、假成功或 demo fallback
- [x] 相关失败/权限/offline/provider 状态真实
- [x] 最高风险有直接测试，未把 0 测试写成通过
- [x] 无密钥、真实学生数据或来源不明资产
- [x] `task-gate.ps1 -Mode review` 通过

## 风险、限制与回滚

- 已知风险：共享客户端现在会在新登录/注册开始前清除旧 localStorage 会话；这是防止失败后继续沿用旧身份的预期 fail-closed 行为。
- 已知限制：Builder 只完成 502、真实 401 与 fresh context 负向预检；独立 Verifier 仍需从干净集成提交复验有效教师/学生登录、角色/学校边界和撤销/过期会话。
- 假设：现有 Identity 登录 API 契约保持不变。
- 回滚步骤：回退本任务提交，但不得恢复已确认的假成功路径。

## 集成说明

- 依赖与合并顺序：本任务无前置依赖；需先于移动登录视觉任务和教师学生闭环合入。
- Integration Lead 需要复验：真实页面 API 不可用、错误凭据、新浏览器上下文无会话。
- 推送分支/commit：提交后补充。
