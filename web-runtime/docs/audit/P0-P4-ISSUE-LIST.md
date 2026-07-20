# P0–P4 问题清单

> 审计日期：2026-07-18
> 来源：INTERACTION-AUDIT.md, INTEGRATION-RISK-AUDIT.md, API-CLIENT-AUDIT.md, CURRENT-PAGE-INVENTORY.md

## 优先级定义

| 级别 | 含义 | 用户影响 |
|------|------|---------|
| **P0** | 阻断性 | 核心流程完全不可用，用户无法完成主要任务 |
| **P1** | 严重 | 关键功能缺失，用户操作无实际效果 |
| **P2** | 中等 | 功能可用但有明显缺陷或数据不一致 |
| **P3** | 轻微 | 体验问题，不影响核心功能 |
| **P4** | 优化 | 可以后续迭代处理的改进项 |

---

## P0 — 阻断性问题（3个）

### P0-01: 教师复核"发布反馈"是假操作
- **位置**: `/teacher/reviews/submission-1` — `app.js` R4按钮
- **现象**: 点击"发布反馈"后toast提示"反馈已发布，学生端将显示练习建议"，但实际仅修改本地数组+setTimeout模拟
- **影响**: 教师最核心的工作闭环（审阅→评分→发布反馈→学生收到）断裂；学生永远收不到反馈
- **修复方案**: 调用 `POST /schools/:schoolId/submissions/:submissionId/feedback`
- **修复难度**: 中（后端feedback接口已存在，需前端接入）

### P0-02: 录音"同步"是setTimeout伪造
- **位置**: `/student/learn/spring-2` — `player.js` 同步按钮
- **现象**: 点击同步按钮后，setTimeout 900ms后显示"同步成功"，但从未调用后端API
- **影响**: 学生学习进度不持久化，换设备/刷新后进度丢失
- **修复方案**: 调用 `YuzanApi.completeRecording()` + 后端进度更新API
- **修复难度**: 中（录音上传闭环已有LIVE接口，但进度同步需补充）

### P0-03: 测评全流程数据硬编码
- **位置**: `/assessment/*` 所有5个页面
- **现象**: 测评报告数据完全硬编码，不调用后端API；仅使用YuzanDemo本地状态
- **影响**: 测评结果无法持久化，无法生成真实报告，无法用于教学决策
- **修复方案**: 接入 `assessment` 模块后端API (`/schools/:schoolId/assessments/sessions`)
- **修复难度**: 高（5个页面全部需要改写数据源）

---

## P1 — 严重问题（8个）

### P1-01: iframe子页面鉴权断裂
- **位置**: `student-integration.js`, `admin-integration.js`
- **现象**: iframe内子页面无法访问父页面的 `window.YuzanApi`，需各自引入api-client.js
- **影响**: 6个学生子页面 + 10个管理子页面可能无法调用后端API
- **修复方案**: iframe子页面统一引入api-client.js，或使用postMessage传递token
- **修复难度**: 中

### P1-02: 创建测评"发布测评"是假操作
- **位置**: `/teacher/assessments/create` — "发布测评"按钮
- **现象**: toast显示"已确认"，但未调用后端API
- **修复方案**: 调用 `POST /schools/:schoolId/assessments/sessions`
- **修复难度**: 中

### P1-03: 创建测评"保存草稿"是假操作
- **位置**: `/teacher/assessments/create` — "保存草稿"按钮
- **现象**: toast显示"已保存"，但未调用后端API
- **修复方案**: 调用 `POST /schools/:schoolId/teacher-tools/drafts`
- **修复难度**: 中

### P1-04: 测评详情"暂停/继续/生成报告/延长时间"全部假操作
- **位置**: `/teacher/assessments/detail` — 4个按钮
- **现象**: 仅修改DOM状态，未调用后端
- **修复方案**: 分别调用对应的PATCH/GET API
- **修复难度**: 中

### P1-05: 教师工作台首页23个交互仅1个真实连接后端
- **位置**: `/teacher` — teacher.js
- **现象**: 23个交互中仅"通知"(TH16)调用YuzanApi.getNotifications()，其余全部LOCAL_ONLY/DEMO_ONLY/FAKE_SUCCESS
- **修复方案**: 接入getDashboard()返回的待办/课程/任务数据
- **修复难度**: 高

### P1-06: 我的班级/班级详情页无API调用
- **位置**: `/teacher/classes`, `/teacher/classes/detail`
- **现象**: 全部数据硬编码，10个交互全部DEMO_ONLY或FAKE_SUCCESS
- **修复方案**: 接入 `GET /schools/:schoolId/classes` 等API
- **修复难度**: 高

### P1-07: localStorage跨角色共享导致登出互相影响
- **位置**: `api-client.js` clearSession()
- **现象**: 所有角色共享同一localStorage域，401响应自动触发全局clearSession，单角色登出清除全部凭证
- **影响**: 管理员在admin页面收到401→学生端也登出
- **修复方案**: 按角色隔离localStorage key前缀
- **修复难度**: 低

### P1-08: 后端重复路由 — teacher-tools被两个Controller注册
- **位置**: `tools/teacher-tools.controller.ts` 和 `teacher-tools/teacher-tools.controller.ts`
- **现象**: 两个Controller都注册了 `schools/:schoolId/teacher-tools`，NestJS会按模块注册顺序决定哪个生效
- **影响**: 请求可能路由到错误的Controller，导致功能不可用
- **修复方案**: 合并两个Controller或修改路由前缀
- **修复难度**: 低

---

## P2 — 中等问题（10个）

### P2-01: 首页使用iframe嵌套滚动而非自然垂直滚动
- **位置**: `/` index.html
- **现象**: 5个iframe区域嵌入首页，不支持自然鼠标垂直滚动
- **修复方案**: 移除iframe，改为直接DOM嵌入或SPA组件

### P2-02: 导航栏设计不统一
- **位置**: 多个页面
- **现象**: 教师端用teacher-shell侧栏、学生端用student-nav顶栏、管理端用admin-nav、全局用global-nav浮动按钮
- **修复方案**: 统一导航组件设计语言

### P2-03: global-nav.js未排除/student路径导致双导航
- **位置**: global-nav.js
- **现象**: 学生端页面同时出现全局浮动导航 + 学生端自己导航
- **修复方案**: 在global-nav.js排除规则中添加/student

### P2-04: teacher-shell移动DOM+删除旧导航破坏页面脚本
- **位置**: teacher-shell.js
- **现象**: 将页面内容根节点从原始位置移入#ts-page-root，删除旧header/sidebar
- **影响**: 页面脚本对DOM父子关系的假设被破坏

### P2-05: student-nav的reFit与fit.js缩放冲突
- **位置**: student-nav.js
- **现象**: reFit覆盖fit.js缩放逻辑，setTimeout(reFit, 50)二次延迟覆盖可能引起视觉闪烁
- **修复方案**: 统一缩放策略

### P2-06: iframe内CSS注入用!important覆盖通用类名
- **位置**: student-integration.js, admin-integration.js
- **现象**: 用!important大面积覆盖.sidebar, .topbar, .app-shell, .main等通用类名
- **影响**: 可能误杀子页面元素样式

### P2-07: 未匹配路由回退到login而非404
- **位置**: server.mjs
- **现象**: 所有未匹配路径都回退到login/index.html
- **修复方案**: 添加404页面

### P2-08: 教师测评任务"导出数据""复制链接"假操作
- **位置**: `/teacher/assessments/tasks`
- **现象**: toast提示但无实际导出/复制
- **修复方案**: 接入对应API

### P2-09: 前端缺少classes/assignments/submissions/learning/feedback封装
- **位置**: api-client.js
- **现象**: 后端有完整CRUD接口但前端未封装
- **修复方案**: 补充API封装方法

### P2-10: 测评端所有页面仅使用YuzanDemo不使用YuzanApi
- **位置**: assessment/ 下5个页面
- **现象**: 完全不调用后端API，仅操作本地YuzanDemo状态
- **修复方案**: 全面接入后端assessment API

---

## P3 — 轻微问题（7个）

### P3-01: 固定演示ID — reviews→submission-1, students→demo
- **位置**: server.mjs路由映射
- **现象**: 复核页面永远展示同一提交，学生列表使用demo版
- **修复方案**: 路由参数化，动态加载

### P3-02: 硬编码演示数据
- **位置**: 多处
- **现象**: 学号20240215027、邀请码TCH-7Q1A-B9K2、任务编号EVT-20250426-001
- **修复方案**: 从API动态获取

### P3-03: 11个后端Service无Prisma调用（纯stub）
- **位置**: community, cooperation, curriculum, offline, organizations, support-pairings, training, translations, volunteers
- **现象**: 这些模块返回硬编码数据或空数组
- **修复方案**: 按业务优先级逐步实现Prisma持久化

### P3-04: 录音上传Content-Type固定为json但上传需不同类型
- **位置**: api-client.js request()方法
- **现象**: 所有请求Content-Type固定为application/json，但Multipart上传需要不同类型
- **修复方案**: 允许调用方覆盖Content-Type

### P3-05: api-client.js无请求超时和重试机制
- **位置**: api-client.js request()方法
- **现象**: fetch无超时，失败无重试
- **修复方案**: 添加AbortController超时 + 指数退避重试

### P3-06: teacher-shell移动端min-width:900px强制横向滚动
- **位置**: teacher-shell.css
- **现象**: 在移动端强制横向滚动
- **修复方案**: 添加响应式断点

### P3-07: 个人中心"离线资源管理"按钮alert("开发中")
- **位置**: `/student/profile`
- **现象**: 点击后弹窗"开发中"
- **修复方案**: 隐藏按钮或接入离线管理功能

---

## P4 — 优化项（6个）

### P4-01: 多路由指向同一HTML文件应优化
- **位置**: server.mjs
- **现象**: 15个DUPLICATE_ROUTE
- **修复方案**: SPA内路由参数化

### P4-02: YuzanDemo默认值与真实数据混杂
- **位置**: app-core.js
- **现象**: courseProgress:42, completedSteps:[1], currentStep:2等默认值可能误导
- **修复方案**: 区分demo模式和真实模式

### P4-03: 测评报告页面路径含"demo"应改为动态
- **位置**: `/assessment/report/demo`
- **现象**: URL中包含"demo"标识
- **修复方案**: 改为 `/assessment/report/:id`

### P4-04: 志愿者端子页面缺少路由
- **位置**: volunteer-pages/ 下8个子页面
- **现象**: 无server.mjs路由指向，仅能通过volunteer.html动态加载
- **修复方案**: 添加子路由映射

### P4-05: 首页sections无独立路由
- **位置**: sections/ 下5个子页面
- **现象**: 仅通过首页iframe嵌入
- **修复方案**: 为公共项目介绍页添加独立路由

### P4-06: 旧版首页未清理
- **位置**: `_old-home/index.html`
- **现象**: 无路由指向的废弃文件
- **修复方案**: 移至归档目录

---

## 按优先级统计

| 优先级 | 数量 | 影响用户数 | 修复总难度 |
|--------|------|-----------|-----------|
| P0 | 3 | 全部 | 高 |
| P1 | 8 | 教师+管理员 | 中-高 |
| P2 | 10 | 全部 | 中 |
| P3 | 7 | 部分 | 低 |
| P4 | 6 | 轻微 | 低 |
| **总计** | **34** | — | — |
