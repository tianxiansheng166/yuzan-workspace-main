# 页面整合风险审计报告

> 审计日期：2026-07-18
> 审计范围：server.mjs, global-nav.js, teacher-shell.js/css, student-nav.js/css, admin-nav.js/css, student-integration.js, admin-integration.js, app.js

## 一、按文件逐项风险分析

### 1. server.mjs — 路由服务器

| 风险项 | 等级 | 说明 |
|--------|------|------|
| 多路由指向同一HTML | **高** | `/community`, `/support`, `/impact`, `/cooperation`, `/service-system` 全部指向 `public-page.html` |
| 多路由指向同一HTML | **高** | 10个管理子路由全部指向 `admin-integration.html` |
| 多路由指向同一HTML | **中** | 6个学生子路由全部指向 `student-integration.html` |
| 固定演示ID | **高** | `/teacher/reviews/` 永远指向 `submission-1`；`/teacher/students` 永远指向 `demo` |
| 回退路由 | **中** | 未匹配路由默认回退到 `login/index.html`，而非 404 |

### 2. global-nav.js — 全局浮动导航

| 风险项 | 等级 | 说明 |
|--------|------|------|
| `/student` 未排除 | **中** | 学生端页面会同时出现全局浮动导航 + 学生端自己的导航 |
| history.back() | **中** | 若用户从外部链接进入，back 会离开站点 |

### 3. teacher-shell.js — 教师端统一 Shell

| 风险项 | 等级 | 说明 |
|--------|------|------|
| **移动 DOM 元素** | **高** | 将页面内容根节点从原始位置移入 `#ts-page-root`，破坏页面脚本对 DOM 父子关系的假设 |
| **删除旧 header/sidebar** | **高** | 主动删除页面自身导航元素，若页面脚本依赖这些元素会导致运行时报错 |
| **页面脚本依赖被移动前的 DOM** | **高** | DOM 迁移后 `parentNode`、`offsetParent`、`getBoundingClientRect()` 等结果改变 |
| CSS 污染 | **中** | `*{box-sizing:border-box}` 全局重置；`html,body{margin:0...}` 强制覆盖 |
| 移动端破坏 | **中** | `min-width:900px` 在移动端强制横向滚动 |

### 4. student-nav.js — 学生端导航

| 风险项 | 等级 | 说明 |
|--------|------|------|
| fit.js 覆盖 | **高** | `reFit` 函数覆盖 fit.js 的缩放逻辑，`setTimeout(reFit, 50)` 的二次延迟覆盖可能引起视觉闪烁 |
| 设计稿定位冲突 | **高** | `adjustLayout` 直接设置 `design.style.marginTop/marginLeft/width/height/left/top/transform`，与页面自身 fit.js 可能冲突 |
| 异步用户信息更新 DOM | **中** | API 返回后更新 DOM 中用户名，若 API 失败显示默认值"同学" |

### 5. student-integration.js — 学生端 iframe 集成

| 风险项 | 等级 | 说明 |
|--------|------|------|
| **iframe 鉴权丢失** | **高** | iframe 内子页面无法访问父页面的 `window.YuzanApi`，除非子页面自身引入 `api-client.js` |
| **子页面返回按钮错误** | **高** | iframe 内 `history.back()` 只后退 iframe 历史，不回退父页面路由 |
| **CSS 注入污染子页面** | **高** | 用 `!important` 大面积覆盖 `.sidebar`, `.topbar`, `.app-shell`, `.main` 等通用类名 |
| **localStorage key 冲突** | **高** | iframe 与父页面共享同一 localStorage 域，可能互相覆盖登录状态 |
| 固定回退路由 | **中** | 未知路由默认加载课程中心页面 |

### 6. admin-integration.js — 管理端 iframe 集成

| 风险项 | 等级 | 说明 |
|--------|------|------|
| iframe 鉴权丢失 | **高** | 同学生端 |
| CSS 注入污染 | **高** | 同学生端 |
| 子页面返回按钮错误 | **高** | 同学生端 |
| localStorage key 冲突 | **高** | 同学生端 |
| 路由匹配不精确 | **中** | `startsWith` 可能误匹配 |
| 固定回退路由 | **中** | 未知路由回退到 `/admin/curriculum` |

## 二、跨文件系统性风险

### R01: teacher-shell 主动移动 DOM + 删除旧导航，破坏页面脚本对 DOM 的依赖
- **等级**：高
- **文件**：teacher-shell.js
- **影响**：所有教师端子页面

### R02: iframe 子页面无法访问父页面 YuzanApi，鉴权可能断裂
- **等级**：高
- **文件**：student-integration.js, admin-integration.js
- **影响**：所有 iframe 嵌入的子页面

### R03: iframe 内 history.back() 只后退 iframe 历史，不回退父页面路由
- **等级**：高
- **文件**：student-integration.js, admin-integration.js
- **影响**：所有 iframe 嵌入的子页面中的"返回"按钮

### R04: localStorage key 跨角色共享，单角色登出清除全部凭证
- **等级**：高
- **文件**：api-client.js
- **影响**：所有角色页面

### R05: 多路由指向同一 HTML（public-page.html 承载 5 个路由）
- **等级**：高
- **文件**：server.mjs
- **影响**：公共端5个子页面

### R06: 固定演示 ID：reviews→submission-1, students→demo, learn→spring-2
- **等级**：高
- **文件**：server.mjs
- **影响**：教师复核、学生列表、学习播放器

### R07: iframe 内 CSS 注入用 `!important` 覆盖通用类名，可能误杀子页面元素
- **等级**：高
- **文件**：student-integration.js, admin-integration.js

### R08: teacher-shell CSS 全局重置 `*{box-sizing:border-box}` + `html,body` 覆盖
- **等级**：高
- **文件**：teacher-shell.css

### R09: /student 路径未被 global-nav.js 排除，出现双导航
- **等级**：中
- **文件**：global-nav.js

### R10: 401 响应自动触发全局 clearSession，导致所有角色登出
- **等级**：中
- **文件**：api-client.js

### R11: student-nav 的 reFit 与页面 fit.js 缩放冲突，可能布局抖动
- **等级**：中
- **文件**：student-nav.js

### R12: 未匹配路由回退到 login 而非 404
- **等级**：中
- **文件**：server.mjs

### R13: admin-integration.js 路由匹配不精确（startsWith 误匹配）
- **等级**：中
- **文件**：admin-integration.js

### R14: teacher-shell 移动端 min-width:900px 强制横向滚动
- **等级**：中
- **文件**：teacher-shell.css

## 三、风险统计

| 等级 | 数量 |
|------|------|
| 高 | 8 |
| 中 | 6 |
| 低 | 0 |
