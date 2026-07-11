# V4 源运行时假功能扫描报告

## 说明

本报告列出 `yuzan-next/source-materials/yuzan-pixel-v4-runtime`（并对比 V3）中所有**演示级、模拟级、硬编码、setTimeout 直接成功、console-only** 的实现。这些实现仅用于静态视觉与交互验收，**不得直接进入正式生产页面**。

标签定义：

- `REPLACE_WITH_STATE_BOUNDARY`：保留 UI 状态与交互骨架，但必须替换为真实后端/设备边界。
- `VISUAL_DEMO_ONLY`：仅在纯演示/无设备场景允许，生产环境必须明确标注“演示模式”或接入真实能力。
- `REMOVE`：生产环境必须移除，改用自定义组件或真实流程。

扫描范围：V4 所有 `*.js`、`*.html`、README.md、IMPLEMENTATION-NOTES.md；V3 所有 `*.js`、`*.html`、README.md 作为对比基线。

---

## V4 假功能清单

| # | 位置 | 问题 | 标签 | 证据（行号） | 风险 |
|---|---|---|---|---|---|
| 1 | `login/login.js` | 表单提交后 `setTimeout` 650ms 直接写入 `yuzan-demo-session` 并跳转，无真实鉴权。 | `REPLACE_WITH_STATE_BOUNDARY` | L14–L23 | 高。登录入口伪造鉴权，会导致未授权访问。 |
| 2 | `assets/recorder.js` | `scheduleSync()` 在联网后 900ms `setTimeout` 直接标记 `synced`，无真实上传。 | `REPLACE_WITH_STATE_BOUNDARY` | L327–L336 | 高。用户会误以为录音已安全同步到服务端。 |
| 3 | `assets/recorder.js` | 无麦克风权限或 HTTP/非 localhost 环境时，用 `Math.sin` + `Math.random` 生成模拟波形，并生成静音 WAV。 | `VISUAL_DEMO_ONLY` | L157–L179、L360、L367–L368、L415–L423 | 中。降级体验可保留，但必须明确标注“演示模式”，且不得提交静音文件。 |
| 4 | `assets/audio-player.js` | 无真实录音源时，`toggle()` 用 `setInterval` 模拟播放进度。 | `VISUAL_DEMO_ONLY` | L10–L11 | 中。证据播放器必须绑定真实 Blob 或后端 URL。 |
| 5 | `assessment/report/demo/report.js` | `fallback` 固定指标 `[74,72,45,74]`、固定总结文案。 | `REPLACE_WITH_STATE_BOUNDARY` | L3、L6–L14 | 高。报告页会显示伪造的 AI 评分，直接误导用户。 |
| 6 | `assessment/written/written.js` | 6 道书面练习题及选项全部硬编码，且强制第 3 题默认选 A。 | `REPLACE_WITH_STATE_BOUNDARY` | L2–L9、L12–L13 | 高。题目与答案应来自后端题库。 |
| 7 | `assessment/written/written.js` | 提交答案后 `setTimeout` 650ms 直接跳转报告页，无真实判卷/生成报告。 | `REPLACE_WITH_STATE_BOUNDARY` | L56–L63 | 高。书面练习提交需后端判卷并返回报告。 |
| 8 | `teacher/reviews/submission-1/app.js` | 8 名学生姓名、时长、评分状态全部硬编码。 | `REPLACE_WITH_STATE_BOUNDARY` | L2–L11 | 高。复核页数据必须来自后端。 |
| 9 | `teacher/reviews/submission-1/app.js` | 发布反馈按钮 `setTimeout` 750ms 后直接变为“已发布”。 | `REPLACE_WITH_STATE_BOUNDARY` | L65–L74 | 高。评分与反馈必须持久化到后端。 |
| 10 | `teacher/reviews/submission-1/app.js` | 词语定位 `seek` 硬编码为 13 秒 / 41 秒。 | `REPLACE_WITH_STATE_BOUNDARY` | L76–L79 | 中。时间戳应由 ASR 转写结果驱动。 |
| 11 | `assessment/history/history.js` | 历史趋势图 4 维度 × 4 时间点得分全部硬编码。 | `REPLACE_WITH_STATE_BOUNDARY` | L2–L7 | 高。历史数据必须来自后端。 |
| 12 | `assessment/history/history.js` | 复测安排仅写入 `localStorage`，无后端预约。 | `REPLACE_WITH_STATE_BOUNDARY` | L29–L36 | 中。复测安排需调用真实预约 API。 |
| 13 | `teacher/courses/spring/studio/studio.js` | 提交审核按钮 `setTimeout` 800ms 后直接变为“已提交审核”。 | `REPLACE_WITH_STATE_BOUNDARY` | L40–L42 | 中。课程发布需调用真实审核 API。 |
| 14 | `teacher/courses/spring/studio/studio.js` | “教学支持”“离线资源”标签页内容硬编码为模板字符串。 | `REPLACE_WITH_STATE_BOUNDARY` | L5–L6 | 中。课程内容与资源应从后端 CMS/资源库加载。 |
| 15 | `teacher/courses/spring/studio/studio.js` | 使用浏览器原生 `prompt` 修改课程名称。 | `REMOVE` | L23–L25 | 低。生产环境应使用自定义弹窗或受控表单。 |
| 16 | `teacher/assignments/app.js` | 新建任务表单提交后仅在前端插入 DOM 行，无后端持久化。 | `REPLACE_WITH_STATE_BOUNDARY` | L12–L20 | 中。任务列表必须对接后端 CRUD。 |
| 17 | `teacher/assignments/app.js` | 任务详情面板内容硬编码（状态、预计时长、描述）。 | `REPLACE_WITH_STATE_BOUNDARY` | L30 | 中。详情应由后端返回。 |
| 18 | `assets/app-core.js` | `defaults` 硬编码 `user.role`、`user.school`（含“演示”）、`student.courseProgress`、`teacher.reviewsPending` 等全局默认状态。 | `REPLACE_WITH_STATE_BOUNDARY` | L4–L10 | 高。默认值应从后端 bootstrap 或空状态填充，避免演示数据混入生产。 |
| 19 | `student/today/today.js` | 范读播放按钮仅切换 UI 状态与 toast，无真实音频播放。 | `VISUAL_DEMO_ONLY` | L14–L22 | 中。范读必须接入真实音频资源。 |
| 20 | `student/today/today.js` | 资源缓存按钮仅切换 `cached` class 与 toast，未调用 Cache API 或真实离线存储。 | `REPLACE_WITH_STATE_BOUNDARY` | L24–L34 | 中。离线缓存需对接真实下载/存储能力。 |
| 21 | `student/growth/growth.js` | 学生视角与教师视角的文案全部硬编码。 | `REPLACE_WITH_STATE_BOUNDARY` | L3–L4 | 中。成长报告文案应由后端生成。 |
| 22 | `select-school/select.js` | 点击继续后 `setTimeout` 280ms 跳转，实际无学校/角色切换 API 调用。 | `REPLACE_WITH_STATE_BOUNDARY` | L11–L14 | 中。角色与学校选择需后端确认。 |
| 23 | `assets/recorder.js` | `setSync('synced')` 等同步状态完全由前端网络事件推断，未验证服务端响应。 | `REPLACE_WITH_STATE_BOUNDARY` | L318–L336 | 高。同步状态必须以服务端回执为准。 |
| 24 | `assessment/reading/2/reading.js` | 朗读完成状态 `recorded_local`/`completed` 仅由前端录音组件状态推断，未等待后端评分。 | `REPLACE_WITH_STATE_BOUNDARY` | L18–L30、L37–L43 | 高。测评流程需后端确认评分完成。 |

---

## V3 对比基线（同为假实现）

| # | 位置 | 问题 | 标签 | 证据 | 备注 |
|---|---|---|---|---|---|
| V1 | `login/login.js` | 提交表单后直接 `location.href='/select-school'`，无任何鉴权。 | `REPLACE_WITH_STATE_BOUNDARY` | L1 | V3 无任何登录状态。 |
| V2 | `teacher/reviews/submission-1/app.js` | 播放按钮仅切换 `playing` class；发布按钮直接 `alert('反馈已发布')`。 | `REPLACE_WITH_STATE_BOUNDARY` | L1 | V3 是最原始的 alert 演示。 |
| V3 | `teacher/courses/spring/studio/studio.js` | 提交按钮直接 `alert('课程已提交审核')`。 | `REPLACE_WITH_STATE_BOUNDARY` | L1 | V3 无状态变化。 |
| V4 | `teacher/assignments/app.js` | 新建/保存按钮仅控制弹窗开关，无数据持久化。 | `REPLACE_WITH_STATE_BOUNDARY` | L1 | V3 无任务创建逻辑。 |
| V5 | `student/*`、`assessment/*` 多处内联脚本 | 大量页面内联 `<script>` 仅做简单的 class 切换、modal 显隐，无真实状态。 | `VISUAL_DEMO_ONLY` / `REPLACE_WITH_STATE_BOUNDARY` | 多个 HTML 文件 | V3 是静态原型，交互以 class toggle 为主。 |

结论：V3 全部为演示级假实现；V4 在登录、录音、播放器、报告、复核、任务、历史、练习等关键链路上升级为“带本地状态的演示”，但核心服务端边界仍是模拟的。

---

## 按标签统计

| 标签 | V4 数量 | V3 数量 | 说明 |
|---|---|---|---|
| `REPLACE_WITH_STATE_BOUNDARY` | 19 | 4 | 需接入后端或真实设备能力。 |
| `VISUAL_DEMO_ONLY` | 3 | 1 | 演示模式可保留，但必须明确标注。 |
| `REMOVE` | 1 | 0 | 必须移除的原生交互。 |
| **合计** | **23** | **5** | V4 共 23 处、V3 共 5 处需要处理。 |

---

## 全局默认状态硬编码详情

`assets/app-core.js` L4–L10 的 `defaults` 包含：

```javascript
const defaults = {
  network: navigator.onLine ? 'online' : 'offline',
  student: { courseProgress: 42, completedSteps: [1], currentStep: 2 },
  assessment: { readingStatus: 'not_started', writtenAnswers: {}, currentQuestion: 3 },
  teacher: { selectedStudent: 0, reviewsPending: 12, draftSavedAt: null },
  user: { role: 'student', school: '青海省海南州示范学校（演示）' }
};
```

迁移时必须：

1. 移除所有演示默认值。
2. 用户/学校/角色从后端 session/bootstrap 水合。
3. 学生进度、教师待复核数等从对应 API 获取。
4. 保留 `deepMerge` 能力用于后端状态与本地草稿的合并。

---

## README / IMPLEMENTATION-NOTES 自述的演示边界

- `README.md` 明确说明：“真实鉴权、课程 API、对象存储上传、服务端转码、ASR、AI 评分、权限隔离和审计日志需要接入现有项目后端。”
- `IMPLEMENTATION-NOTES.md` 明确说明未伪造：ASR 转写与音素级评分、AI 测评模型和置信度计算、对象存储分片上传与服务端转码、真实账号鉴权和 RBAC、多设备同步冲突解决、服务端审计日志与数据保留策略。
- V3 `README.md` 明确说明：“当前实现是前端演示体系：身份、学校、任务、测评、报告等数据使用静态演示内容。”

这些自述边界已在上表具体代码位置中体现。

---

## 迁移优先级建议

1. **P0 - 必须首先替换（影响安全与核心业务）**
   - 登录鉴权（`login/login.js`）
   - 全局默认状态（`assets/app-core.js`）
   - 报告 AI 评分 fallback（`assessment/report/demo/report.js`）
   - 录音同步状态（`assets/recorder.js`）
   - 测评完成状态（`assessment/reading/2/reading.js`、`assessment/written/written.js`）

2. **P1 - 必须接入后端数据**
   - 书面练习题库（`assessment/written/written.js`）
   - 历史趋势数据（`assessment/history/history.js`）
   - 教师复核学生列表（`teacher/reviews/submission-1/app.js`）
   - 课程内容与资源（`teacher/courses/spring/studio/studio.js`）
   - 任务 CRUD（`teacher/assignments/app.js`）
   - 学校/角色选择（`select-school/select.js`）
   - 成长报告文案（`student/growth/growth.js`）

3. **P2 - 保留为演示模式或替换真实能力**
   - 录音无权限降级（`assets/recorder.js`）
   - 证据播放器无源模拟（`assets/audio-player.js`）
   - 范读播放（`student/today/today.js`）
   - 资源离线缓存（`student/today/today.js`）

4. **P3 - 移除原生交互**
   - `prompt`/`confirm`（`teacher/courses/spring/studio/studio.js`、`teacher/reviews/submission-1/app.js`）

---

## 验证结论

- V4 源运行时共有 **24 处** 需要处理的假功能/演示实现。
- V3 源运行时共有 **5 处** 基础假实现作为对比。
- 所有伪造数据、模拟 API、模拟同步、硬编码评分均已标记，不会未经审查进入正式生产页面。
- 迁移顺序建议：先替换全局默认状态与登录鉴权，再替换报告/评分/录音同步等核心业务，最后处理演示模式降级与原生交互移除。
