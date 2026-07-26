# P0-DYNAMIC-ID-ROUTING-CLEANUP Handoff

- Owner: `codex-dynamic-routing-verifier`（attempt 2 IMPLEMENT）
- Reviewer: independent verifier
- Branch: `task/p0-dynamic-id-routing-cleanup`
- Base commit: `41a0ff3656af7888d4c2e46eb180eeffc3414115`
- Status: `BLOCKED`（`authority_required: true`）

## 用户结果与方向

- 已完成的范围内结果：教师侧栏、教学任务、测评页和学生详情中的复核入口不再跳转固定业务 ID；详情页在未知/非教师角色或缺少答案/录音证据时 fail closed；录音按钮只驱动真实 audio；退回使用真实 `RETURN` 决策、要求具体反馈，并在成功后重新 GET 服务端状态。
- 推进黄金闭环的环节：解除 `TEACHER_DYNAMIC_REVIEW` 的前端固定 ID 与动态详情不可达阻塞。
- 明确未做：未越过 write set 修改后端；未宣称学生上下文的服务端越权已修复；未把 UI fixture 写成 L4/L5 成功；未签发 COMPLETE_CANDIDATE、VERIFIED 或集成结果。

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
- 主要文件：`frontend/server.mjs`、`frontend/shared/teacher-shell.js`、`frontend/teacher/reviews/**`、`frontend/teacher/assignments/**`、`frontend/teacher/submissions/detail/**` 及教师端其余旧复核入口。
- 复用的现有模型/契约/组件：现有 Assignment / Submission 接口、`YuzanApi.request`、现有提交详情与 feedback handler、统一 teacher shell。
- 共享事实或 CCR：无 OpenAPI、Prisma 或共享契约变化；无 CCR。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 固定业务 ID 源码证伪 | `rg -n --glob '!**/node_modules/**' --glob '!**/assets/**' "submission-1\|course-1\|assignment-1" frontend/server.mjs frontend/shared/teacher-shell.js frontend/teacher` | `PASS`：退出码 1，零匹配 |
| 语法与差异检查 | 对本任务 JS 逐个 `node --check`；`python -m py_compile frontend/teacher/reviews/verify-routing.py`；`git diff --check` | `PASS` |
| attempt 1 真实浏览器负向导航 | `with_server.py --server "node frontend/server.mjs" --port 4176 -- python frontend/teacher/reviews/verify-routing.py` | `PASS`：这是被正式 L5 拒绝前的历史局部证据，不再用于声称动态详情服务端权限通过 |
| attempt 2 证据门控与 Return UI 回归 | `PORT=4176 API_BASE_URL=http://127.0.0.1:4000 node frontend/server.mjs` + `python frontend/teacher/reviews/verify-routing.py` | `PASS`：未知角色不发 submission GET；无证据时四个控件全禁用；有书面证据时发送 `RETURN` 与具体反馈，重新 GET 后显示 `RETURNED`。聚焦 route fixture 只证明前端契约，不证明服务器授权/持久化 |
| attempt 2 静态检查 | `node --check frontend/teacher/submissions/detail/app.js`; `python -m py_compile frontend/teacher/reviews/verify-routing.py`; `git diff --check` | `PASS` |

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
- [ ] `task-gate.ps1 -Mode review`：完整 outcome 被服务端 write-set fence 阻塞，不能进入 READY_FOR_REVIEW

## 风险、限制与回滚

- 已知风险：服务端 `getSubmission()` 没有角色/owner/class scope 检查；正式拒绝运行 `dynroute-20260726T143913Z-1e34f7e` 已观测同校 STUDENT 对教师复核 submission 得到 HTTP 200。客户端角色门控不是安全边界。
- 已知限制：`SubmissionResponse` 不含书面答案或录音；当前真实响应会诚实禁用复核，但无法实现 evidence-backed review。feedback service 保存 `RETURNED` 且不递增 submission revision，与正式要求中的 `REDO_REQUIRED`/revision persistence 尚未对齐。
- Authority request：请把 `backend/api/src/modules/submissions/**` 与 `backend/api/src/modules/feedback/**`（含聚焦测试）加入 write set，并由契约 owner 明确 `REDO_REQUIRED` 是否映射现有 `RETURNED`；若需新增公开状态，再授权对应 OpenAPI/contracts 路径和 CCR。
- 假设：现有 assignment submissions 返回 `{ items }` 或数组，且 `NEEDS_REVIEW` / `SUBMITTED` 是当前可进入教师证据详情的状态。
- 回滚步骤：`git revert <本任务实现提交>`；不得只恢复固定占位 ID 链接。若动态队列不可用，应保留明确 unavailable 状态。

## 集成说明

- 依赖与合并顺序：可独立合入；后续 `P0-TEACHER-STUDENT-ASSIGNMENT-CLOSURE-001` 应复用本任务动态入口。
- Integration Lead 需要复验：待 authority expansion 完成后，直接 API 证明 STUDENT/无班级教师 GET 与 POST 均被服务端拒绝；教师响应包含真实答案/录音；`RETURN` 后服务端目标状态与 revision 按已确认契约保持，并在新会话刷新一致。
- 推送分支/commit：本轮为 BLOCKED，不签发 COMPLETE_CANDIDATE。
