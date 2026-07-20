# 后端状态与交互契约

## 1. 首屏状态

服务端可在页面脚本加载前注入：

```html
<script>
window.__YUZAN_BOOTSTRAP__ = {
  user: { role: 'student', school: '示范学校' },
  student: { currentStep: 2, completedSteps: [1], courseProgress: 42 },
  assessment: { readingStatus: 'recorded_local', currentQuestion: 3 },
  teacher: { reviewsPending: 7 }
}
</script>
```

也可调用：

```js
await YuzanDemo.loadBackendState('/api/ui-state')
YuzanDemo.hydrate(apiResponse.state)
```

## 2. 测评报告

```js
window.__YUZAN_REPORT__ = {
  id: 'report_123',
  summary: '短句节奏稳定，长句换气仍需练习。',
  subtitle: '本次测评已完成并同步',
  scores: {
    pronunciation: 91,
    fluency: 88,
    rhythm: 79,
    completeness: 93
  },
  evidence: [
    { seek: 4, label: '整体发音清晰自然' },
    { seek: 18, label: '第二句停顿偏长' },
    { seek: 31, label: '结尾语调完成度较好' }
  ],
  teacherFeedback: '重音处理准确，下一次让句尾更自然。',
  retestDate: '2026-08-08'
}
```

报告也兼容 `metrics: [91, 88, 79, 93]`。

## 3. 录音上传建议

前端录音状态：

```text
idle
requesting
recording
paused
recorded
playing
error
```

同步状态：

```text
local
syncing
synced
failed
```

建议接口：

```text
POST /api/recordings/init
PUT  /api/recordings/:id/chunks/:part
POST /api/recordings/:id/complete
GET  /api/recordings/:id/status
GET  /api/recordings/:id/evidence
```

`complete` 建议返回：

```json
{
  "recordingId": "rec_123",
  "status": "processing",
  "durationMs": 38240,
  "localRevision": 4,
  "uploadRevision": 4
}
```

## 4. 页面可由后端决定的状态

| 页面 | 后端数据 | 可变显示 |
|---|---|---|
| 登录 | session、错误码、MFA | 加载、失败、离线凭据、二次验证 |
| 学校选择 | 学校、角色、权限 | 可选学校、身份、目标工作台 |
| 教学任务 | 任务、班级、提交数 | 状态、筛选、关注事项、分页 |
| 教师复核 | 学生提交、AI 建议 | 当前学生、评分、证据、反馈状态 |
| 今日学习 | 课程与缓存清单 | 当前步骤、资源缓存、网络状态 |
| 朗读页面 | 课程句子、录音记录 | 录制、暂停、本地保存、同步 |
| 书面练习 | 题目与草稿 | 当前题、答案、保存状态 |
| 测评报告 | 分数、证据、反馈 | 指标、建议、教师反馈、复测 |
| 历史对比 | 历史记录、维度 | 时间范围、曲线、事件、复测计划 |

## 5. 数据安全边界

生产环境应补齐：

- 录音明确授权与撤回；
- 最小化采集和保存期限；
- 本地缓存加密或受控清理；
- 上传幂等键和版本号；
- 班级、学校和角色权限隔离；
- 教师查看与导出审计；
- 未成年人数据处理规则。
