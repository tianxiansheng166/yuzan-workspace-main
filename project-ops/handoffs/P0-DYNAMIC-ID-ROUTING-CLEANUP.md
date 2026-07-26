# P0-DYNAMIC-ID-ROUTING-CLEANUP Handoff

- Owner: `codex-account-c-dynamic-builder`（attempt 5，review round 1）
- Reviewer: independent verifier
- Branch: `task/p0-dynamic-id-routing-cleanup`
- Base commit: `41a0ff3656af7888d4c2e46eb180eeffc3414115`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：教师侧栏、教学任务、测评页和学生详情中的复核入口不再跳转固定业务 ID；服务端只允许提交 owner、同班教师或学校管理员读取该动态 submission，同班教师响应包含真实持久化答案/录音证据；`RETURN` 与具体反馈原子保存为 `RETURNED`，revision 恰好递增一次，刷新后返回相同状态与反馈。
- 推进黄金闭环的环节：解除 `TEACHER_DYNAMIC_REVIEW` 的前端固定 ID 与动态详情不可达阻塞。
- 明确未做：未新增 `REDO_REQUIRED` 状态、未修改 Prisma、未合并或签发 `VERIFIED`，也未重复已证明的前端路由浏览器工作。

## 实现与修改范围

- 实现摘要：
  - 新增 `/teacher/reviews/` 真实队列页，依次读取当前学校的 assignments 和 assignment submissions，只渲染 API 返回且处于 `NEEDS_REVIEW` / `SUBMITTED` 的动态提交。
  - API 未认证、不可用、部分任务失败和空队列都有明确状态；不回退到演示数据。
  - `/teacher/submissions/{submissionId}` 由 server 映射到现有详情页；修正详情页绝对资源路径并补齐 API client，使 pathname 中的动态 ID 真正进入详情请求。
  - 详情无数据时禁用“批改 / 通过 / 退回”，避免空证据仍可操作。
  - attempt 2 将证据门控应用到成功 GET：只有响应中存在非空书面答案或录音 URL 且状态为 `NEEDS_REVIEW` 时才启用复核动作；播放按钮无录音始终禁用。
  - attempt 2 移除假播放切换，改用真实 `<audio>`；播放失败显示可操作错误。
  - attempt 2 将无效 `decision: REJECT` 改为后端 DTO 接受的 `RETURN`，要求教师填写具体反馈；400/403/409 分别显示校验、权限、版本冲突状态，成功后重新 GET，不做本地假成功。
  - 教学任务行按钮按 assignment ID 请求提交，优先打开待复核或最新提交；零提交时停留当前页并提示真实空状态。
  - 原 `reviews/submission-1` 静态目录迁移为 `reviews/assignment`，保留动态 assignment 复核兼容页但移除固定占位 ID。
  - attempt 3 为 submission GET 增加 owner / same-class teacher / school admin 资源策略；STUDENT 他人提交与跨班教师明确 403。
  - attempt 3 从已关联的 `ActivityAttempt.value`、finalized `WrittenAnswer`、ready `Recording.objectKey` 和最新 `Feedback` 读取真实证据；无真实记录时不生成字段。
  - attempt 3 为 feedback POST 增加同班教师策略，并在单事务内以 `status=NEEDS_REVIEW + revision` 谓词更新状态/revision 后保存反馈；竞争写返回 409 并回滚。
- 主要文件：既有前端 checkpoint；`backend/api/src/modules/submissions/**`、`backend/api/src/modules/feedback/**`、两模块聚焦测试、OpenAPI/generated contracts。
- 复用的现有模型/契约/组件：Assignment / Submission / Enrollment / ActivityAttempt / AssessmentSession / WrittenAnswer / Recording / Feedback、`StoragePort.generateDownloadUrl`、现有 `RETURNED` 状态与事务并发模式。
- 共享事实或 CCR：添加可选 Submission evidence/feedback 响应字段；CCR 为 `project-ops/requests/CCR-P0-DYNAMIC-ID-ROUTING-CLEANUP.md`。无 Prisma 或状态枚举变化。

## 实际验证

2026-07-27 00:47 +08:00 在候选提交 `7f2e758c274ce3aebab4fd99cd7a826f65d6fc61`
上完成续租复核。先使用 Node 24.18.0 和现有离线 pnpm store 重建 worktree 中被旧绝对路径
破坏的 ignored `node_modules` 链接；未下载依赖、未修改 lockfile 或任务源码。随后重新运行
全部最小测试，结果如下。

2026-07-27 01:24–01:28 +08:00 在 attempt 5 起始候选
`56537c4b3be4feef3e9ffd959f3d3ac9f7c2ba8e` 上使用当前 lease
`4a8aafee-d25f-4ecd-a280-908377385deb` 和 fencing epoch `24` 再次完成全部最小测试。
本轮 shell 使用 Node 22.19.0，pnpm 如实提示仓库期望 Node `>=24 <27`；聚焦测试均实际
执行并通过，没有安装依赖或修改 lockfile。

| 检查                                   | 命令                                                                                                                                                                     | 结果                                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 固定业务 ID 源码证伪                   | `rg -n --glob '!**/node_modules/**' --glob '!**/assets/**' "submission-1\|course-1\|assignment-1" frontend/server.mjs frontend/shared/teacher-shell.js frontend/teacher` | `PASS`：attempt 4 退出码 1，零匹配                                                                                                                                                        |
| 语法与差异检查                         | 对本任务 8 个变更 JS 逐个 `node --check`；`python -m py_compile frontend/teacher/reviews/verify-routing.py`；`git diff --check 41a0ff3..HEAD`                            | `PASS`：attempt 4 全部通过                                                                                                                                                                |
| attempt 1 真实浏览器负向导航           | `with_server.py --server "node frontend/server.mjs" --port 4176 -- python frontend/teacher/reviews/verify-routing.py`                                                    | `PASS`：这是被正式 L5 拒绝前的历史局部证据，不再用于声称动态详情服务端权限通过                                                                                                            |
| attempt 2 证据门控与 Return UI 回归    | `PORT=4176 API_BASE_URL=http://127.0.0.1:4000 node frontend/server.mjs` + `python frontend/teacher/reviews/verify-routing.py`                                            | `PASS`：未知角色不发 submission GET；无证据时四个控件全禁用；有书面证据时发送 `RETURN` 与具体反馈，重新 GET 后显示 `RETURNED`。聚焦 route fixture 只证明前端契约，不证明服务器授权/持久化 |
| attempt 2 静态检查                     | `node --check frontend/teacher/submissions/detail/app.js`; `python -m py_compile frontend/teacher/reviews/verify-routing.py`; `git diff --check`                         | `PASS`                                                                                                                                                                                    |
| attempt 4 浏览器路由复核               | `with_server.py --server "node frontend/server.mjs" --port 4176 -- python frontend/teacher/reviews/verify-routing.py`                                                    | `PASS`：4/4 checks；未知角色不发 submission GET；无证据动作禁用；`RETURN` 后 fresh GET 显示 `RETURNED`；`page_errors=0`                                                                   |
| submission 授权、真实证据与 fresh-read | `pnpm --filter @yuzan/api exec vitest run --config test/modules/submissions/vitest.config.ts`                                                                            | `PASS`：attempt 4，3 files、61 tests；含其他学生/跨班教师 403、同班教师正向、真实答案/录音与 RETURNED/revision/feedback fresh-read                                                        |
| feedback 授权与 RETURN 持久化并发      | `pnpm --filter @yuzan/api exec vitest run --config test/modules/feedback/vitest.config.ts`                                                                               | `PASS`：attempt 4，2 files、22 tests；含 STUDENT/跨班教师拒绝、RETURNED、revision 1→2 且 update 一次                                                                                      |
| OpenAPI 与生成契约                     | `pnpm --filter @yuzan/contracts test`                                                                                                                                    | `PASS`：attempt 4，OpenAPI valid；generator 6/6                                                                                                                                           |

Attempt 5 复核结果：

| 检查 | 结果 |
| --- | --- |
| 固定业务 ID、JS/Python 语法与 whitespace | `PASS`：固定 ID 零匹配；8 个变更 JS、Python 编译、`git diff --check` 全通过 |
| 教师入口浏览器导航 | `PASS`：4/4 checks；真实 unavailable、未知角色 fail closed、无证据禁用操作、`RETURN` 后 fresh GET 显示 `RETURNED`；`page_errors=0` |
| submission 聚焦测试 | `PASS`：3 files、61 tests |
| feedback 聚焦测试 | `PASS`：2 files、22 tests |
| OpenAPI 与生成契约 | `PASS`：OpenAPI valid；generator 6/6 |

浏览器运行证据位于 ignored runtime 目录：

- `runtime-local/task-evidence/P0-DYNAMIC-ID-ROUTING-CLEANUP/browser-routing.json`
- `runtime-local/task-evidence/P0-DYNAMIC-ID-ROUTING-CLEANUP/review-queue-unavailable-390.png`
- `runtime-local/task-evidence/P0-DYNAMIC-ID-ROUTING-CLEANUP/dynamic-submission-unavailable-390.png`

本轮 console 中有两条 401 resource error，分别来自队列和动态详情的失效会话负向请求；这是预期失败证据，不是成功链路错误。`page_errors=0`。

## 自审

- [x] 差异只服务任务结果且均在 `allowed_paths`
- [x] 无固定 ID、静态业务数据、假成功或 demo fallback
- [x] 相关失败/权限/offline/provider 状态真实
- [x] 最高风险有直接测试，未把 0 测试写成通过
- [x] 无密钥、真实学生数据或来源不明资产
- [x] `task-gate.ps1 -Mode review` 通过

## 风险、限制与回滚

- 已知风险：录音 URL 为短期签名 URL；reviewer 需要在真实运行时确认对象存储可用性和 URL 过期行为。
- 已知限制：本 builder 聚焦测试使用状态化 Prisma fake，没有冒充真实数据库 L4；独立 reviewer 仍需在同一 integration commit 上执行动态 API/DB/fresh-session 复验。
- 环境限制：API typecheck 前置的 Prisma generate 因 worktree 根缺少 `.env` 而未运行；未复制 canonical 密钥或伪造环境。聚焦 Vitest 实际执行并通过。Scoped ESLint 还被仓库缺少 `@eslint/js` 阻塞。
- 假设：现有 assignment submissions 返回 `{ items }` 或数组，且 `NEEDS_REVIEW` / `SUBMITTED` 是当前可进入教师证据详情的状态。
- 回滚步骤：`git revert <本任务实现提交>`；不得只恢复固定占位 ID 链接。若动态队列不可用，应保留明确 unavailable 状态。

## 集成说明

- 依赖与合并顺序：可独立合入；后续 `P0-TEACHER-STUDENT-ASSIGNMENT-CLOSURE-001` 应复用本任务动态入口。
- Integration Lead 需要复验：直接 API 证明 STUDENT/无班级教师 GET 与 POST 均被服务端拒绝；同班教师响应包含真实答案/录音；`RETURN` 后数据库为 `RETURNED`、revision 只增一次，并在新会话刷新返回相同 feedback。
- 推送分支/commit：提交和远端 SHA 在 finish gate 后回填。
