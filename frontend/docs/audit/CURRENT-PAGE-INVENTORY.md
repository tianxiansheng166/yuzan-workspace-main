# 语赞心声 — 当前页面完整清单

> 审计日期：2026-07-18
> 数据来源：web-runtime/server.mjs 路由映射 + 文件系统扫描
> 前端端口：4175（web-runtime/server.mjs）
> 后端端口：4000（apps/api）

## 路由汇总

| # | 路由 | 实际HTML文件 | 所属端 | 主要JS | 主要CSS | 加载api-client.js | 加载app-core.js | 需要登录 | 允许角色 | 需要activeSchoolId | 页面状态 | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/` | index.html | 公共端 | — | styles.css | ❌ | ❌ | ❌ | 公开 | ❌ | VISUAL_ONLY | 首页，纯静态展示 |
| 2 | `/login` | login/index.html | 公共端 | — | — | ✅ | ✅ | ❌ | 公开 | ❌ | READY | 登录页，调用YuzanApi.login |
| 3 | `/select-school` | select-school/index.html | 公共端 | — | — | ✅ | ✅ | ✅ | 所有 | ✅ | READY | 学校选择，调用YuzanApi.selectSchool |
| 4 | `/community` | public-page.html | 公共端 | public-page.js | public-page.css | ❌ | ❌ | ❌ | 公开 | ❌ | LOCAL_DEMO | 社区介绍页 |
| 5 | `/support` | public-page.html | 公共端 | public-page.js | public-page.css | ❌ | ❌ | ❌ | 公开 | ❌ | DUPLICATE_ROUTE | 与/community同文件 |
| 6 | `/impact` | public-page.html | 公共端 | public-page.js | public-page.css | ❌ | ❌ | ❌ | 公开 | ❌ | DUPLICATE_ROUTE | 与/community同文件 |
| 7 | `/cooperation` | public-page.html | 公共端 | public-page.js | public-page.css | ❌ | ❌ | ❌ | 公开 | ❌ | DUPLICATE_ROUTE | 与/community同文件 |
| 8 | `/service-system` | public-page.html | 公共端 | public-page.js | public-page.css | ❌ | ❌ | ❌ | 公开 | ❌ | DUPLICATE_ROUTE | 与/community同文件 |
| 9 | `/volunteer/links` | volunteer-links.html | 志愿者端 | — | — | 待确认 | 待确认 | ✅ | VOLUNTEER | ✅ | UNKNOWN | 志愿者链接页 |
| 10 | `/admin` | admin.html | 管理端 | admin.js | admin.css | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 管理驾驶舱 |
| 11 | `/admin/assessment-content/*` | admin-integration.html | 管理端 | admin-integration.js | — | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 测评内容管理子页 |
| 12 | `/admin/assessment-links/*` | admin-integration.html | 管理端 | admin-integration.js | — | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 测评链接子页 |
| 13 | `/admin/content-review/*` | admin-integration.html | 管理端 | admin-integration.js | — | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 内容审核子页 |
| 14 | `/admin/curriculum/*` | admin-integration.html | 管理端 | admin-integration.js | — | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 课程管理子页 |
| 15 | `/admin/privacy/*` | admin-integration.html | 管理端 | admin-integration.js | — | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 隐私合规子页 |
| 16 | `/admin/product-plans/*` | admin-integration.html | 管理端 | admin-integration.js | — | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 套餐管理子页 |
| 17 | `/admin/schools/*` | admin-integration.html | 管理端 | admin-integration.js | — | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 学校管理子页 |
| 18 | `/admin/system-providers/*` | admin-integration.html | 管理端 | admin-integration.js | — | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 系统运维子页 |
| 19 | `/admin/users-roles/*` | admin-integration.html | 管理端 | admin-integration.js | — | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 用户角色子页 |
| 20 | `/admin/school-operation/*` | admin-integration.html | 管理端 | admin-integration.js | — | ✅ | ✅ | ✅ | ADMIN | ✅ | FUNCTION_PARTIAL | 学校运营详情子页 |
| 21 | `/admin/*`（其余） | admin.html | 管理端 | admin.js | admin.css | ✅ | ✅ | ✅ | ADMIN | ✅ | ROUTE_ONLY | 其他管理路由 |
| 22 | `/volunteer` | volunteer.html | 志愿者端 | volunteer.js | volunteer.css | 待确认 | 待确认 | ✅ | VOLUNTEER | ✅ | UNKNOWN | 志愿者工作台 |
| 23 | `/volunteer/*` | volunteer.html | 志愿者端 | volunteer.js | volunteer.css | 待确认 | 待确认 | ✅ | VOLUNTEER | ✅ | DUPLICATE_ROUTE | 所有志愿者子路由指向同文件 |
| 24 | `/plans` | plans.html | 公共端 | plans.js | plans.css | 待确认 | 待确认 | ❌ | 公开 | ❌ | UNKNOWN | 产品套餐页 |
| 25 | `/research` | research.html | 教研端 | research.js | research.css | 待确认 | 待确认 | ✅ | RESEARCH | ✅ | UNKNOWN | 教研中心 |
| 26 | `/teacher-tools` | tools.html | 教师工具 | tools.js | tools.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 教师工具箱 |
| 27 | `/teacher-tools/*` | tools.html | 教师工具 | tools.js | tools.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | DUPLICATE_ROUTE | 同上 |
| 28 | `/teacher` | teacher.html | 教师端 | teacher.js | teacher.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 教师工作台首页 |
| 29 | `/teacher/courses/spring/studio` | teacher/courses/spring/studio/index.html | 教师端 | studio.js | style.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 课程工作室 |
| 30 | `/teacher/assignments` | teacher/assignments/index.html | 教师端 | app.js | style.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 教学任务 |
| 31 | `/teacher/reviews/*` | teacher/reviews/submission-1/index.html | 教师端 | app.js | style.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 提交复核 |
| 32 | `/teacher/assessments/create` | teacher/assessments/create/index.html | 教师端 | app.js | styles.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 创建测评 |
| 33 | `/teacher/assessments/detail` | teacher/assessments/detail/index.html | 教师端 | app.js | styles.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 测评详情 |
| 34 | `/teacher/assessments/tasks` | teacher/assessments/tasks/index.html | 教师端 | app.js | styles.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 测评任务 |
| 35 | `/teacher/assessments` | teacher/assessments/tasks/index.html | 教师端 | app.js | styles.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | DUPLICATE_ROUTE | 同/tasks |
| 36 | `/teacher/classes/detail` | teacher/classes/detail/index.html | 教师端 | app.js | styles.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 班级详情 |
| 37 | `/teacher/classes` | teacher/classes/index.html | 教师端 | app.js | styles.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 班级管理 |
| 38 | `/teacher/students/detail` | teacher/students/detail/index.html | 教师端 | app.js | styles.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 学生详情 |
| 39 | `/teacher/students` | teacher/students/demo/index.html | 教师端 | app.js | styles.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | LOCAL_DEMO | 学生列表（demo版） |
| 40 | `/teacher/ai-tools` | teacher/ai-tools/index.html | 教师端 | app.js | styles.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | AI工具中心 |
| 41 | `/teacher/translation` | teacher/translation/index.html | 教师端 | script.js | styles.css | 待确认 | 待确认 | ✅ | TEACHER | ✅ | UNKNOWN | 翻译工具 |
| 42 | `/student/assignments` | student-integration.html | 学生端 | student-integration.js | — | 待确认 | 待确认 | ✅ | STUDENT | ✅ | UNKNOWN | 学生作业（整合壳） |
| 43 | `/student/community` | student-integration.html | 学生端 | student-integration.js | — | 待确认 | 待确认 | ✅ | STUDENT | ✅ | DUPLICATE_ROUTE | 学生社区（整合壳） |
| 44 | `/student/course-center` | student-integration.html | 学生端 | student-integration.js | — | 待确认 | 待确认 | ✅ | STUDENT | ✅ | DUPLICATE_ROUTE | 课程中心（整合壳） |
| 45 | `/student/exercises` | student-integration.html | 学生端 | student-integration.js | — | 待确认 | 待确认 | ✅ | STUDENT | ✅ | DUPLICATE_ROUTE | 练习（整合壳） |
| 46 | `/student/offline` | student-integration.html | 学生端 | student-integration.js | — | 待确认 | 待确认 | ✅ | STUDENT | ✅ | DUPLICATE_ROUTE | 离线资源（整合壳） |
| 47 | `/student/recommendations` | student-integration.html | 学生端 | student-integration.js | — | 待确认 | 待确认 | ✅ | STUDENT | ✅ | DUPLICATE_ROUTE | 推荐（整合壳） |
| 48 | `/student/courses` | student/courses/index.html | 学生端 | courses.js | style.css | ✅ | ✅ | ✅ | STUDENT | ✅ | FUNCTION_PARTIAL | 课程中心 |
| 49 | `/student/growth` | student/growth/index.html | 学生端 | growth.js | style.css | ✅ | ✅ | ✅ | STUDENT | ✅ | FUNCTION_PARTIAL | 成长报告 |
| 50 | `/student/profile` | student/profile/index.html | 学生端 | — | — | 待确认 | 待确认 | ✅ | STUDENT | ✅ | VISUAL_ONLY | 个人中心（无JS） |
| 51 | `/student/learn` | student/learn/spring-2/index.html | 学生端 | player.js | style.css | ✅ | ✅ | ✅ | STUDENT | ✅ | FUNCTION_PARTIAL | 学习播放器/录音 |
| 52 | `/student/learn/*` | student/learn/spring-2/index.html | 学生端 | player.js | style.css | ✅ | ✅ | ✅ | STUDENT | ✅ | DUPLICATE_ROUTE | 同上 |
| 53 | `/student/today` | student/today/index.html | 学生端 | today.js | style.css | ✅ | ✅ | ✅ | STUDENT | ✅ | FUNCTION_PARTIAL | 今日学习 |
| 54 | `/student/*`（其余） | student/today/index.html | 学生端 | today.js | style.css | ✅ | ✅ | ✅ | STUDENT | ✅ | DUPLICATE_ROUTE | 默认回退到今日学习 |
| 55 | `/assessment` | assessment/index.html | 测评端 | assessment.js | style.css | 待确认 | 待确认 | ✅ | STUDENT | ✅ | UNKNOWN | 测评入口 |
| 56 | `/assessment/reading/2` | assessment/reading/2/index.html | 测评端 | reading.js | style.css | 待确认 | 待确认 | ✅ | STUDENT | ✅ | UNKNOWN | 朗读测评 |
| 57 | `/assessment/written` | assessment/written/index.html | 测评端 | written.js | style.css | 待确认 | 待确认 | ✅ | STUDENT | ✅ | UNKNOWN | 书面练习 |
| 58 | `/assessment/report/demo` | assessment/report/demo/index.html | 测评端 | report.js | style.css | 待确认 | 待确认 | ✅ | STUDENT | ✅ | LOCAL_DEMO | 测评报告（demo） |
| 59 | `/assessment/history` | assessment/history/index.html | 测评端 | history.js | style.css | 待确认 | 待确认 | ✅ | STUDENT | ✅ | UNKNOWN | 测评历史 |

## 关键发现

### 1. 多路由指向同一文件（DUPLICATE_ROUTE）

| 文件 | 关联路由数量 | 风险 |
|---|---|---|
| public-page.html | 5个（/community, /support, /impact, /cooperation, /service-system） | 页面无法区分当前路由，无法正确显示子页面内容 |
| volunteer.html | 所有 /volunteer/* 子路由 | 子页面无法独立加载 |
| tools.html | /teacher-tools 和 /teacher-tools/* | 无子页面区分 |
| admin-integration.html | 10个管理子路由 | 通过JS运行时动态切换 |
| student-integration.html | 6个学生子路由 | 通过JS运行时动态切换 |
| student/learn/spring-2/index.html | /student/learn 和 /student/learn/* | 无子页面区分 |
| student/today/index.html | 所有未匹配的 /student/* | 错误路由可能显示今日学习页 |

### 2. 存在文件但无路由入口

| 文件/目录 | 说明 |
|---|---|
| student-pages/ | 7个独立子页面（作业、社区、练习、离线、推荐等），有完整HTML/JS/CSS但无路由指向 |
| volunteer-pages/ | 8个独立子页面，有完整HTML/JS/CSS但大部分无路由指向 |
| admin-pages/ | 10+个独立子页面，通过admin-integration.html运行时加载 |
| sections/ | 5个公共端子页面（language-community, one-to-one, project-impact, school-cooperation, service-system），无独立路由 |
| teacher/students/demo/ | 路由指向demo版本而非正式版本 |
| student/profile/ | 仅有index.html，无JS文件 |

### 3. 固定演示ID

| 位置 | 固定ID | 影响 |
|---|---|---|
| teacher/reviews/submission-1/ | 目录名含"submission-1" | 所有复核页面固定展示同一提交 |
| assessment/reading/2/ | 目录名含"2" | 朗读测评固定为第2题 |
| assessment/report/demo/ | 目录名含"demo" | 报告使用演示数据 |
| teacher/students/demo/ | 目录名含"demo" | 学生列表使用演示数据 |

### 4. 页面状态统计

| 状态 | 数量 |
|---|---|
| READY | 2 |
| FUNCTION_PARTIAL | 8 |
| VISUAL_ONLY | 2 |
| LOCAL_DEMO | 4 |
| DUPLICATE_ROUTE | 15 |
| ROUTE_ONLY | 1 |
| UNKNOWN | 27 |
| BROKEN | 0 |

> 注：UNKNOWN 状态需要进一步浏览器验证和JS代码分析来确定。
