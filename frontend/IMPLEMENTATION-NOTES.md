# 实现说明 v4

## 页面开发原则

1. 每个参考状态按原始视口建立设计画布并单独校准。
2. 页面结构、CSS 与交互逐页编写，不使用脚本批量拼装页面。
3. 浏览器自动化只用于打开路由、操作控件、截图、检测错误和计算差异。
4. 业务控件不得使用整块截图替代；纯艺术背景可使用独立图像素材。
5. 静态视觉与动态可用性发生冲突时，优先保持布局与视觉语言，同时以真实 DOM/Canvas 重建功能区域。

## 录音实现

`assets/recorder.js` 与 `assets/recorder.css` 提供独立录音组件：

- 状态：`idle → requesting → recording ↔ paused → recorded ↔ playing`，另有 `error`。
- 权限与采集：`navigator.mediaDevices.getUserMedia()`。
- 编码：`MediaRecorder`，优先 Opus/WebM，并根据浏览器能力降级。
- 实时分析：Web Audio `AnalyserNode`。
- 波形：Canvas 每帧绘制多层声场曲线，不是静态图片或 GIF。
- 本地持久化：录音 Blob 写入 IndexedDB `yuzan-voice-cache-v1/recordings`。
- 元数据：时长、采样曲线、同步状态写入 localStorage。
- 弱网：断网时保留本机；恢复网络后切换到同步中和已同步状态。
- 无权限降级：提供明确提示的交互演示声场，按钮与流程仍可验证。

## 声证据播放器

`assets/audio-player.js` 与 `assets/audio-player.css` 提供：

- IndexedDB 录音读取；
- 播放、暂停、进度跳转和倍速；
- Canvas 波形与进度游标；
- 教师复核中的词语时间定位；
- 报告和成长页的证据复用。

## 后端状态接入

`assets/app-core.js` 支持：

- 深层合并本地状态；
- `window.__YUZAN_BOOTSTRAP__` 首屏状态；
- `YuzanDemo.hydrate(payload)` 运行时水合；
- `YuzanDemo.loadBackendState(endpoint)` API 拉取；
- `?state.student.currentStep=3` 等查询参数演示；
- `data-bind-text`、`data-bind-value`、`data-visible-when`、`data-class-when` 声明式绑定；
- `yuzan:state` 与 `yuzan:backend-error` 事件。

## 图像素材边界

保留为图片的内容：

- 山脉、河谷、太阳、等高线和纸张纹理；
- 页面中的纯装饰性山景；
- 无业务语义的插画背景。

已经从截图替换为真实界面的区域：

- 学生朗读录音控制台；
- 测评朗读控制台；
- 教师声证据播放器；
- 报告与成长页声证据；
- 测评流程侧栏；
- 教学任务关注事项；
- 答题选项与题目目录；
- 任务创建、复测安排和反馈发布。

## 功能边界

已实现真实浏览器录音和本地保存，但未伪造以下服务端能力：

- ASR 转写与音素级评分；
- AI 测评模型和置信度计算；
- 对象存储分片上传与服务端转码；
- 真实账号鉴权和 RBAC；
- 多设备同步冲突解决；
- 服务端审计日志与数据保留策略。
