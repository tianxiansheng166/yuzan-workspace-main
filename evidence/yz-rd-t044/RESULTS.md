# YZ-RD-T044｜练习中心 UX 层级纠偏（开发检查点）

TASK_ID: YZ-RD-T044
STATUS: DEVELOPMENT_CHECKPOINT / NATIVE_API_PG_E2E_PENDING
BASE: accepted T038 `7c2c8daa338b22286bab05d3d99c19c6f01a1b4d`
BRANCH: `feat/yz-rd-t044-practice-catalog-ux-hierarchy`

## 审查与变更

- T038 已真实验收录音和正式复核闭环，但其代码 `practice-journey.js` 在目录分类 tabs 之前另行渲染三张大幅宣传性质卡片（口语/模拟/专项），与真实目录原本已有的 `MOCK` / `SPECIALIZED` 页签及录音筛选重复，可能下推原练习卡、增大用户认知成本。这个结论是源代码层次审查，不冒称已看过受 GitHub 单文件大小限制的原生 T038 2MB 全屏截图。
- 新版移除三张额外大卡、第二套 MOCK/SPECIALIZED 入口，保持原真实练习搜索、页签、老师布置的专项、能力方向、筛选条件及练习列表作为主体。
- 只为移动端被 CSS 隐藏的筛选面板提供一个紧凑的 `data-journey-oral` 录音筛选工具，作为 `.catalog-head-tools` 的一部分。点按仍清理旧搜索及 tabs，复用 T038 的 `requiresRecording=true` 精确服务端 facet 请求；按钮具 `aria-pressed` 和键盘焦点态，服务端无录音题目时由原目录显示真实空状态。
- 没有更改 T038 既有音频播放、MediaRecorder 试听、MinIO 上传、提交幂等、真实 Session/Attempt、PROCESSING、人工评分、报告来源、跨学籍隔离，未引入假官方考试或假 AI 语音成绩。
- 保留高原纸张米白/森林绿/衬线文字，避免用促销大卡冒充产品品质。

## 检查

- PASS: `node --test frontend/tests/assessment/*.test.mjs`，**92 PASS / 0 FAIL / 0 SKIP**。
- PASS: T038 更新后的导航语义回归（唯一录音条件按钮、原 MOCK/SPECIALIZED tabs、active aria 状态、真实接口筛选）。
- PASS: `node --check` 两个改动 JS 文件、`git diff --check`。
- **NOT_RUN**: T044 真实 Chromium+API+PG17+MinIO 回归 E2E、四视口重新截图和用户测试。T038 旧分支的原生1 PASS不能冒充 T044 新入口的真实验收。
- **BLOCKER TO SHARED MERGE**: inherited T033 full API lint 基线 1201 errors/1 warning，未修复/豁免。物理麦克风、语音自动评分校准、学校试点/生产仍 NOT_RUN。

## 安全

T038 已验收分支保持未改动；T037/T043 学生 Today、T039/T042 集成、T005 19 份原保护文件与178资源及 L4 事故均未触碰。无 Docker/Compose、没有共享分支合并。

## 接手验收

从当前独立 T044 最终推送 SHA 继续，至少 1 条非跳过原生浏览器→真实 API→PG/MinIO E2E，覆盖“目录→口语筛选→打开授权录音题→试听/上传/提交/处理”和四视口 UI/键盘。通过并经 Commander 回读前不能将本 UX 改动标为 ACCEPTED。
