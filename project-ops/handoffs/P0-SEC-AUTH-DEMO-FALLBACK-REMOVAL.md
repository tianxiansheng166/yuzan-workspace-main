# P0-SEC-AUTH-DEMO-FALLBACK-REMOVAL Handoff

- Owner: `codex-auth-builder`
- Reviewer: independent verifier
- Branch: `task/p0-sec-auth-demo-fallback-removal`
- Base commit: `41a0ff3656af7888d4c2e46eb180eeffc3414115`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：受保护角色页入口先隐藏页面并用 `GET /api/v1/me` 复核会话，再以响应中的 `activeSchoolId` 定位服务端确认的当前 membership 并核对路由角色。角色匹配才显示页面；角色不匹配时页面始终隐藏并跳转该有效会话的授权首页，保留 token/user/school；撤销、过期或其他 401 才清除会话并跳转 `/login`。
- 推进黄金闭环的环节：教师/学生跨页面闭环的真实身份前置条件。
- 明确未做：新增登录方式、找回密码、身份后端契约或测试账号。

## 实现与修改范围

- 实现摘要：attempt 3 只修复新拒绝的跨角色边界。共享入口校验把 teacher/student/assessment/admin/volunteer/research 路由映射到允许角色，使用 `/me` 的 `activeSchoolId` 对应 membership 判定；跨角色返回 false、保持 document hidden 并 `replace` 到当前角色首页。有效跨角色会话不清除，401 的原子清理行为保持不变。
- 主要文件：`frontend/login/app.js`、`frontend/login/index.html`、`frontend/login/styles.css`、`frontend/login/login.js`、`frontend/assets/api-client.js`，以及任务内定向测试脚本。
- 复用的现有模型/契约/组件：`POST /api/v1/auth/login`、`YuzanApi` 会话存储。
- 共享事实或 CCR：无。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| attempt 3 角色入口定向回归 | `node frontend/login/truthful-login.test.mjs` | `PASS`：STUDENT→`/teacher` 跳 `/student/today`、TEACHER→`/student` 跳 `/teacher`，两者均始终 hidden 且保留有效 token/user/school；TEACHER→`/teacher` 正常 reveal；撤销 401 仍清空并进 `/login` |
| 真实页面 API 断开 | `pwsh -NoProfile -File frontend/login/run-truthful-login-preflight.ps1` 的 `api-unavailable` 场景 | `PASS`：390x844、POST 真实网络 502、留在 `/login`、fresh context 无认证状态 |
| 浏览器撤销会话 | 同一命令的 `revoked-session` 场景 | `PASS`：390x844，从 `/teacher` 发出 `GET /api/v1/me` 并收到夹具 401，随后进入 `/login`；token/user/school/demo 全为空；独立 fresh context 也进入登录页且存储为空；page error 为 0 |
| 真实 API 错误凭据 | 同一命令的 `invalid-credentials` 场景 | `PASS`：动态不存在账号、真实 API 401、留在 `/login`、fresh context 无认证状态 |
| API 构建 | `fnm env --shell powershell \| Out-String \| Invoke-Expression; fnm use 24; pnpm --filter @yuzan/api build` | `PASS`：Node 24.18.0 / pnpm 10.13.1 / Nest build 0 |
| Patch hygiene | `git diff --check` | `PASS`：无输出 |

attempt 3 未重复运行已在候选 `71962892dbde003fd3630eb98732dabe535d97da` 通过的 invalid-credential、offline、malformed-success、L3 或 L4 旅程；本轮只运行能证伪新拒绝边界的四场景共享入口测试。既有 attempt 2 浏览器证据保留为历史证据，不冒充本轮独立验证。

## 自审

- [x] 差异只服务任务结果且均在 `allowed_paths`
- [x] 无固定 ID、静态业务数据、假成功或 demo fallback
- [x] 相关失败/权限/offline/provider 状态真实
- [x] 最高风险有直接测试，未把 0 测试写成通过
- [x] 无密钥、真实学生数据或来源不明资产
- [x] `task-gate.ps1 -Mode review` 通过

## 风险、限制与回滚

- 已知风险：受保护页在 `/me` 和角色核对完成前保持不可见；若服务端返回的 `activeSchoolId` 找不到对应 membership，会安全跳转 `/select-school` 且不清除有效会话。
- 已知限制：本轮 Builder 只运行共享客户端的定向角色入口回归；独立 Verifier 仍需用真实 STUDENT 会话复验 `/teacher` 文档从未可见，并对称复验 TEACHER→`/student`。
- 假设：现有 Identity 登录 API 契约保持不变。
- 回滚步骤：回退本任务提交，但不得恢复已确认的假成功路径。

## 集成说明

- 依赖与合并顺序：本任务无前置依赖；需先于移动登录视觉任务和教师学生闭环合入。
- Integration Lead 需要复验：真实 STUDENT 会话直接导航 `/teacher` 与真实 TEACHER 会话直接导航 `/student` 时，目标角色内容从未可见、有效会话保留并进入授权首页；同角色入口仍正常；撤销会话仍清除。
- 推送分支/commit：由本次 `COMPLETE_CANDIDATE` 的完整 SHA 为准。
