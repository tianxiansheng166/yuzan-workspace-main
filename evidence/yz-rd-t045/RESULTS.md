# YZ-RD-T045｜390px 练习目录内容优先 UX｜开发检查点

**TASK_ID:** YZ-RD-T045
**STATUS:** DEVELOPMENT_CHECKPOINT / BROWSER_LAYOUT_MEASUREMENT_BLOCKED / NATIVE_E2E_NOT_RUN
**BASE:** T044 accepted-scoped `2de3b6636a3ef8febca42d973a7c8edd0e8e86bb`
**BRANCH:** `feat/yz-rd-t045-mobile-practice-first-card`

## 为什么做

T044 真实 Chrome 390px 截图的第一张练习卡在纵向 y≈1018（390×844 手机首屏以下）；真实练习内容被大量标题、目录工具、能力筛选和排序推到后面。此前已从目录删除三张宣传性功能卡，本轮不恢复它们。目标是在尊重教师任务与搜索的前提下，使普通已开放练习更快进入手机首屏。

## 改动

- 仅更改真实 `frontend/assessment/assets/practice.js` 与 `practice.css`。桌面保留原能力方向选择区；小屏换成原生 `<details><summary>按能力方向筛选</summary>...</details>`，选中后摘要显示真实筛选类别。能力按钮直接克隆原后端 facet UI，仍共享已存在的 `data-filter-key` 业务事件。
- 小屏统一压缩标题字号、搜索间距、tabs、工具、结果排序控件等垂直留白；保留辨识度和可读性，不缩小练习卡真实内容。MOCK/SPECIALIZED、`requiresRecording`、实时老师专项、合法提示与结果均未从页面删除。
- HTML 注入安全：使用 `summary.textContent` 设置后端类别，不拼接未转义属性或内容。键盘可操作的原生 disclosure 及可见 focus 边界。
- 本任务不更改 API Client、Runner、NestJS、Prisma、T038/T044 已验收工作区和学生 Today。

## 已完成验证

- **PASS**: 前端全套 `node --test frontend/tests/assessment/*.test.mjs` **94/94**，0 FAIL、0 SKIP；新增两个 T045 数据与无障碍相关回归。
- **PASS**: JS syntax `node --check`，Git diffcheck。
- **BLOCKED (NOT PASS)**: 首次 T045 Chrome **VISUAL_FIXTURE_ONLY** 启动在 Playwright `chromium.launch` 阶段超过 90 秒未返回，由 Commander 终止该任务自己的测试进程。宿主机此时 `load average 65.64`、约 50 个 Chrome/Chromium 进程；为保护其他研发线，未杀其他 PID、未强行重试。
- **NOT_RUN**: T045 新的 390/768/1280/1440 真实布局纵向坐标（本轮没有通过验证）；Chrome→真 NestJS API→PG17/MinIO 非跳过 E2E；真实录音上传交卷、正式人工复核新运行时验证。
- **QUALITY DEBT**: API full lint 1201 errors/1 warning 继承 T033/T042 已知基线，本次未复跑；全质量门禁仍失败，READY_TO_MERGE NO。

## 交付/后续

- `tests/e2e/assessment/t045_mobile_visual_fixture.py` 是明确标注的辅助视觉测试脚本。由于浏览器未启动，本轮**没有四视口截图，不能宣称首张卡已进入首屏**；必须在其他 E2E 运行减少后重跑并证明 390×844 真实首卡位置与键盘操作。
- 后续验收必须使用 T045 独立 Chrome153/NestJS/PG17/Redis/MinIO，至少1个 0-SKIP 真授权学生录音筛选→进入练习及四屏可视性 E2E，且留存独立进程释放证据。
- 原受保护 T005 Dirty worktree + 178源课程资源保持未触碰，历史 L4 OPEN，未使用 Docker/Compose、未合并共享分支。
