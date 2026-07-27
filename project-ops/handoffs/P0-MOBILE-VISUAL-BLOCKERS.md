# P0-MOBILE-VISUAL-BLOCKERS Handoff

- Owner: codex-account-b-mobile-builder
- Reviewer: Independent Browser Visual Verifier
- Branch: task/p0-mobile-visual-blockers
- Base commit: 79c1711057ed4b6f353b3454afdc58cfee8d38b1
- Attempt / fence: `2` / `37`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：教师或学生可在 390px 移动端清晰看到并操作真实登录表单；服务不可用时错误文案完整呈现且登录保持关闭。
- 推进黄金闭环的环节：解除 390px 移动端真实登录入口的视觉与交互阻塞。
- 明确未做：不修改认证契约、后端、全局路由或其他页面；不自验收或自集成。

## 实现与修改范围

- 实现摘要：收紧移动端高原展示区，缩放竖版 Logo 并将故事文案改为底部独立层级；扩大密码显隐、记住状态、找回密钥等点击目标；错误状态改为可增长容器；在既有 Playwright verifier 中加入登录/注册切换、overflow、几何分离、tap target 与错误裁切断言。
- 主要文件：`frontend/login/styles.css`、`frontend/login/verify_truthful_login.py`。
- 复用的现有模型/契约/组件：`FC-TRUTHFUL-LOGIN` 与已接受的 truthful-auth 行为。
- 共享事实或 CCR：无。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 开工上下文 | `mvp-control.ps1 -Action context` | `PASS` |
| Git/白名单门禁 | `task-context.ps1 -Mode auto` | `PASS`：task、branch、base 与 changed paths 校验通过 |
| truthful-auth 聚焦单测 | `node --test frontend/login/truthful-login.test.mjs` | `PASS`：1/1，0 fail，0 skipped |
| verifier 语法 | `python -m py_compile frontend/login/verify_truthful_login.py` | `PASS` |
| 390px 动态失败旅程 | 隔离前端端口 `45231`、不可用 API 端口 `45999`，运行 `verify_truthful_login.py --mode api-unavailable --viewport-width 390 --viewport-height 844` | `PASS`：无横向溢出；Logo/故事分离；关键 tap target ≥44px；502 错误完整；fresh context 无会话；unexpected console/page errors 均为空 |
| 跨尺寸动态回归 | 同一隔离服务运行 `1024x768` 与 `1440x900` | `PASS`：无横向溢出、错误裁切或非预期 console/page error |
| Attempt 2 截图复核 | 查看 `yuzan-login-attempt2-390x844.png` 原始尺寸截图 | `PASS`：品牌、故事与登录卡片层级清晰，表单可操作，502 错误文案完整可读 |
| 差异检查 | `git diff --check` | `PASS` |
| Review gate | `task-gate.ps1 -Mode review -TaskFile .\project-ops\tasks\active\P0-MOBILE-VISUAL-BLOCKERS.json` | `PASS`：4 个 changed paths 均在白名单内 |

以上聚焦单测、三档浏览器旅程、语法与差异检查均于 attempt 2、fencing epoch 37 重新执行，
不是沿用 attempt 1 的测试结论。浏览器输出标记为 `BUILDER_PREFLIGHT_ONLY`，不冒充独立验收。

## 自审

- [x] 差异只服务任务结果且均在 `allowed_paths`
- [x] 无固定 ID、静态业务数据、假成功或 demo fallback
- [x] 相关失败/权限/offline/provider 状态真实
- [x] 最高风险有直接测试，未把 0 测试写成通过
- [x] 无密钥、真实学生数据或来源不明资产
- [x] `task-gate.ps1 -Mode review` 通过

## 风险、限制与回滚

- 已知风险：移动布局使用 `-webkit-line-clamp` 收拢展示区说明文案；不支持该属性的浏览器仍会由固定展示区裁切视觉说明，但不会遮挡或阻止登录表单。
- 已知限制：本机端口 4000 无真实 API 监听，未重跑 authenticated-student 与真实 401；本候选不启动共享后端/数据库。独立 verifier 仍需在可控真实 API 上从 fresh context 完成最终验收。
- 假设：已接受的 `79c1711057ed4b6f353b3454afdc58cfee8d38b1` truthful-auth 行为作为本任务认证基线；本候选只改变布局与 verifier。
- 回滚步骤：由 Integration Lead 回退本任务单一提交。

## 集成说明

- 依赖与合并顺序：已接受 auth integration → 本候选 → 独立浏览器验证。
- Integration Lead 需要复验：390px 可见旅程、overflow/tap targets、502/401 错误呈现、console/page errors，以及真实 API 下成功登录与 fail-closed。
- 推送分支/commit：最终候选以 fenced `COMPLETE_CANDIDATE` 事件中的完整 commit 为准。
