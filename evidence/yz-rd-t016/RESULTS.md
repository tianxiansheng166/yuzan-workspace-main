# YZ-RD-T016 学生导航验收结果

**状态：DONE / WEB_ONLY**

**基线：** `feat/yz-rd-t011-web-review-feedback@4d971c9683664c09e533069ec001b00d0dc239af`

**输出分支：** `feat/yz-rd-t016-student-navigation-experience`

**仓库：** `/home/tian/code/yuzan-workspace-t016`（独立 worktree）

该验收提交按任务要求普通推送到 `origin`，不使用 force；最终回传会报告并核对远端与本地一致的提交 SHA。

## 真实路由与旧入口

| 导航 | 目标路由 | 已验证的真实业务请求 | 结果 |
|---|---|---|---|
| 今日学习 | `/student/today/` | `GET /api/v1/schools/:schoolId/student/today` | 200，Student Today 页面由 API 数据渲染 |
| 课程中心 | `/student/courses/` | `GET /api/v1/schools/:schoolId/student/courses` | 200，课程目录由当前学生学籍读取 |
| 练习中心 | `/student/practices/` | `GET /api/v1/schools/:schoolId/practices` | 200，真实练习目录 |
| 学习历史 | `/student/practices/history/` | `GET .../assessments/sessions`、`GET .../assessments/history`、反馈事件 | 200，真实 Attempt、测评和反馈页面 |
| 我的成长 | `/student/progress/` | `GET /api/v1/schools/:schoolId/students/me/question-bank-progress` | 200，使用已存在的题库进步服务 |
| 个人中心 | `/student/profile/` | `GET /api/v1/schools/:schoolId/student/profile` | 200，身份和学籍来自当前授权学生 Profile |

以下旧入口没有作为正式业务保留：任务、独立测评、推荐、社区和离线管理会落到静态整合页或兼容壳。练习入口统一指向真实练习目录。导航不再显示“离线可用”或离线管理；课程页没有下载实现的 `data-offline` 控件在共享样式下隐藏。网络标签仅反映 Chromium 的 `navigator.onLine`。

## 移动端、桌面和交互

- 390px：6 项全部展开可见；测试点击每个入口并检查真实页面、API 200、当前项 `aria-current="page"` 和浏览器 URL。
- 768px：6 项全部展开可见，并实际点击“今日学习”后通过返回恢复个人中心。
- 1280px、1440px：桌面导航完整可见，当前项随路由高亮。
- 通过点击开关、Escape、外部点击、点击菜单项、屏幕宽度切换测试 `aria-expanded`、`aria-controls`、焦点恢复和布局恢复；所有视口均无横向溢出。
- 刷新、返回、前进和深链接后，当前路由与高亮保持一致。
- `prefers-reduced-motion: reduce` 下，菜单过渡时长收敛到 0.01ms 并可立即关闭。

## 身份、权限与网络状态

E2E 在 T016 PostgreSQL 中创建虚构学生甲、乙以及仅用于验证的第二学校和班级。浏览器通过真实登录 API 获取令牌：

- 学生甲切换到有效的第二学校后，导航先清除旧学校和班级，再显示新 Profile。
- 更新学生甲的活动学籍并重新聚焦页面后，旧班级立即消失，新班级来自再次读取的 Profile。
- 学生甲切换到学生乙后，学生甲的姓名、头像首字和学籍不再显示。
- 清除会话后显示“未登录”；无 Cookie 的匿名请求返回 401，教师访问学生 Profile 返回 403。
- 浏览器离线/在线事件分别显示“网络状态 · 离线/在线”；没有下载成功或离线可用声明。

## 原创图标与动效

`frontend/shared/student-nav.js` 为六项业务入口绘制独立 SVG path，采用一致的 1.65px 笔画、圆端和圆角；当前页使用编辑式强调线，移动菜单使用自绘三笔 SVG，开合时短暂变形。聚焦描边、当前项、悬停和开合反馈由实际交互触发。`frontend/shared/student-nav.css` 延续原红、绿、纸白和品牌标识，未增加循环动效，并包含减少动态效果偏好规则。

## Chromium / API / PostgreSQL 证据

- Chromium：Google Chrome 153.0.8010.52
- API / Web：NestJS API `127.0.0.1:4096`、Chromium Web `127.0.0.1:4296`
- 数据库：独立 `yuzan_t016_navigation` / `yz_t016`，PostgreSQL 17.11，端口 55639
- 必要依赖：T016 独立 Redis 6439、MinIO 59204–59205；MinIO 本地读写签名 smoke 通过
- 真实 E2E：`1 passed, 0 failed, 0 skipped`；Playwright 使用真实登录、授权 API 和 PostgreSQL，不使用 API 静态 Mock。
- 前端套件：`pnpm --filter @yuzan/frontend test`，`28 passed, 0 failed, 0 skipped`。

截图中“before”由浏览器按上述确切基线 SHA 加载原始导航 JS/CSS，其他页面和 API 仍由 T016 原生环境提供；“after”由本分支代码和同一真实环境提供。

- 基线：`screenshots/before-390-menu-closed.png`、`screenshots/before-390-menu-click-no-open.png`
- 完成后：`screenshots/after-390-menu-closed.png`、`screenshots/after-390-menu-open.png`、`screenshots/after-390-profile.png`、`screenshots/after-768-menu-open.png`、`screenshots/after-1280-desktop.png`、`screenshots/after-1440-desktop.png`
- E2E 输出：`chromium-api-postgres-e2e.log`

## Git 范围与并行任务隔离

提交范围仅包括：
- `frontend/shared/student-nav.js`
- `frontend/shared/student-nav.css`
- `tests/e2e/assessment/test_yz_rd_t016_student_navigation.py`
- `tests/e2e/assessment/run-yz-rd-t016-native.py`
- 本目录中的 T016 RESULTS、截图和 E2E 输出

T016 从指定 SHA 新建独立 worktree；未修改 `frontend/server.mjs`、`frontend/assets/api-client.js`、学生业务页面、API、contracts、Prisma、T014/T015/T005 文件或根目录 `.env`。主工作区仍保有 T005 双语改动和原课程素材。T014 HEAD 在检查前后均为 `0596a9b8256c1d674b93eb2afd4de7306c768129`，工作树干净。T015 HEAD 在 T016 开始时为 `96b0a44ab6d20e7d0f8fb27b21f3450848d21116`，并在 T016 执行期间由其自身工作推进至 `4475f418078e5800678a55b05d418d216962732e`；T016 只读检查其 Git/运行状态，没有写入或停止 T015 的进程。最终检查时 T015 工作树干净，原生状态为 stopped。没有运行 Docker，也没有停止其他任务的服务。

## 服务退出与剩余事项

T016 PostgreSQL、API、Web、Redis、MinIO 均已安全停止；T016 端口 55639、4096、4296、6439、59204、59205 空闲。独立数据库和本机证据保留在 Git 忽略的 T016 runtime 目录，未删除卷或重置数据库。L4 默认卷事故仍为 **OPEN**；T016 未检查、恢复、删除或重建相关数据。

本任务没有实现离线下载能力，菜单和课程页不再提供其虚假入口。物理设备/麦克风、学校试点和生产发布不属于本次 Web 导航验收，未运行。
