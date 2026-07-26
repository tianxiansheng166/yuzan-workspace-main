# P0-DYNAMIC-ID-ROUTING-CLEANUP Handoff

- Owner: `codex-routing-builder`
- Reviewer: independent verifier
- Branch: `task/p0-dynamic-id-routing-cleanup`
- Base commit: `41a0ff3656af7888d4c2e46eb180eeffc3414115`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：教师侧栏、教学任务、测评页和学生详情中的复核入口不再跳转固定业务 ID；全局入口进入真实复核队列，教学任务的“查看提交”先读取该任务的服务端 submissions，再用返回的动态 submission ID 打开真实详情。
- 推进黄金闭环的环节：解除 `TEACHER_DYNAMIC_REVIEW` 的前端固定 ID 与动态详情不可达阻塞。
- 明确未做：未新增后端接口或数据模型；未用 fixture/静态提交证明成功；未宣称真实教师账号下的 L4 持久化或 L5 越权验收已经完成。

## 实现与修改范围

- 实现摘要：
  - 新增 `/teacher/reviews/` 真实队列页，依次读取当前学校的 assignments 和 assignment submissions，只渲染 API 返回且处于 `NEEDS_REVIEW` / `SUBMITTED` 的动态提交。
  - API 未认证、不可用、部分任务失败和空队列都有明确状态；不回退到演示数据。
  - `/teacher/submissions/{submissionId}` 由 server 映射到现有详情页；修正详情页绝对资源路径并补齐 API client，使 pathname 中的动态 ID 真正进入详情请求。
  - 详情无数据时禁用“批改 / 通过 / 退回”，避免空证据仍可操作。
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
| 真实浏览器负向导航 | `with_server.py --server "node frontend/server.mjs" --port 4176 -- python frontend/teacher/reviews/verify-routing.py` | `PASS`：390x844，无 route interception/mock；匿名重定向登录，失效会话真实请求返回 401 并显示 unavailable；动态 UUID 进入 submission API；无横向溢出、无 page errors |

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
- [x] `task-gate.ps1 -Mode review -TaskFile project-ops/tasks/active/P0-DYNAMIC-ID-ROUTING-CLEANUP.json` 通过

## 风险、限制与回滚

- 已知风险：队列当前会对最多 100 个 assignment 分别请求 submissions；后续数据量增长时应由后端提供租户范围的分页复核队列接口。
- 已知限制：Builder 只证明动态导航、真实请求和失败态；真实教师登录后的成功队列、详情证据、feedback 持久化与跨角色回显必须由独立 verifier 在集成 runtime 完成。
- 假设：现有 assignment submissions 返回 `{ items }` 或数组，且 `NEEDS_REVIEW` / `SUBMITTED` 是当前可进入教师证据详情的状态。
- 回滚步骤：`git revert <本任务实现提交>`；不得只恢复固定占位 ID 链接。若动态队列不可用，应保留明确 unavailable 状态。

## 集成说明

- 依赖与合并顺序：可独立合入；后续 `P0-TEACHER-STUDENT-ASSIGNMENT-CLOSURE-001` 应复用本任务动态入口。
- Integration Lead 需要复验：真实教师新会话下队列展示服务端动态 submission ID；点击进入同 ID 详情；无提交为空；跨学校/无班级权限请求失败；反馈刷新保持。
- 推送分支/commit：提交后回填。
