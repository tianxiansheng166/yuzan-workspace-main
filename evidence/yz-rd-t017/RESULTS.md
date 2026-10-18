# YZ-RD-T017 学生课程中心验收结果

**STATUS: DONE**

**模式：WEB_ONLY · 学生课程中心**

**基线：`feat/yz-rd-t011-web-review-feedback` @ `4d971c9683664c09e533069ec001b00d0dc239af`**

**交付分支：`feat/yz-rd-t017-course-catalog-web-experience`**

## 验收结论

课程中心保留原有日出背景、课程封面和暖色调，重新整理了筛选区、课程内容层级和卡片操作。课程卡片现在是可用 Enter 打开的真实课程链接；收藏是独立按钮，进度弧线读取服务端完成度。评分排序和课程离线下载入口已移除。目录筛选、排序、分页、空结果、网络错误及重试均以学生课程 API 的实际响应为准。

## 真实 API、SQL 与浏览器证据

使用隔离数据库 `yuzan_t017_native` / `yz_t017`，API、静态站点、Redis 和 MinIO 均由 T017 本机运行环境提供。Chromium 153 完成了真实 UI 登录与课程中心导航；浏览器请求、响应、动态 ID 和验收断言保存在 [chromium-api-events.json](./chromium-api-events.json)。

- 学生 A 的 API 课程总数为 17，授权范围 SQL 同样为 17。`publishedAt DESC` 第一页 12 条、下一页 5 条，与服务端 SQL 顺序一致；跨页重复数为 0。结果数显示“共 17 门 · 已加载 12/17 门”，没有把已加载条数当作目录总数。
- API 的 `popularity` 排序与 SQL `COUNT(Submission.id) DESC, Assignment.id DESC` 一致；顶部课程有 3 条真实 Submission。界面排序项为“最受欢迎”，没有“评分最高”。
- 年级、类别、难度、任务群、文化元素和关键词均作为服务端参数提交。搜索按当前服务端实现只匹配课程标题，输入提示相应限定为“搜索课程名称”。
- 进度 SQL 显示 2 项必修活动中完成 1 项；API 返回 `progressPercent=50`、`status=IN_PROGRESS` 及真实下一项活动，卡片展示“继续学习”和 50% 进度环。
- 收藏操作实际调用 API。添加返回 201，刷新后仍为已收藏；快速双击只产生 1 次 POST。当前基线的取消收藏 DELETE 返回 404，页面随后调用服务端现有 POST 切换接口，返回 `favorited=false`，SQL 收藏行归零。再次刷新后状态仍与数据库一致。
- 学生 B 在独立班级，有有效的学生关系，但 A 的课程没有授权给 B。B 课程列表为 0；读取 A 的真实 Assignment ID 返回 404，收藏 A 的课程也返回 404，SQL 中不存在 B 的 AssignmentTarget。
- 未认证请求返回 401，教师角色请求学生目录返回 403，不可访问课程返回 404。真实空搜索返回 200 / `total=0` 并显示空状态。
- 浏览器网络请求中断后显示“当前需要联网加载课程。网络恢复后可以重试。”；离线时重试按钮禁用，恢复在线后重试成功。延迟旧搜索响应不会覆盖较新的筛选结果。
- 键盘聚焦课程链接显示焦点描边；按 Enter 打开 `/student/courses/course-detail/?id=<真实 Assignment ID>`。静态目录优先解析正常，详情页加载返回 200，`getStudentCourse()` 使用同一 ID 返回 200，课程 Submission 接口返回 201，页面打开真实未完成活动并可返回课程目录。T005 详情文件无需修改。

## 视觉与响应式证据

下列“卡片视图”截图滚动到课程卡片，便于对比标题、封面、收藏、进度和继续学习操作；完整页截图保留当时目录上下文。封面和日出背景来自基线资源。

| 视口 | 基线 | T017 卡片视图 | T017 完整页 |
| --- | --- | --- | --- |
| 390 px | [前](./course-catalog-before-cards-390.png) | [后](./course-catalog-cards-390.png) | [完整页](./course-catalog-after-390.png) |
| 768 px | — | [后](./course-catalog-cards-768.png) | [完整页](./course-catalog-after-768.png) |
| 1280 px | — | [后](./course-catalog-cards-1280.png) | [完整页](./course-catalog-after-1280.png) |
| 1440 px | [前](./course-catalog-before-cards-1440.png) | [后](./course-catalog-cards-1440.png) | [完整页](./course-catalog-after-1440.png) |

另有移动端首屏 [390 px](./course-catalog-after-390-viewport.png)、原始基线完整页 [390 px](./course-catalog-before-390.png) / [1440 px](./course-catalog-before-1440.png)，以及 [当前学习活动详情页](./course-detail-activity-1280.png)。自动布局测量在 390 / 768 / 1280 / 1440 px 均无横向溢出；卡片列数分别为 1 / 2 / 3 / 3。进度环弧线按真实完成度绘制，卡片焦点、描边、收藏和加载反馈由真实交互触发；样式尊重 `prefers-reduced-motion`。

## 测试结果

- Frontend tests：28 passed / 0 failed / 0 skipped。
- API Vitest：1082 passed / 0 failed / 64 skipped；其中 `student-courses.service.spec.ts` 29 passed。剩余跳过项是仓库既有运行时集成用例。
- Chromium + 实际 API + PostgreSQL E2E：1 passed / 0 failed / **0 skipped**。
- API、Frontend、Contracts TypeScript 只读检查：均通过。
- Node JavaScript 语法检查与 `git diff --check`：通过。

## 修改范围与隔离

T017 拥有且只修改以下产品文件：

- `frontend/student/courses/index.html`
- `frontend/student/courses/courses.js`
- `frontend/student/courses/style.css`

新增 T017 专属 E2E、原生环境启动包装脚本及本目录证据。没有修改 API、Prisma、OpenAPI、生成类型、API Client、course-detail、共享学生导航、学生 Today/Growth 或测评文件。T005、T014、T015、T016 的工作树和进程均未被 T017 修改或停止；本机检查发现 T015 自有服务仍使用其自己的路径/端口。

## 原生服务与事故状态

T017 使用 Node 24.20、PostgreSQL 17.11、Redis 7.4.10、MinIO、Chrome 153；无 Docker / Compose，无 Worker。验收结束会通过 T017 进程所有权记录安全停止服务；保留 T017 独立数据库与 MinIO 测试数据，不删除数据卷。L4 历史数据库卷事故仍为 OPEN，本任务没有访问或变更事故数据。

## 后续学生课程缺口

1. 基线只有 `POST /student/courses/:assignmentId/favorite` 切换接口，客户端的 `removeCourseFavorite()` 发 `DELETE` 会 404。页面做了明确 404 后的 POST 兼容回退；后续应由 API Owner 提供语义明确、幂等的收藏/取消收藏合同并同步 OpenAPI。
2. OpenAPI 的 `StudentCourseCatalogResponse` 没有完整描述服务端实际返回的 `total`、`hasMore`、`nextCursor`、`gradeBands`、`difficulties` 等分页/筛选元数据。T017 未越权修改合同或生成类型。
3. 当前服务端关键词搜索只覆盖课程标题，目录已如实提示。若产品需要搜索教师或描述，需在 API 合同与服务端实现中定义并验收。
4. 当前目录 DTO 不提供教师姓名和课时总数，卡片不显示这两项；进度、类别、年级、难度、预计分钟、任务群、文化元素和下一活动均来自真实服务数据。

Git commit SHA 与 push 状态以最终 T017 分支 Git 返回为准。
