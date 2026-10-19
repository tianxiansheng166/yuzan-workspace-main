# YZ-RD-T042｜学生听说测评特色首页 + 教师名单 + 学习历史｜独立滚动集成

**STATUS: DEVELOPMENT_CHECKPOINT / NATIVE_INTEGRATION_E2E_NOT_RUN**

## Git 真实性

- BASE: T039 independent integration `7cf4e1b33f02c14c0849743ac21afbc8f01bafa3`。
- 追加经 Commander 范围验收的 T037 `6d3aa67c114bd310c2d793caa7bcd5be9166ec3f`。
- 真正 `git merge --no-ff` 双父提交 `c409335c62aebcc9a5ad7b9e41c7ae9696b3d46f`，保留完整祖先图，不做 cherry-pick 或 squash。
- 唯一冲突是 `CURRENT_HANDOFF.md` 顶部任务回执，保留 T039 与 T037 双方完整记录，未冲突任何业务源文件。
- T039 既有 No-FF 集成 T034（`61101b7`）+ T036（`92bd3bd`），本次源为真实学生 Today 特色视图四步入口。

## 本轮验证

- Node 全前端测试：`node --test frontend/tests/assessment/*.test.mjs`，**129 PASS / 0 FAIL / 0 SKIP**，是 T042 合并后新跑，不是重复引用 T037/T039 日志。
- JavaScript syntax：`frontend/student/today/today-showcase.js`、`today.js`、`frontend/assessment/assets/app.js`、`frontend/teacher/classes/detail/app.js` 均 PASS。
- Git diff --check PASS。合并涉及的业务改动范围为学生 Today 入口，教师名单和学生学习历史由 T039 继承。

## 下一道验收门禁（未运行）

- T042 **同一独立原生 Chromium 153/NestJS API/PostgreSQL17/Redis/MinIO 环境**的学生 Login→Today听说测评入口→真实作答/报告/历史、教师真实 35+ 班级学生筛选→详情→CSV 全班，再验证跨校跨学生权限及 4 视口。
- 新环境 E2E 和截图：**NOT_RUN**；源分支 T033/T034/T036/T037 的独立 E2E 不能当成 T042 集成证据。
- 新环境 API 全量/Contracts/TypeScript 运行：NOT_RUN；继承的 API full lint 1201 errors + 1 warning **仍为已记录阻塞，T042 没有豁免**，READY_TO_MERGE = **NO**。
- T038 当前正在其工作树开发原生 E2E，未完成验收；T040/041 任务待 Owner 手动派发，不纳入本次集成。
- 物理麦克风、校准语音评分、学校试点、生产上线 NOT_RUN；浏览器已有录音来源可能为 `SIMULATED_MIC`。

## 安全边界

- 原始 T005 脏工作树 19 源码与 178 课程资源保持只读、L4 OPEN 未触碰、No Docker/Compose/P1SIM。
- 不合共享分支；T042 独立代码/工作树 / 服务资源隔离；后续仅在本分支提交真实验收记录。
