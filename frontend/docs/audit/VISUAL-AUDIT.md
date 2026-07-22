# 视觉审计报告

> 审计日期：2026-07-18
> 扫描范围：frontend 下所有 HTML/CSS 文件（排除 node_modules）
> 审计方法：静态扫描 + 已知问题交叉验证

---

## 一、视觉问题总览

| 严重度 | 数量 |
|--------|------|
| 🔴 严重 | 9 |
| 🟡 中等 | 12 |
| 🟢 轻微 | 8 |

---

## 二、按页面分组

### 首页 (index.html + styles.css)

| # | 严重度 | 问题 | 位置 | 影响 |
|---|--------|------|------|------|
| 1 | 🔴 严重 | 首页使用嵌套 iframe 滚动，而非自然鼠标垂直滚动 | index.html L94-106，5 个 iframe 嵌入 sections | 用户无法流畅滚动浏览，iframe 内外滚动冲突，移动端体验极差 |
| 2 | 🔴 严重 | iframe 高度硬编码为 941px，响应式仅通过 @media 调整固定值（760px/920px/1020px） | styles.css L20，L23-25 | iframe 内容溢出或留白，无法自适应实际内容高度 |
| 3 | 🟡 中等 | 首页导航栏使用 `z-index:100`，与 global-nav.js 注入的浮动按钮 `z-index:999` 和面板 `z-index:999` 无冲突但层级差异大 | styles.css L11，global-nav.js L41 | 后续如新增浮层需小心层级 |
| 4 | 🟡 中等 | 大量硬编码 px 值：header 112px、品牌图 57px、hero 830px、学习路径 265px 等 | styles.css L4-22 | 无法随用户字体设置缩放，可访问性差 |
| 5 | 🟡 中等 | `.hero-copy` 宽度固定 `width:670px` | styles.css L16 | 中等屏幕下文字区可能溢出或遮挡 |
| 6 | 🟢 轻微 | 首页 `.statement-band` 使用 `min-height:620px`，图片遮罩 `mask-image` 兼容性有限 | styles.css L19 | 部分浏览器图片渐变遮罩不生效 |

### 教师端 (teacher.html + teacher.css + teacher-shell.css)

| # | 严重度 | 问题 | 位置 | 影响 |
|---|--------|------|------|------|
| 7 | 🔴 严重 | 教师端有独立侧边栏导航（z-index:20/30），但 teacher-shell.css 也注入了 `.ts-app-shell` 侧边栏（z-index:30），两套导航并存 | teacher.css L33, teacher-shell.css L16 | 侧边栏可能重叠，内容偏移 |
| 8 | 🟡 中等 | teacher-shell.css 中 `body{overflow-x:auto;overflow-y:auto}` 允许水平滚动 | teacher-shell.css L10 | 设计稿缩放时出现水平滚动条 |
| 9 | 🟡 中等 | 教师端最小宽度 900px，窄屏通过 translateX 隐藏侧边栏 | teacher-shell.css L14-15 | 760px 以下侧边栏变为抽屉，但主体仍 900px 最小宽度 |
| 10 | 🟢 轻微 | 字体大小不统一：brand 16px vs 17px，nav-item 14px vs 15px | teacher.css vs teacher-shell.css | 视觉不一致 |

### 学生端 (student-integration.html + student-nav.css)

| # | 严重度 | 问题 | 位置 | 影响 |
|---|--------|------|------|------|
| 11 | 🔴 严重 | 学生端使用 iframe 嵌入（高度 760px），student-nav.css 又注入了独立的顶部导航+侧边栏 | student-integration.html, student-nav.css | 双重导航叠加，iframe 内容被遮挡 |
| 12 | 🟡 中等 | student-nav.css `body.student-has-nav{overflow-x:auto;overflow-y:auto}` + `.viewport{overflow-x:auto!important}` | student-nav.css L255-256 | 水平滚动条出现 |
| 13 | 🟡 中等 | 学生端最小宽度 900px（`min-width:900px`），移动端无法正常显示 | student-nav.css L260, L294 | 移动端被强制横向滚动 |
| 14 | 🟢 轻微 | 学生导航品牌色 `#c82722` vs 首页红色 `var(--red)` `#c9362a`，色值差异 | student-nav.css L40 vs styles.css | 品牌色不统一 |

### 管理端 (admin-integration.html + admin-nav.css + admin.css)

| # | 严重度 | 问题 | 位置 | 影响 |
|---|--------|------|------|------|
| 15 | 🔴 严重 | 管理端使用 iframe 嵌入（高度 760px），admin-nav.css 注入顶部栏 z-index:2000 + 侧边栏 z-index:1900 | admin-integration.html, admin-nav.css L14, L30 | iframe 内页面顶部内容被导航栏遮挡（padding-top 依赖 JS 计算） |
| 16 | 🟡 中等 | admin-nav.css 在 900px 以下设置 `.admin-content-frame{min-width:1080px}`，强制水平滚动 | admin-nav.css L73 | 窄屏水平滚动条 |
| 17 | 🟡 中等 | Toast 位置不一致：admin.css `top:82px;right:20px;z-index:2100`，teacher.css `right:20px;bottom:20px;z-index:90`，volunteer.css `right:20px;bottom:20px;z-index:90` | 各端 CSS | 管理端 toast 在顶部，其他端在底部 |
| 18 | 🟢 轻微 | 管理端品牌色 `#c9362a`，教师端 `#d7070f`，学生端 `#c91518`，红色色值不一致 | 各导航 CSS | 品牌红色存在约 30 个色阶差异 |

### 测评端 (assessment/)

| # | 严重度 | 问题 | 位置 | 影响 |
|---|--------|------|------|------|
| 19 | 🔴 严重 | 测评入口 header 宽度硬编码 `width:1672px`，无任何 @media 响应式断点 | assessment/style.css L1 | 窄屏下测评页横向溢出，必须横向滚动 |
| 20 | 🟡 中等 | 测评子页面（reading/written/report/history）CSS 无 @media 断点 | 各子目录 style.css | 小屏幕无法适配 |
| 21 | 🟡 中等 | 测评报告使用 `localStorage.getItem('yuzan-demo-report')` 作数据源 | report.js L5 | 报告数据为演示缓存，非真实后端数据 |

### 志愿者端 (volunteer.html + volunteer.css)

| # | 严重度 | 问题 | 位置 | 影响 |
|---|--------|------|------|------|
| 22 | 🟡 中等 | 志愿者端 900px 以下设置 `min-width:900px`，强制水平滚动 | volunteer.css L17 | 窄屏体验差 |
| 23 | 🟢 轻微 | 志愿者端子页面 hero 区域用 `!important` 覆盖样式 | volunteer.css L42 | 维护困难 |

### 登录页 (login/)

| # | 严重度 | 问题 | 位置 | 影响 |
|---|--------|------|------|------|
| 24 | 🟡 中等 | 登录页装饰图硬编码 `width:1086px;height:941px`，无 @media 断点 | login/style.css L1, L3 | 小屏幕装饰图溢出 |
| 25 | 🟢 轻微 | 表单宽度固定 `width:428px` | login/style.css L8 | 极窄屏幕表单溢出 |

### 选校页 (select-school/)

| # | 严重度 | 问题 | 位置 | 影响 |
|---|--------|------|------|------|
| 26 | 🟡 中等 | 选校页无 @media 断点，header 高度 111px 硬编码 | select-school/style.css L1 | 移动端不适配 |

### 公共材质页 (public-materials/)

| # | 严重度 | 问题 | 位置 | 影响 |
|---|--------|------|------|------|
| 27 | 🟢 轻微 | 各公共页面 CSS 中使用 `overflow-x:auto` | 多个 styles.css | 水平滚动条可能意外出现 |

---

## 三、全局问题

### 3.1 导航栏设计不统一

| 端 | 品牌色 | 高度 | 侧边栏 | z-index 范围 | 文件 |
|----|--------|------|--------|-------------|------|
| 首页 | `--red:#c9362a` | 112px | 无 | 100 | styles.css |
| 教师端 | `--ts-red:#d7070f` | 69px | 有(190px) | 30-35 | teacher-shell.css |
| 学生端 | `--student-red:#c91518` | 90px | 有(210px) | 999-1000 | student-nav.css |
| 管理端 | `--admin-red:#c9362a` | 68px | 有(224px) | 1900-2000 | admin-nav.css |
| 志愿者端 | `--red:#c9362a` | 101px | 有(260px) | 20-25 | volunteer.css |
| 全局浮动 | — | — | 无 | 999 | global-nav.js |

**问题**：
- 各端品牌红色不一致（#c9362a / #d7070f / #c91518），视觉上可察觉差异
- 高度从 68px 到 112px 不等，切换端时导航栏高度跳动
- z-index 从 20 到 2000 跨越 3 个数量级，无统一规范
- 教师端和学生端存在"独立导航 + shell 注入导航"双重叠加

### 3.2 iframe 嵌套滚动

受影响页面：
1. **首页** — 5 个 section 通过 iframe 嵌入，每个固定高度，滚动冲突
2. **管理端** — admin-integration.html 通过 iframe 加载子页面
3. **学生端** — student-integration.html 通过 iframe 加载子页面

核心问题：iframe 内外滚动事件隔离，用户无法自然垂直滚动穿越 iframe 边界。首页尤其严重——5 个连续 iframe 构成"滚动陷阱"。

### 3.3 页面顶部被导航栏遮挡

所有使用 `position:sticky;top:0` 或 `position:fixed` 导航栏的页面，其下方内容缺少足够的 `padding-top` 或 `scroll-margin-top`：
- 首页：`--header-h:112px`，但 hero 区使用 `padding-top:74px`
- 教师端：topbar 69px，内容通过 grid 布局偏移
- 学生端：topbar 90px，通过 padding-left 偏移
- 管理端：topbar 68px，通过 `padding-top:var(--admin-header)` 偏移，但 iframe 内子页面可能重复

### 3.4 overflow 水平滚动

以下页面/组件存在 `overflow-x:auto` 或强制 `min-width` 导致的水平滚动条：
- `volunteer.css` — `.vol-shell{min-width:900px}`
- `student-nav.css` — `.student-has-nav{min-width:900px}`
- `teacher-shell.css` — `.ts-app-shell{min-width:900px}`
- `admin-nav.css` — `.admin-content-frame{min-width:1080px}`
- `assessment/style.css` — header `width:1672px`
- `login/style.css` — art `width:1086px`

### 3.5 硬编码像素值统计

主要 CSS 文件中 px 使用情况（关键尺寸）：

| 文件 | 硬编码 px 数量 | 最典型问题值 |
|------|---------------|-------------|
| styles.css | 50+ | 112px, 57px, 830px, 670px, 941px |
| teacher.css | 80+ | 190px sidebar, 69px topbar |
| volunteer.css | 60+ | 260px sidebar, 101px header |
| tools.css | 40+ | 224px sidebar |
| research.css | 50+ | 250px sidebar |
| plans.css | 30+ | 68px header |
| assessment/style.css | 10+ | 1672px 宽度 |
| login/style.css | 15+ | 1086px 宽度 |

绝大多数尺寸使用 px 而非 rem/em/vw，无法随用户浏览器字体设置缩放。

---

## 四、修复优先级建议

### P0 — 立即修复（影响核心可用性）

1. **首页 iframe → 直接渲染**：将 5 个 section iframe 替换为直接 HTML 引入或构建时内联，消除滚动冲突
2. **测评入口固定宽度**：`width:1672px` 改为 `max-width:100%` + 响应式布局
3. **双重导航叠加**：教师端和学生端移除独立导航，统一使用 shell 注入导航

### P1 — 本迭代修复（影响用户体验）

4. **iframe 高度自适应**：管理端/学生端 iframe 改用 ResizeObserver 或 postMessage 动态计算高度
5. **统一品牌红色**：定义 `--yuzan-red` 全局变量，所有端统一引用
6. **统一导航高度**：桌面端统一 72px，移动端统一 56px
7. **z-index 层级规范**：建立层级表（nav:100, modal:500, toast:900, global:999）并统一
8. **toast 位置统一**：全部改为右下角或统一全局位置

### P2 — 下一迭代修复

9. **响应式断点补全**：为 assessment/login/select-school 补充 @media 断点
10. **px → rem 迁移**：核心尺寸（header/sidebar/padding）迁移为 rem
11. **最小宽度移除**：改用 CSS Grid `minmax()` 替代硬编码 `min-width:900px`
12. **scroll-margin-top**：为所有锚点目标添加 `scroll-margin-top` 等于导航高度

### P3 — 长期优化

13. **全局 CSS 变量体系**：建立 design token 系统（颜色/间距/字号/圆角）
14. **减少 !important**：volunteer.css 等文件中的 !important 通过提高选择器优先级消除
15. **登录页装饰图响应式**：改用 `background-size:cover` + `clamp()`
