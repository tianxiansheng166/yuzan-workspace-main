# YZ-RD-T043｜Today 首页视觉与信息层级纠偏（首次开发检查点）

**TASK_ID:** YZ-RD-T043
**STATUS:** DEVELOPMENT_CHECKPOINT / USER_EXPERIENCE_REVIEW_PENDING / NATIVE_API_PG_E2E_NOT_RUN
**BASE:** accepted T037 `6d3aa67c114bd310c2d793caa7bcd5be9166ec3f`
**BRANCH:** `feat/yz-rd-t043-personalized-today-ux-restoration`

## 审图发现（旧版真实 T037 Chrome 截图）

- 原版 [1440](../yz-rd-t037/screenshots/today-showcase-1440.png) 与 [390](../yz-rd-t037/screenshots/today-showcase-390.png) 的学生首页：在 Today 的 `.today-header` 后插入四张并列等权重卡，手机上两行卡片占据大量首屏空间；原本更重要的老师任务、首次测评和个性化进度因此被下推。
- 此设计错误地把面向投资者、评委解释产品特色的“听说练测四步”当作学生每天必须浏览的四个导航按钮。**功能 E2E PASS 并不证明 UI 美观、用户认知负担低。**

## 当前修改

- 移除占主视觉的四张等权重入口（并非移除四项真实功能）；`today.primaryAction`、正式反馈、真实学习进度、教师任务、练习安排、课程继续、报告及历史等原有首页模块全部保留。
- 不改首页业务数据与 API，只在 `.today-overview` **之后**根据**已授权后端课程/录音练习**产生最多**一条**不与主任务重复的可选补充建议；没有可信的额外内容时不展示。明确是“已开放”而非假“AI 自动推荐”。
- CSS 使用原本米白与森林绿、高原纸张风格，低对比柔和消息条、次级边框按钮；不再在主任务前面抢占位置。移动长姓名首屏两行截断仅视觉层面，DOM保留完整名称。
- 业务安全规则不变：录音练习只有 `requiresRecording===true` 才显示直达，全部动态练习定义及课程 Assignment ID 来自授权 API。正式报告仍由既有 Today/Growth 合同控制，0 和 null 不混淆。

## 验证矩阵

- **PASS:** Node 全前端 `node --test frontend/tests/assessment/*.test.mjs`：119 PASS / 0 FAIL / 0 SKIP。
- **PASS:** T037 导览回归测试已同步更新为“主任务第一、只有一项授权补充内容、原任务不重复、错误/空数据不乱推荐、HTML安全”。既有学生身份/404/断网、合法0分等前端回归仍通过。
- **PASS:** JS syntax 和 `git diff --check`。
- **PASS（仅视觉夹具）:** 原生 Chrome 的 **VISUAL_FIXTURE_ONLY** 校验四档 390/768/1280/1440：均为 0 横向溢出、`primaryTop < optionalTop`、恰好一条补充内容（录音练习授权）、零个四宫格卡。详见 [proof](visual-fixture-proof.json) 和四档 `visual-fixture-*.png`。
- **NOT_RUN:** T043 正式的 Chromium+真实 NestJS API+PG17+MinIO 原生非跳过 E2E，真实学生账号、实际物理麦克风、学校试点、自动语音评分及生产部署。**本轮视觉夹具不构成后端业务验收**。
- **KNOWN_DEBT:** inherited T033 API full lint 1201 errors + 1 warning 的既有质量债务，未由本 UI 分支修复/豁免；不得共享合并或声明生产就绪。

## 安全与接续

- 没有更改 T037 已提交的原始浏览器验收截图或原验收记载。当前是在 T037 被接受的 SHA 之上以独立分支提供用户体验修正。
- T005 原脏树19源码/178课程资源、T038已验收独立分支、T039/T042独立集成、L4数据库事故均未触碰。No Docker/Compose，未停止其他线服务。
- 下一轮：在 T043 **独立原生真实环境**继续跑至少一条 Today→真实主任务或已开放口语练习/课程的 0 SKIP Chrome/API/PG E2E，确认真正截图与视觉夹具一致；再做审美/交互验收。T043 暂不 ACCEPTED、不入共享分支。
