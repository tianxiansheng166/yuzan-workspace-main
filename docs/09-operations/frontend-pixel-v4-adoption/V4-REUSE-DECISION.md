# V4 Reuse Decision

## 决策原则

- V4 在视觉还原度上与 V3 基本一致，但交互、状态、录音、播放、表单校验等能力显著增强。
- 全局基础设施（`app-core.js`、`recorder.js`、`audio-player.js`、`fit.js` v4）应优先复用。
- 演示级 fallback、硬编码数据、`setTimeout` 模拟成功、`alert`/`prompt`、本地模拟同步等必须在生产迁移时替换或移除。
- V3 仅作为视觉验收参考，不推荐直接回退到 V3 的静态实现。

---

## 按页面 preferred source 决策

| pageId | preferredSource | 决策理由 |
|---|---|---|
| `home` | REPLACE_WITH_V4 | V4 与 V3 视觉一致，但全局导航与状态注入更完整。 |
| `login` | REPLACE_WITH_V4 | V4 有真实表单校验与 localStorage 会话，V3 仅为跳转。需替换 setTimeout 模拟登录为真实鉴权。 |
| `select-school` | REPLACE_WITH_V4 | V4 写入角色/学校状态并按角色路由，V3 仅高亮。 |
| `teacher-studio` | MERGE_V3_VISUAL_V4_BEHAVIOR | V4 交互骨架完整，但 `prompt` 和内容可编辑不适合生产；保留 V4 行为并用真实表单替换，V3 视觉作参考。 |
| `teacher-assignments` | REPLACE_WITH_V4 | V4 表单、筛选、动态行展开均优于 V3，但新建任务需接入后端持久化。 |
| `teacher-review` | REPLACE_WITH_V4 | V4 的学生切换、评分、草稿、发布、证据播放器均优于 V3 的 alert 占位。 |
| `student-today` | REPLACE_WITH_V4 | V4 有动态日期、范读、缓存切换、网络状态，V3 完全静态。 |
| `student-player` | REPLACE_WITH_V4 | V4 真实录音与状态更新，V3 仅图片切换。 |
| `student-growth` | REPLACE_WITH_V4 | V4 有视角切换、成长路径定位、学习计划、导出，V3 仅切换 class。 |
| `assessment-entry` | REPLACE_WITH_V4 | V4 真实设备检查与状态读取，V3 静态文案。 |
| `assessment-reading` | REPLACE_WITH_V4 | V4 真实录音与同步流程，V3 仅图片切换。 |
| `assessment-written` | REPLACE_WITH_V4 | V4 6 题切换、持久化、自动保存、提交校验，V3 仅单选高亮。 |
| `assessment-report` | REPLACE_WITH_V4 | V4 有水合架构、指标动画、打印、证据播放，V3 完全静态。 |
| `assessment-history` | REPLACE_WITH_V4 | V4 维度/范围切换、事件定位、复测安排，V3 仅弹窗开关。 |

### preferredSource 统计

- `REPLACE_WITH_V4`: 13 页
- `MERGE_V3_VISUAL_V4_BEHAVIOR`: 1 页（`teacher-studio`）
- `KEEP_V3`: 0 页
- `VISUAL_REFERENCE_ONLY`: 0 页
- `REJECT`: 0 页
- `MISSING`: 0 页

---

## 全局可复用资产清单

### JS 组件/基础设施（必须复用）

| 文件 | 复用范围 | 说明 |
|---|---|---|
| `assets/app-core.js` | 所有页面 | 全局状态 `YuzanDemo`、localStorage、URL 查询参数水合、后端 API 接入、声明式绑定、toast、网络状态、按钮按下反馈。 |
| `assets/recorder.js` | `student/learn/spring-2`、`assessment/reading/2` | `VoiceRecorder` 类，通过 `[data-voice-recorder]` 声明式使用。 |
| `assets/audio-player.js` | `teacher/reviews/submission-1`、`student/growth`、`assessment/report/demo` | `EvidencePlayer` 类，通过 `[data-evidence-player]` 声明式使用。 |
| `assets/fit.js` | 所有固定画布页面 | 固定画布缩放，V4 版新增 `--viewport-scale` 与 MutationObserver。 |

### CSS（必须复用）

| 文件 | 复用范围 | 说明 |
|---|---|---|
| `assets/common.css` | 所有页面 | 全局样式、变量、按钮、表单基础。 |
| `assets/recorder.css` | 含录音器的页面 | 录音器样式。 |
| `assets/audio-player.css` | 含证据播放器的页面 | 证据播放器样式。 |
| 各页面 `style.css` | 对应页面 | 页面级视觉样式，V4 与 V3 基本一致或更优。 |

### 图片/装饰素材（可复用）

| 素材 | 用途 | 备注 |
|---|---|---|
| `assets/brand-logo*.png` | Logo | V4 新增透明通道版本，推荐用 `brand-logo-clean` 等替代原白底版本。 |
| `assets/login-art-clean.jpg` | 登录页左侧艺术图 | 无差异。 |
| `assets/select-art-clean.jpg`、`select-art-exact.jpg`、`select-bottom.jpg` | 学校选择页 | 无差异。 |
| `assets/teacher-logo-*.png` | 教师端侧边栏 Logo | 无差异。 |
| `assets/studio-sidebar-art.jpg`、`studio-footer.jpg` | 课程工作室装饰 | 无差异。 |
| `assets/assign-sidebar-art.jpg` | 教学任务侧边栏 | 无差异。 |
| `assets/review-bottom.jpg`、`review-logo.png` | 提交复核页 | 无差异。 |
| `assets/today-cover.jpg`、`today-desktop-path.jpg`、`today-feedback.jpg`、`today-mobile-*.jpg` | 今日学习页 | 无差异。 |
| `assets/player-left-art.jpg`、`player-mountains-desktop.png`、`player-mobile-valley.jpg` | 学习播放器装饰 | V4 仍用作背景，录音器替换为组件。 |
| `assets/growth-hero.jpg`、`growth-comment-mountain.png` | 成长报告页 | 无差异。 |
| `assets/assessment-entry-hero.jpg`、`assessment-entry-left.jpg`、`assessment-entry-right.jpg` | 测评入口 | 无差异。 |
| `assets/reading-mountains.png` | 朗读测评装饰 | 无差异。 |
| `assets/written-mountains.png`、`written-side-valley.jpg` | 书面练习装饰 | 无差异。 |
| `assets/report-hero.jpg`、`report-evidence.jpg` | 测评报告装饰 | V4 中 `report-evidence.jpg` 不再作为播放器主区域，但仍可复用为缩略/备份。 |
| `assets/history-hero.jpg` | 历史复测页 | 无差异。 |
| `assets/cover-*.png` | 首页课程封面 | 无差异。 |
| `assets/home-bg.png`、`hero-scene-clean.jpg`、`ridge-layer.png`、`sound-layer.png`、`contour-texture.png` | 首页/全局纹理 | 无差异。 |

---

## 全局需要替换或拒绝的内容

### 1. 演示级登录与鉴权

- **位置**: `login/login.js` 第 14-23 行
- **问题**: 表单提交后 `setTimeout` 650ms 直接写入 `yuzan-demo-session` 并跳转，无真实鉴权。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。保留表单校验与 localStorage 会话写入，但将验证逻辑替换为真实登录 API，成功后写入 token/refreshToken。

### 2. 模拟录音同步

- **位置**: `assets/recorder.js` 第 327-336 行 `scheduleSync()`
- **问题**: 联网后 900ms `setTimeout` 直接改为 `synced`，无真实上传。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。保留本地状态流转（local → syncing → synced），但 `synced` 必须由后端上传成功回调触发。

### 3. 演示声场 fallback

- **位置**: `assets/recorder.js` 第 360 行 `currentLevel()`、第 367-368 行 `draw()`、第 173-179 行 `start()` catch 分支
- **问题**: 无麦克风权限时用 `Math.sin` + `Math.random` 生成模拟波形，并生成静音 WAV。
- **决策**: **VISUAL_DEMO_ONLY**。保留降级提示与可视化反馈，但必须在 UI 明确标注“演示模式”，且不应将静音 WAV 当作真实录音提交。

### 4. 无录音源时的播放器模拟

- **位置**: `assets/audio-player.js` 第 10-11 行 `toggle()` / `simulate()`
- **问题**: 无真实录音源时用 `setInterval` 模拟播放进度。
- **决策**: **VISUAL_DEMO_ONLY**。仅在演示/预览场景允许，真实证据页必须绑定 IndexedDB Blob 或后端 URL。

### 5. 硬编码报告 fallback

- **位置**: `assessment/report/demo/report.js` 第 3 行 `fallback`、第 6-14 行归一化逻辑
- **问题**: 固定指标 `[74,72,45,74]`、固定总结、固定建议。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。保留水合架构，但 fallback 应显示“报告加载失败”而非伪造数据。

### 6. 硬编码书面练习题与答案

- **位置**: `assessment/written/written.js` 第 2-9 行 `questions` 数组，第 13 行 `stored[2]=0`
- **问题**: 6 道题及默认答案硬编码，且强制第 3 题选 A。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。题目与答案应从后端题库获取；移除默认答案种子。

### 7. 硬编码学生列表与评分

- **位置**: `teacher/reviews/submission-1/app.js` 第 2-11 行 `students` 数组
- **问题**: 8 名学生姓名、时长、分数全部硬编码。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。学生列表、音频证据、机器辅助提示应从后端获取。

### 8. 硬编码历史图表数据

- **位置**: `assessment/history/history.js` 第 2-7 行 `datasets`
- **问题**: 4 个维度、4 个时间点得分全部硬编码。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。历史数据由后端 API 提供。

### 9. 模拟课程提交审核

- **位置**: `teacher/courses/spring/studio/studio.js` 第 40-42 行
- **问题**: `setTimeout` 800ms 后文本变为“已提交审核”。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。调用真实课程提交 API，成功后更新状态。

### 10. 模拟任务创建

- **位置**: `teacher/assignments/app.js` 第 12-20 行
- **问题**: 表单提交后仅在前端插入 DOM 行，无后端持久化。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。调用真实任务创建 API，成功后刷新列表。

### 11. 模拟发布反馈

- **位置**: `teacher/reviews/submission-1/app.js` 第 65-74 行
- **问题**: `setTimeout` 750ms 后文本变为“已发布”。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。调用真实反馈发布 API。

### 12. 模拟复测安排

- **位置**: `assessment/history/history.js` 第 29-36 行
- **问题**: 选择日期后仅写入 `localStorage`，无后端预约。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。调用真实复测安排 API。

### 13. `alert` / `prompt` 交互

- **位置**:
  - V3 `teacher/courses/spring/studio/studio.js` 第 1 行 `alert('课程已提交审核')`
  - V3 `teacher/reviews/submission-1/app.js` 第 1 行 `alert('反馈已发布')`
  - V4 `teacher/courses/spring/studio/studio.js` 第 25 行 `prompt('课程名称',...)`
  - V4 `teacher/reviews/submission-1/app.js` 第 40 行 `confirm('当前反馈尚未保存...')`
- **决策**: **REMOVE**。生产环境应使用自定义弹窗组件，避免浏览器原生 `alert`/`prompt`/`confirm`。

### 14. 全局硬编码默认状态

- **位置**: `assets/app-core.js` 第 4-10 行 `defaults`
- **问题**: `user.role`、`school`、`courseProgress`、`completedSteps`、`currentStep`、`readingStatus`、`currentQuestion`、`reviewsPending` 等默认值硬编码。
- **决策**: **REPLACE_WITH_STATE_BOUNDARY**。默认值应从后端 bootstrap 或空状态填充，避免演示数据混入生产。

### 15. V3 中的静态录音/播放器图片

- **位置**:
  - `assets/player-recorder-desktop.jpg`
  - `assets/player-recorder-mobile.jpg`
  - `assets/reading-recorder.jpg`
  - `assets/review-player.jpg`
  - `assets/report-evidence.jpg`（作为播放器区域）
- **决策**: **REJECT** 作为功能组件使用。可保留为历史参考或降级缩略图，但真实功能必须由 `recorder.js` / `audio-player.js` 实现。

---

## 迁移风险汇总

| 风险项 | 等级 | 说明 | 缓解措施 |
|---|---|---|---|
| 真实麦克风权限与兼容性 | 高 | V4 真实调用 getUserMedia/MediaRecorder，不同浏览器支持度不同；HTTP/iframe 环境可能失败。 | 提供明确降级提示；HTTPS 部署；测试主流浏览器；保留演示声场降级。 |
| IndexedDB 缓存与存储限制 | 中 | 录音 Blob 写入 IndexedDB，存储容量与清理策略需管理。 | 定义最大保留时长；提供手动清理；迁移到后端对象存储后减少本地依赖。 |
| 演示数据 fallback 被误用 | 高 | report.js / written.js / history.js 等包含硬编码数据，未接入后端时会被当作真实结果。 | 生产环境强制关闭 fallback，或 fallback 显示“加载失败”；所有数据走 API。 |
| 模拟同步被误认为真实上传 | 中 | recorder.js scheduleSync 用 setTimeout 模拟同步成功。 | 替换为真实上传回调；在未上传成功前保持 syncing 或 local 状态。 |
| 全局状态 `YuzanDemo` 与 Nuxt 集成 | 中 | V4 使用 window 全局对象与 localStorage，与 Nuxt/Pinia 集成需适配。 | 将状态读写抽象为 composable/store；逐步替换 `window.YuzanDemo` 调用。 |
| 内容可编辑与 prompt 不适合生产 | 中 | studio.js 使用 contenteditable 与 prompt。 | 替换为受控表单/富文本编辑器与自定义弹窗。 |
| 音频格式兼容性 | 中 | MediaRecorder 优先 Opus/WebM，部分环境可能不兼容。 | 服务端转码；客户端提供格式检测与降级。 |
| ASR / AI 评分未实现 | 高 | V4  README/IMPLEMENTATION-NOTES 明确声明 ASR、AI 评分、对象存储、RBAC 等未真实实现。 | 接入现有后端 ASR/评分服务；禁止前端伪造分数。 |
| 固定画布 `fit.js` 不适合最终响应式 | 低 | NUXT-INTEGRATION.md 已指出 fit.js 适合验收，生产应转 Grid/Flex。 | 在 Nuxt 重构时逐步替换为响应式布局。 |

---

## 迁移顺序建议

1. **基础设施先行**: 将 `app-core.js`、`recorder.js`、`audio-player.js`、`fit.js` 迁移到 Nuxt composable / plugin。
2. **低风险页面**: `home`、`login`、`select-school`、`student-today`、`assessment-entry`、`assessment-written`、`assessment-history`。
3. **中风险页面**: `teacher-assignments`、`teacher-studio`、`student-growth`。
4. **高风险页面**: `student-player`、`assessment-reading`、`teacher-review`、`assessment-report`（需后端 ASR/评分/音频存储支持）。
