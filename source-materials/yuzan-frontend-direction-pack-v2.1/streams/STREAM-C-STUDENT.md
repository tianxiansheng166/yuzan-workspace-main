# Stream C：学生页面视觉迁移

## 第一波范围

- `/student/today`
- `/student/learning/[activityId]`
- `/reports` 及已有学生报告展示

## 暂不拥有

- exercises/QST 页面，直到 QST owner 正式交接；
- offline runtime/outbox；
-auth/session；
-assignment visibility；
-submission API。

## 只改呈现

保留 today/learning state、offline public state、loading/error/unavailable 和所有测试。

## 目标

- 390px 优先；
-一个主要 CTA；
-学习路径而非卡片网格；
-真实离线/待同步/失败；
-不显示 future assignment；
-录音和学习操作触控友好。

返回 `FRONTEND_STREAM_C_READY`，附接口比较结果。
