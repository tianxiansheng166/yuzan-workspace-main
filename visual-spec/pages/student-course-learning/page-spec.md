# 学生课程学习闭环页面规格

## 基本信息

- 页面名称：学生课程中心、课程详情、动态课程执行器
- 页面 ID：student-course-learning
- 页面族：学生学习
- 目标路由：`/student/courses`、`/student/courses/:assignmentId`、`/student/courses/:assignmentId/submissions/:submissionId/activities/:activityId`
- 使用角色：学生
- 用户主任务：选择真实课程并持续完成章节、活动、笔记、录音和课程练习
- 当前状态：`MAIN_DEMO` / `PLACEHOLDER`
- 目标状态：`MAIN_LIVE`
- 阻塞项：`BLOCKED_BY_CONTRACT`（由本任务 CCR 解除）

## 事实来源

| 类型 | 文件或位置 | 已确认事实 |
| --- | --- | --- |
| 当前主项目 | `web-runtime/student/courses/**` | 薄课程列表，跳固定 `spring-2` |
| 参考图 | `web-runtime/student-pages/yuzan-student-course-center/**/qa/reference.png` | 1659×948 课程中心构图 |
| 历史候选 | `web-runtime/student-pages/yuzan-student-course-center/**` | 可复用筛选、主次布局、覆盖式详情逻辑 |
| 后端 | `apps/api/src/modules/{student-dashboard,learning,submissions,assessment}` | 基础模型与 Practice 执行器已存在 |
| 页面族母版 | `web-runtime/shared/student-nav.*` | 顶部学生一级导航已独立提交 |

## 参考图记录

| 文件 | 摘要 | 尺寸 | 目标视口 | 结论 |
| --- | --- | --- | --- | --- |
| `qa/reference.png` | 课程中心桌面参考 | 1659×948 | 1440/1024 | 迁移信息层级，不复制 demo 数据 |
| `qa/mobile.png` | 历史移动验证 | 390×2613 | 390 | 独立重排为移动全屏详情 |

## 现有实现与复用决策

- 当前页面：`web-runtime/student/courses/index.html`
- 固定播放器：`web-runtime/student/learn/spring-2/**`
- 数据入口：`GET /schools/:schoolId/student/courses-dashboard`
- 决策：课程中心原地重构；将固定播放器替换为动态路由执行器；复用 Practice 通用执行器和现有录音 API。
- 原因：历史页面视觉层级可用，但业务数据、固定活动和跳转链路不可保留。

## 截图分解

| 区域 | 分类 | 实现方式 | 状态变化 |
| --- | --- | --- | --- |
| 继续学习主区域 | DOM_DATA / CSS_LAYOUT | 真实 next activity 与进度 | loading/empty/active |
| 能力主题与辅助筛选 | DOM_CONTROL | URLSearchParams + 客户端筛选 | keyboard/focus |
| 课程封面列表 | DOM_DATA / PHOTO_OR_COVER | 数据库元数据 + 已登记生产封面 | normal/empty/error |
| 详情覆盖层 | INTERACTION_STATE | 正式 URL + history/back + desktop dialog | desktop overlay/mobile page |
| Unit/Lesson/Activity 目录 | DOM_DATA | 聚合 API 树结构 | required/completed/current |
| 动态播放器 | DOM_DATA / DOM_CONTROL | 六种 ActivityType 渲染器 | online/offline/pending sync |
| 课程要点与私人笔记 | DOM_DATA / DOM_CONTROL | published studentNotes + revision PUT | saved/conflict/error |

## 页面状态

- 加载：真实骨架，不显示伪课程。
- 正常：真实数据库课程及学习位置。
- 空数据：说明尚无可访问课程。
- 错误：保留重试入口与 request ID（若返回）。
- 无权限：明确拒绝并提供返回课程中心。
- 离线或待同步：只显示本地未同步状态，不显示已保存/已上传。
- 暂不可用：Speech provider 不可用显示独立达标状态。

## 响应式与验收

- 桌面：课程详情为暖白不透明覆盖面板，背景轻微模糊；章节路径横向。
- 1024：保持主任务优先，筛选换行，详情面板缩窄。
- 390：详情和执行器全屏，章节路径横向滚动，操作区保持触达。
- 视觉证据目录：`evidence/p0-course-learning-closure/screenshots/`
- 不可接受：固定春季课文、emoji 图标、demo 数组、运行时 DOM 补丁、未发布内容或教师备注泄露。
