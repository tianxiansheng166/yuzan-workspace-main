# V3-V4 Delta Report

## 顶部摘要

| 维度 | V3 | V4 |
|---|---|---|
| 项目名 | `yuzan-pixel-v3` | `yuzan-pixel-interactive-v4` |
| 版本 | 1.0.0 | 4.0.0 |
| Framework | 无框架，原生 HTML/CSS/JS 静态原型 | 无框架，原生 HTML/CSS/JS 静态原型 |
| 工程化 | 无构建、无 npm 依赖、无 bundler | 无构建、无 npm 依赖、无 bundler |
| 启动方式 | `node server.mjs` / `start.cmd` / `start.sh`，监听 `127.0.0.1:4173` | 同 V3，仅 `console.log` 输出使用了模板字符串差异 |
| 运行方式 | 静态文件服务 + 固定画布缩放 (`fit.js`) | 同 V3，但 `fit.js` 新增 `--viewport-scale` CSS 变量与 MutationObserver |
| 路由数量 | 14 个（`ROUTES.md`） | 14 个（`ROUTES.md`） |
| 核心定位 | 像素还原、视觉验收、静态演示 | 高保真交互、真实录音、状态管理、本地缓存 |

### package.json 差异

- `name`: `yuzan-pixel-v3` → `yuzan-pixel-interactive-v4`
- `version`: `1.0.0` → `4.0.0`
- 其余字段完全一致：`private: true`、`type: module`、`scripts.start: "node server.mjs"`
- 无 `dependencies`、`devDependencies`、框架或测试脚本差异。

### 目录结构差异

V4 在 V3 基础上新增/拆分了以下关键文件：

| 文件/目录 | V3 | V4 |
|---|---|---|
| `assets/app-core.js` | 不存在 | 新增：全局状态、localStorage、URL 查询参数水合、后端 API 接入、声明式绑定 |
| `assets/recorder.js` | 不存在 | 新增：真实麦克风采集、MediaRecorder、IndexedDB 缓存、Canvas 声波 |
| `assets/audio-player.js` | 不存在 | 新增：IndexedDB 录音读取、播放/暂停/倍速/定位、Canvas 波形 |
| `assets/recorder.css` | 不存在 | 新增：录音器样式 |
| `assets/audio-player.css` | 不存在 | 新增：证据播放器样式 |
| `login/login.js` | 简单跳转 | 表单校验、localStorage 会话、离线提示、toast |
| `select-school/select.js` | 仅高亮 | 角色状态写入、路由切换、toast |
| `teacher/courses/spring/studio/studio.js` | 标签切换 + `alert` | 多标签编辑、内容可编辑、课程树选择、提交审核模拟、预览弹窗 |
| `teacher/assignments/app.js` | 弹窗开关 | 任务创建、表单校验、动态展开、筛选、关注事项交互 |
| `teacher/reviews/submission-1/app.js` | 播放切换 + `alert` | 学生列表、星级评分、草稿保存/发布、证据播放器定位 |
| `student/today/today.js` | 不存在 | 动态日期、范读播放、资源缓存切换、网络状态提示 |
| `student/learn/spring-2/player.js` | 不存在（内联暂停切换） | 录音器集成、完成/继续、同步状态 |
| `student/growth/growth.js` | 不存在（内联视角切换） | 视角切换、成长路径定位、学习计划、导出 JSON |
| `assessment/assessment.js` | 不存在 | 设备检查、状态读取、历史切换 |
| `assessment/reading/2/reading.js` | 不存在（内联暂停切换） | 录音器集成、完成/重录、同步流程 |
| `assessment/written/written.js` | 不存在（内联选项高亮） | 6 题渲染、答案持久化、自动保存、提交跳转 |
| `assessment/report/demo/report.js` | 不存在 | 后端/缓存/fallback 水合、指标动画、打印、教师反馈 |
| `assessment/history/history.js` | 不存在（内联弹窗） | 维度/范围切换、事件定位、复测安排、打印 |
| `BACKEND-STATE-CONTRACT.md` | 不存在 | 新增：后端状态接入契约文档 |

---

## 分类差异

### framework

- **V3**：无框架，无状态管理，无组件系统。每页独立 HTML + CSS + 少量内联或独立 JS。
- **V4**：仍无框架，但引入了集中式状态层 `assets/app-core.js`，提供 `YuzanDemo` 全局对象、localStorage 持久化、`window.__YUZAN_BOOTSTRAP__` 首屏水合、`?state.xxx=yyy` 查询参数注入、`data-bind-*` 声明式绑定。可视为向 Nuxt 迁移前的“轻量状态层”。

### package.json

- 仅名称与版本号不同，脚本、类型、私有标志一致。无依赖差异。

### routes

- 两版 `ROUTES.md` 列出完全相同的 14 条路由，但 V4 对每条路由的“主要交互”描述更具体，强调真实录音、声波、同步、水合、缓存等能力。

### pages

- **V3**：每页以视觉还原为主，交互多为占位（`alert`、class 切换、简单跳转）。
- **V4**：每页均有对应 JS 文件，状态与交互更完整。登录、学校选择、任务创建、评分、答题、录音、报告水合等均可闭环操作。

### components

- **V3**：无复用组件概念，按钮、播放器、录音面板多为静态图片或一次性 DOM。
- **V4**：提取出 `VoiceRecorder`（`[data-voice-recorder]`）和 `EvidencePlayer`（`[data-evidence-player]`）两个可复用 Web 组件式类，可在多个页面通过 `data-*` 属性声明使用。

### state

- **V3**：无全局状态，页面间跳转通过 `location.href` 硬跳转，无数据传递。
- **V4**：
  - `YuzanDemo.state` 全局状态树，含 `network`、`student`、`assessment`、`teacher`、`user`。
  - localStorage 键 `yuzan-demo-state-v4` 持久化。
  - 支持 `window.__YUZAN_BOOTSTRAP__` 后端首屏水合。
  - 支持 `?state.student.currentStep=3` 等查询参数模拟状态。
  - 声明式绑定 `data-bind-text`、`data-bind-value`、`data-visible-when`、`data-class-when`。

### assets

- **V3**：`common.css`、`fit.js` 及大量 PNG/JPG 装饰素材。
- **V4**：保留 V3 大部分素材，新增：
  - `app-core.js`、`recorder.js`、`audio-player.js`
  - `recorder.css`、`audio-player.css`
  - 多个 `brand-logo-*` 变体（`clean`、`header`、`mobile`、`small`、`mark-clean`）
- V4 移除了部分不透明白边 Logo，改用透明通道版本。

### images

- 两版装饰图片高度重合（山脉、河谷、封面、人物场景等）。
- V4 新增：`brand-logo-clean.png`、`brand-logo-header.png`、`brand-logo-mobile.png`、`brand-logo-small.png`、`brand-mark-clean.png`。
- V4 在部分页面用 `brand-logo-clean` 类替换原 Logo，减少白底块。

### CSS

- **V3**：每页独立 `style.css` + 全局 `common.css` + `home.css`。
- **V4**：继承 V3 样式文件，新增 `recorder.css`、`audio-player.css`，并对部分页面样式做了微调以容纳真实录音/播放器组件。

### JS

- **V3**：JS 总量少，多数页面仅内联脚本；`teacher/reviews`、`teacher/courses/studio`、`teacher/assignments` 有独立 JS，但功能简单。
- **V4**：
  - 每业务页均有独立 JS。
  - 新增 `app-core.js` 作为全局基础设施。
  - 新增 `recorder.js` / `audio-player.js` 作为可复用功能组件。
  - 使用 `async/await`、`CustomEvent`、`MediaRecorder`、`IndexedDB`、`Web Audio AnalyserNode` 等现代 API。

### recorder

- **V3**：录音面板为静态图片 (`player-recorder-desktop.jpg`、`reading-recorder.jpg`)，按钮仅切换 `paused` class，不调用麦克风。
- **V4**：
  - 真实调用 `navigator.mediaDevices.getUserMedia`。
  - 使用 `MediaRecorder` 编码（优先 Opus/WebM，降级处理）。
  - 使用 `AudioContext` + `AnalyserNode` 实时分析音量。
  - Canvas 实时绘制多层声波。
  - Blob 写入 IndexedDB `yuzan-voice-cache-v1/recordings`。
  - 元数据（时长、采样、同步状态）写入 localStorage。
  - 无权限时进入明确标注的“演示声场”模式，用 `Math.sin` + `Math.random` 生成模拟波形并生成一段静音 WAV 以维持状态。

### waveform

- **V3**：声波为静态图片或 CSS 动画占位。
- **V4**：录音器与播放器均使用 Canvas 逐帧绘制，支持输入电平、多层渐变波形、播放进度游标。

### player

- **V3**：教师复核页与学生/成长页使用静态图片或简单播放按钮切换。
- **V4**：
  - `EvidencePlayer` 支持 IndexedDB 录音读取、真实 `<audio>` 播放。
  - 支持进度拖动、倍速切换（0.75× / 1.0× / 1.25× / 1.5×）。
  - 无录音源时回退到 `simulate()`，用 `setInterval` + 固定采样数组模拟播放进度。

### form validation

- **V3**：登录表单无校验，直接跳转；学校选择无状态；任务创建弹窗仅关闭。
- **V4**：
  - 登录：账号/密码必填、最小长度校验、错误提示、离线提示。
  - 学校选择：角色与学校写入全局状态。
  - 任务创建：表单校验、截止日期、班级选择、动态插入新行。
  - 书面练习：6 题必须选择后才能下一题/提交。
  - 教师复核：发布前校验反馈文本非空。

### report normalizer

- **V3**：报告页指标、总结、建议全部硬编码在 HTML 中。
- **V4**：`report.js` 尝试从 `window.__YUZAN_REPORT__` → `localStorage('yuzan-demo-report')` → `fallback` 三层读取数据，统一归一化为 `metrics` 数组与 `summary`，并渲染教师反馈、复测日期、证据要点。

### offline

- **V3**：仅有“离线资源已准备”文案和静态网络图标。
- **V4**：
  - `app-core.js` 监听 `online` / `offline` 事件，设置 `document.documentElement.dataset.network`。
  - 全局 toast 提示网络状态切换。
  - 登录、录音、资源缓存、同步文案均根据 `navigator.onLine` 变化。
  - 学生今日页资源项可点击切换“缓存/移出”状态。

### sync

- **V3**：无同步逻辑，仅文案。
- **V4**：
  - 录音器 `scheduleSync()` 在联网后 900ms 将状态改为 `synced`（演示级同步）。
  - 学生播放器、测评朗读页监听 `recorder:sync` 事件更新同步文案。
  - 学校选择页、任务页显示“最近同步”文案但未真实同步。

### motion

- **V3**：基本无动画，少量 hover 与 class 切换。
- **V4**：
  - 录音器 Canvas 60fps 声波动画。
  - 报告页指标条延迟展开动画。
  - 历史页图表节点 `pop` 动画。
  - 全局按钮按下反馈 (`is-pressing`)。

### responsive

- **V3**：`student/today`、`student/learn/spring-2` 提供桌面/移动两套视图，通过 `innerWidth < 1000` 切换。
- **V4**：继承同策略，但移动/桌面Recorder均接入真实录音；`fit.js` 新增 `--viewport-scale` 与 MutationObserver，响应式缩放更完整。

### mock data

- **V3**：所有数据硬编码在 HTML 中（学生列表、分数、报告、历史图表、任务列表）。
- **V4**：
  - 仍保留大量硬编码数据（`written.js` 题目、`teacher/reviews/submission-1/app.js` 学生数组、`history.js` 图表数据集、`report.js` fallback）。
  - 但数据已与状态层绑定，可通过 `YuzanDemo.hydrate()`、`localStorage`、`window.__YUZAN_REPORT__` 替换。

### API calls

- **V3**：无任何 API 调用。
- **V4**：`app-core.js` 提供 `loadBackendState(endpoint)`，使用 `fetch` 拉取 JSON 并水合状态；默认未配置 endpoint 时不调用。无真实后端地址硬编码。

---

## 逐页差异详情（按 ROUTES.md 14 个路由）

### 1. 公共首页 `/`

| 字段 | 内容 |
|---|---|
| pageId | `home` |
| v3File | `index.html` |
| v4File | `index.html` |
| officialRoute | `/` |
| visualDiff | 基本一致；V4 引入 `assets/app-core.js`，HTML 结构几乎无变化。 |
| interactionDiff | V3 弹窗为静态提示；V4 弹窗按钮无额外逻辑，但全局导航通过 `app-core.js` 增强 `data-nav` 支持（禁用状态处理）。 |
| stateDiff | V4 新增 `YuzanDemo` 全局状态注入，首页可读取 bootstrap 状态。 |
| responsiveDiff | 一致，均为响应式 header + 固定画布缩放。 |
| assetDiff | V4 新增 `app-core.js` 引用；其余 CSS/JS 相同。 |

### 2. 登录 `/login`

| 字段 | 内容 |
|---|---|
| pageId | `login` |
| v3File | `login/index.html` |
| v4File | `login/index.html` |
| officialRoute | `/login` |
| visualDiff | V4 表单项增加 `placeholder`、`required`、`minlength`；新增 `form-error` 区域；网络文案改为动态 `data-network-label`。 |
| interactionDiff | V3 提交后直接 `location.href='/select-school'`；V4 校验账号密码、模拟验证延迟、写入 `yuzan-demo-session`、toast 提示、离线感知。 |
| stateDiff | V4 将 `account`、`loggedInAt`、`offline` 写入 localStorage；调用 `YuzanDemo.toast`。 |
| responsiveDiff | 一致，均为固定画布 1672×941。 |
| assetDiff | V4 引用 `assets/app-core.js`，Logo 增加 `brand-logo-clean` 类。 |

### 3. 学校选择 `/select-school`

| 字段 | 内容 |
|---|---|
| pageId | `select-school` |
| v3File | `select-school/index.html` |
| v4File | `select-school/index.html` |
| officialRoute | `/select-school` |
| visualDiff | 基本一致；V4 按钮 `data-nav` 改为 `id="continueSchool"`，Logo 增加 `brand-logo-clean`。 |
| interactionDiff | V3 仅高亮学校行；V4 写入 `user.role`、`user.school`，根据角色跳转到教师端或学生端，显示 toast。 |
| stateDiff | V4 使用 `YuzanDemo.set` 写入全局状态。 |
| responsiveDiff | 一致。 |
| assetDiff | V4 引用 `assets/app-core.js`。 |

### 4. 课程工作室 `/teacher/courses/spring/studio`

| 字段 | 内容 |
|---|---|
| pageId | `teacher-studio` |
| v3File | `teacher/courses/spring/studio/index.html` |
| v4File | `teacher/courses/spring/studio/index.html` |
| officialRoute | `/teacher/courses/spring/studio` |
| visualDiff | 结构相同；V4 增加 `contenteditable`、`role` 等可访问性属性，编辑器区域变为真实可编辑。 |
| interactionDiff | V3 标签仅切换 class，提交审核 `alert`；V4 多标签内容切换、课程树选择、活动增删、难度星级点击、模式开关、课程重命名 `prompt`、学生端预览弹窗、提交审核模拟（setTimeout 状态变更）。 |
| stateDiff | V4 未写入全局状态，但本地维护 `dirty` 与 `templates` 数组。 |
| responsiveDiff | 一致，固定画布 1536×1024。 |
| assetDiff | V4 引用 `assets/app-core.js`。 |

### 5. 教学任务 `/teacher/assignments`

| 字段 | 内容 |
|---|---|
| pageId | `teacher-assignments` |
| v3File | `teacher/assignments/index.html` |
| v4File | `teacher/assignments/index.html` |
| officialRoute | `/teacher/assignments` |
| visualDiff | V4 将右侧静态 `assign-attention.jpg` 替换为真实 DOM 构成的 `attention-card`（未完成/等待同步/待反馈）。筛选按钮增加 `filter` class 与 `data-filter`。 |
| interactionDiff | V3 弹窗仅开关，保存即关闭；V4 表单校验、动态创建任务行、行展开详情、筛选切换、关注事项高亮、行菜单提示。 |
| stateDiff | V4 创建的任务行仅存在于 DOM，未持久化；关注事项交互未写入状态。 |
| responsiveDiff | 一致，固定画布 1672×941。 |
| assetDiff | V4 移除了 `assets/assign-attention.jpg` 的使用（图片仍在目录），改为 CSS 绘制 `attention-mountain`。 |

### 6. 提交复核 `/teacher/reviews/submission-1`

| 字段 | 内容 |
|---|---|
| pageId | `teacher-review` |
| v3File | `teacher/reviews/submission-1/index.html` |
| v4File | `teacher/reviews/submission-1/index.html` |
| officialRoute | `/teacher/reviews/submission-1` |
| visualDiff | V3 音频证据区为静态图片 `review-player.jpg`；V4 替换为 `data-evidence-player` 组件。引入 `assets/audio-player.css`。 |
| interactionDiff | V3 播放按钮切换 class，发布 `alert`；V4 学生切换带未保存确认、星级评分（鼠标预览/点击确认）、反馈草稿保存到 localStorage、发布状态模拟、证据播放器词语定位、机器辅助提示展开。 |
| stateDiff | V4 写入 `teacher.selectedStudent`、`teacher.draftSavedAt`、`teacher.reviewsPending`。 |
| responsiveDiff | 一致，固定画布 1536×1024。 |
| assetDiff | V4 新增 `assets/audio-player.js`、`assets/audio-player.css`；移除 `review-player.jpg` 作为播放器主区域。 |

### 7. 今日学习 `/student/today`

| 字段 | 内容 |
|---|---|
| pageId | `student-today` |
| v3File | `student/today/index.html` |
| v4File | `student/today/index.html` |
| officialRoute | `/student/today` |
| visualDiff | 基本一致；V4 课程资源列表由静态 `<div>` 改为可点击 `<button class="resource-item">`，网络状态改为可点击按钮。 |
| interactionDiff | V3 无 JS；V4 动态日期、范读播放切换、资源缓存状态切换、网络状态提示、读取 `student.courseProgress` 设置 CSS 变量。 |
| stateDiff | V4 读取 `student.courseProgress`，但未写入持久化缓存状态。 |
| responsiveDiff | 一致，桌面/移动双视图，按 `innerWidth < 1000` 切换。 |
| assetDiff | V4 新增 `student/today/today.js`、`assets/app-core.js`。 |

### 8. 学习播放器 `/student/learn/spring-2`

| 字段 | 内容 |
|---|---|
| pageId | `student-player` |
| v3File | `student/learn/spring-2/index.html` |
| v4File | `student/learn/spring-2/index.html` |
| officialRoute | `/student/learn/spring-2` |
| visualDiff | V3 录音区为静态图片 `player-recorder-desktop.jpg` / `player-recorder-mobile.jpg`；V4 替换为 `data-voice-recorder` 组件，并新增实时声音图标。 |
| interactionDiff | V3 按钮仅切换 `paused` class；V4 真实录音/暂停/继续/完成，录音保存到 IndexedDB，同步状态更新，完成进入成长页。 |
| stateDiff | V4 写入 `student.completedSteps`、`student.currentStep`；监听 `recorder:sync`。 |
| responsiveDiff | 一致，桌面/移动双视图；V4 移动与桌面均接入真实录音。 |
| assetDiff | V4 新增 `assets/recorder.js`、`assets/recorder.css`、`student/learn/spring-2/player.js`；移除录音面板静态图片的使用。 |

### 9. 成长报告 `/student/growth`

| 字段 | 内容 |
|---|---|
| pageId | `student-growth` |
| v3File | `student/growth/index.html` |
| v4File | `student/growth/index.html` |
| officialRoute | `/student/growth` |
| visualDiff | 基本一致；V4 朗读作品片段由按钮+波形占位替换为 `data-evidence-player` 组件。 |
| interactionDiff | V3 视角按钮仅切换 class；V4 切换学生/教师文案、成长阶段定位、学习计划添加/移除、导出 JSON 报告。 |
| stateDiff | V4 读取 `student.completedSteps` / `student.currentStep`  implicitly；导出数据包含当前视图与文案。 |
| responsiveDiff | 一致，固定画布 1484×1060。 |
| assetDiff | V4 新增 `assets/audio-player.js`、`assets/audio-player.css`、`student/growth/growth.js`。 |

### 10. 测评入口 `/assessment`

| 字段 | 内容 |
|---|---|
| pageId | `assessment-entry` |
| v3File | `assessment/index.html` |
| v4File | `assessment/index.html` |
| officialRoute | `/assessment` |
| visualDiff | 基本一致；V4 设备检查区改为 `<button id="deviceCheck">`。 |
| interactionDiff | V3 设备检查为静态文案；V4 真实调用 `getUserMedia` 检查麦克风，根据状态更新文案。朗读/书面入口读取全局状态显示“继续”或“重新进行”。历史事件可点击切换。 |
| stateDiff | V4 读取 `assessment.readingStatus`、`assessment.writtenAnswers`、`assessment.currentQuestion`。 |
| responsiveDiff | 一致。 |
| assetDiff | V4 新增 `assessment/assessment.js`、`assets/app-core.js`。 |

### 11. 朗读测评 `/assessment/reading/2`

| 字段 | 内容 |
|---|---|
| pageId | `assessment-reading` |
| v3File | `assessment/reading/2/index.html` |
| v4File | `assessment/reading/2/index.html` |
| officialRoute | `/assessment/reading/2` |
| visualDiff | V3 录音面板为静态图片 `reading-recorder.jpg`；V4 替换为 `data-voice-recorder` 组件，右侧流程图由静态图片 `reading-process.jpg` 替换为真实 DOM `process-panel`。 |
| interactionDiff | V3 录音按钮切换 `paused` class；V4 真实录音、完成录音后进入书面练习、重录、同步状态反馈。 |
| stateDiff | V4 写入 `assessment.readingStatus`（`recorded_local` / `completed`）。 |
| responsiveDiff | 一致，固定画布 1672×941。 |
| assetDiff | V4 新增 `assets/recorder.js`、`assets/recorder.css`、`assessment/reading/2/reading.js`；移除 `reading-recorder.jpg` 与 `reading-process.jpg` 作为功能区域。 |

### 12. 书面练习 `/assessment/written`

| 字段 | 内容 |
|---|---|
| pageId | `assessment-written` |
| v3File | `assessment/written/index.html` |
| v4File | `assessment/written/index.html` |
| officialRoute | `/assessment/written` |
| visualDiff | V4 选项区域与题目目录改为 JS 动态渲染；进度指示器增加 `id`。 |
| interactionDiff | V3 仅单选高亮，保存即跳报告；V4 6 题切换、答案持久化到 localStorage、自动保存状态提示、必须作答才能提交、提交后跳报告。 |
| stateDiff | V4 写入 `assessment.writtenAnswers`、`assessment.currentQuestion`。 |
| responsiveDiff | 一致。 |
| assetDiff | V4 新增 `assessment/written/written.js`、`assets/app-core.js`。 |

### 13. 测评报告 `/assessment/report/demo`

| 字段 | 内容 |
|---|---|
| pageId | `assessment-report` |
| v3File | `assessment/report/demo/index.html` |
| v4File | `assessment/report/demo/index.html` |
| officialRoute | `/assessment/report/demo` |
| visualDiff | 基本一致；V4 语音证据图片 `report-evidence.jpg` 替换为 `data-evidence-player`；教师反馈区增加 `id="teacherFeedback"`。 |
| interactionDiff | V3 完全静态；V4 从后端/缓存/fallback 水合数据、指标条动画、建议卡片点击 toast、打印、教师反馈与复测日期渲染。 |
| stateDiff | V4 读取 `window.__YUZAN_REPORT__`、`localStorage('yuzan-demo-report')`、教师反馈 localStorage；未写入全局状态。 |
| responsiveDiff | 一致，固定画布 1484×1060。 |
| assetDiff | V4 新增 `assets/audio-player.js`、`assets/audio-player.css`、`assessment/report/demo/report.js`。 |

### 14. 历史复测对比 `/assessment/history`

| 字段 | 内容 |
|---|---|
| pageId | `assessment-history` |
| v3File | `assessment/history/index.html` |
| v4File | `assessment/history/index.html` |
| officialRoute | `/assessment/history` |
| visualDiff | 基本一致；V4 维度/范围按钮增加 `id`，复测安排弹窗增加日期与提醒方式表单。 |
| interactionDiff | V3 弹窗仅显示/隐藏；V4 维度切换、范围切换、事件定位、复测日期选择、提醒方式选择、localStorage 保存复测安排、打印。 |
| stateDiff | V4 写入 `localStorage('yuzan-retest-schedule')`。 |
| responsiveDiff | 一致，固定画布 1672×941。 |
| assetDiff | V4 新增 `assessment/history/history.js`、`assets/app-core.js`。 |

---

## 结论

V4 在视觉还原度与 V3 基本保持一致的前提下，将大量静态演示区域改造为真实可操作的 DOM/Canvas 组件，并引入了轻量全局状态层。推荐以 V4 为迁移基线，但需清理其演示级 fallback、模拟同步与硬编码数据，并接入真实后端 API。
