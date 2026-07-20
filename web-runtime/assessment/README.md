# 语赞心声 · 测评闭环交互原型 V4

本压缩包把用户提供的前 8 张测评页面参考图重建为可运行的 HTML/CSS/JavaScript 页面，并增加 1 个书面练习支撑页，使流程可以从测评中心走到报告、录音与历史。

## 启动

Windows：双击 `start.bat`，或在 PowerShell 中运行：

```powershell
cd <解压目录>
python -m http.server 4175
```

浏览器打开：

```text
http://127.0.0.1:4175/assessment/
```

Linux / macOS：

```bash
./start.sh
```

## 8 个核心页面

1. `/assessment/` — 测评中心
2. `/assessment/sessions/SZ20250530-PT-0032/` — 测评准备与设备检查
3. `/assessment/sessions/SZ20250530-PT-0032/reading/RD250530-010/` — 朗读测评状态机
4. `/assessment/sessions/SZ20250530-PT-0032/submit/` — 提交前检查
5. `/assessment/history/` — 历史测评
6. `/assessment/recordings/` — 我的录音
7. `/assessment/sessions/SZ20250530-PT-0032/report/` — 正式报告
8. `/assessment/sessions/SZ20250530-PT-0032/processing/` — 评分处理中

额外支撑页：

- `/assessment/sessions/SZ20250530-PT-0032/written/WR250530-001/` — 书面练习，共 6 题

## 已实现的动态流程

```text
测评中心
→ 测评准备与逐项设备检测
→ 播放示范音频
→ 3 秒准备倒计时
→ 正式录音 / 暂停 / 继续 / 自动停止
→ 试听 / 重录 / 确认
→ 上传阶段预览
→ 书面练习逐题保存
→ 提交前阻塞校验
→ 处理中真实阶段展示
→ 报告
→ 历史与复测
```

朗读页面支持这些前端状态：

```text
LOADING_ITEM
PLAYING_PROMPT
PREPARING
RECORDING
PAUSED
REVIEWING
UPLOADING
UPLOAD_FAILED
UPLOADED
PROCESSING
REJECTED_AUDIO
READY
```

开发时可使用查询参数查看状态，例如：

```text
/assessment/sessions/SZ20250530-PT-0032/reading/RD250530-010/?state=REVIEWING
```

重置交互数据：

```text
/assessment/?reset=1
```

## 业务身份

页面和状态均围绕 `AssessmentSession` 组织，示例身份包括：

- `sessionId`: `SZ20250530-PT-0032`
- `itemId`: `RD250530-010`
- `recordingId`: `REC250530-010-001`
- `speechJobId`: `JOB-7f3a8c2f`
- `reportId`: `RP250530-0098`

不再使用 `/assessment/reading/2` 或 `/assessment/report/demo` 这种无业务身份路由。

## 数据边界

这是前端交互原型，界面右下角始终显示“交互原型 · 示例数据”。当前压缩包没有伪装成已连接生产后端：

- 设备检测为可见的前端检测过程原型；
- 书面答案保存在浏览器 `localStorage`；
- 上传为明确标识的开发预览流程；
- 不会把本地流程描述为服务端真实同步；
- 生产接入时应把 `app.js` 中的状态动作替换为现有 AssessmentSession、Recording、SpeechJob、AssessmentReport API。

## 视觉与响应式

- 使用用户提供的高原山川、学习路径与品牌 Logo 资产；
- 所有导航、表单、状态、列表、图表与按钮均由 HTML/CSS/SVG/Canvas 构建，不使用整页截图充当网页；
- 包含页面进入、路径高光、录音波形和状态反馈动效；
- 支持 `prefers-reduced-motion`；
- 桌面、平板和移动端均有独立收束规则。
