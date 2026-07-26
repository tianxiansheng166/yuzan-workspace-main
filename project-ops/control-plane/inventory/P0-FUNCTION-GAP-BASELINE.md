# P0 功能缺口基线

## 当前结论

在 source commit `a62ee166363f1bcaff1be81d017d5d46d36f7583` 上，静态扫描发现：

- 79 个 HTML 页面；
- 1,882 个可操作控件；
- 962 个控件没有找到 handler 引用；
- 862 个只有 handler 引用；
- 58 个只是静态导航。

这不能推出“962 个 bug”或“862 个功能已完成”。它只说明当前前端规模远大于已经证明的
业务闭环。`HANDLER_REFERENCE_PRESENT` 仍可能只是 toast、本地高亮、固定 ID、静态数据或
失败后假成功；必须进入 FeatureChain 和真实浏览器旅程后才能升级状态。

## 当前 P0 页面优先级

| 页面 | 控件 | 静态未解析 | 已见 handler | 已知风险 | P0 决策 |
| --- | ---: | ---: | ---: | --- | --- |
| `frontend/login/index.html` | 16 | 7 | 9 | demo token/fallback | 先移除假登录并做 fresh-context 负向 |
| `frontend/teacher/assignments/index.html` | 25 | 18 | 7 | 固定 submission、演示关注数据 | 保留创建任务；无关卡片明确延后/删除 |
| `frontend/student/today/index.html` | 5 | 0 | 5 | 尚未跨端证明 | 接收刚发布的动态 assignment |
| `frontend/student/courses/course-detail/index.html` | 27 | 8 | 18 | 录音/提交尚未连续证明 | 接真实录音、答案、submission 与刷新 |
| `frontend/teacher/submissions/detail/index.html` | 20 | 5 | 5 | 上游仍固定 submission | 只从动态提交列表进入并真实复核 |
| `frontend/teacher/reviews/submission-1/index.html` | 7 | 5 | 2 | 固定业务 ID | 从活动导航移除固定路径或改为动态队列 |

## 控件处置规则

每个控件只能进入三种产品决定之一：

1. `IMPLEMENT_NOW`：创建 FeatureChain，必须补齐 handler、API、对象/状态、持久化、当前
   页面反馈、下游观察、刷新/新会话和权限负向；
2. `DEFER_TRUTHFULLY`：保留必要信息架构，但清楚显示未开放且不生成假数据/假成功；
3. `REMOVE`：对 P0 没有用户价值、会误导评审或复制业务动作的控件直接移除。

不要给 1,882 个控件逐个开开发任务。先按同一 `domain action + object + state transition`
去重，多个页面消费同一个 API/DTO/状态机；任务沿一条跨端 FeatureChain 切片，不能按“前端
页、后端接口、数据库”横向拆散后分别宣告完成。

## 第一条必须通过的链

```text
真实登录
→ 教师保存动态任务（runId）
→ 学生新会话看到同一 assignmentId
→ 学生录音、答题并提交动态 submissionId
→ 教师新会话从动态队列打开 submissionId
→ 教师播放证据并通过/退回
→ 学生新会话看到反馈或新 Attempt
→ API/DB/对象存储/租户负向与页面一致
```

在这条链达到 `CROSS_ROLE_VERIFIED` 前，不扩 AI 教案、翻译、社区、志愿者、区域大屏或
更多展示页面。
