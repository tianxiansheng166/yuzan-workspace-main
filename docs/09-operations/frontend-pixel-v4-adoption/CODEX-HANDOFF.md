# Codex 前端交接文档 — FRONTEND_PIXEL_V4_PREFLIGHT_001

## 1. 环境摘要

本 worktree 已为 Codex 准备好可直接开始高价值前端工作的环境：

- 基于 V3 checkpoint 创建 V4 分支，V3 成果已完整保存。
- V3/V4 源运行时均可运行，基线截图已全部生成。
- 正式 Nuxt 项目可 `build`、`typecheck`、`dev`。
- Playwright 浏览器环境可重复验证。
- 差异报告、复用决策、假功能清单已完成。

---

## 2. 仓库与分支

| 字段 | 值 |
|---|---|
| repo | `D:\program\test_program\yuzanxinsheng\three\yuzan-next` |
| worktree | `D:\program\test_program\yuzanxinsheng\three\worktrees\frontend-pixel-v4-runtime-adoption-001` |
| branch | `task/frontend-pixel-v4-runtime-adoption-001` |
| base full commit | `08c2743f2b72848271bcb4f3bd9a32fcc582b6e0` |
| remote synchronized | **是** — `origin/task/frontend-pixel-v4-runtime-adoption-001` 与本机 `HEAD` 一致 |
| git clean | 仅未跟踪的任务产出：`design-lab/frontend-pixel-v4-adoption/`、`docs/09-operations/frontend-pixel-v4-adoption/` |
| V3 checkpoint | `08c2743f2b72848271bcb4f3bd9a32fcc582b6e0`（`origin/task/frontend-pixel-v3-runtime-adoption-001` 一致） |
| V3 source status | 只读，未修改 |
| V4 source status | 只读，未修改 |

---

## 3. 工具链

| 字段 | 值 |
|---|---|
| Node | `v24.18.0`（必须通过 `fnm use 24` 切换，系统默认 Node v22 会导致 Nuxt 异常） |
| pnpm | `10.13.1`（已通过 corepack 激活） |
| Playwright | `1.60.0`（位于 `design-lab/frontend-pixel-v4-adoption/preflight/node_modules`） |
| Chromium | `Chrome for Testing 149.0.7827.55`（已安装到本地缓存） |
| Nuxt | `4.4.8`（`apps/web`） |

---

## 4. 命令速查

### 环境初始化

```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use 24
pnpm install --frozen-lockfile
```

### 正式项目运行

```powershell
# dev server
pnpm --filter @yuzan/web dev
# readiness probe (PowerShell)
(Invoke-WebRequest -Uri http://localhost:3000/ -UseBasicParsing -TimeoutSec 10).StatusCode
```

### 构建与检查

```powershell
pnpm -r build
pnpm -r typecheck
pnpm --filter @yuzan/web test
```

### 基线截图

```powershell
cd design-lab\frontend-pixel-v4-adoption\preflight
fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use 24
node scripts\capture-baseline.mjs
```

截图输出：

- `design-lab/frontend-pixel-v4-adoption/preflight/v3/`
- `design-lab/frontend-pixel-v4-adoption/preflight/v4/`
- `design-lab/frontend-pixel-v4-adoption/preflight/official-before/`
- 报告：`design-lab/frontend-pixel-v4-adoption/preflight/baseline-report.json`

---

## 5. 源运行时路径

| 源 | 路径 | 用途 |
|---|---|---|
| V3 source | `yuzan-next/source-materials/yuzan-pixel-v3-runtime` | 视觉验收参考 |
| V4 source | `yuzan-next/source-materials/yuzan-pixel-v4-runtime` | 交互与状态基准 |
| 正式项目 | `worktrees/frontend-pixel-v4-runtime-adoption-001/apps/web` | 迁移目标 |

**约束**：不得在源运行时目录内修改、删除、格式化、安装依赖或提交源码。

---

## 6. 页面与资产决策

### 6.1 页面决策总览

来源：`docs/09-operations/frontend-pixel-v4-adoption/V3-V4-PAGE-MAP.json`

| pageId | preferredSource | officialRoute |
|---|---|---|
| `home` | REPLACE_WITH_V4 | `/` |
| `login` | REPLACE_WITH_V4 | `/login` |
| `select-school` | REPLACE_WITH_V4 | `/select-school` |
| `teacher-studio` | MERGE_V3_VISUAL_V4_BEHAVIOR | `/teacher/courses/spring/studio` |
| `teacher-assignments` | REPLACE_WITH_V4 | `/teacher/assignments` |
| `teacher-review` | REPLACE_WITH_V4 | `/teacher/reviews/submission-1` |
| `student-today` | REPLACE_WITH_V4 | `/student/today` |
| `student-player` | REPLACE_WITH_V4 | `/student/learn/spring-2` |
| `student-growth` | REPLACE_WITH_V4 | `/student/growth` |
| `assessment-entry` | REPLACE_WITH_V4 | `/assessment` |
| `assessment-reading` | REPLACE_WITH_V4 | `/assessment/reading/2` |
| `assessment-written` | REPLACE_WITH_V4 | `/assessment/written` |
| `assessment-report` | REPLACE_WITH_V4 | `/assessment/report/demo` |
| `assessment-history` | REPLACE_WITH_V4 | `/assessment/history` |

### 6.2 必须复用的 V4 全局资产

| 文件 | 用途 |
|---|---|
| `assets/app-core.js` | 全局状态 `YuzanDemo`、localStorage、声明式绑定、toast、网络状态、按钮反馈 |
| `assets/recorder.js` | `VoiceRecorder` 真实录音/暂停/继续/完成/IndexedDB 缓存/同步状态 |
| `assets/audio-player.js` | `EvidencePlayer` 证据播放器 |
| `assets/fit.js` | 固定画布缩放（验收期使用，生产逐步替换） |
| `assets/common.css` | 全局样式变量与基础组件 |
| `assets/recorder.css` | 录音器样式 |
| `assets/audio-player.css` | 证据播放器样式 |

### 6.3 优先复用的 V3 视觉资产

`assets/brand-logo*.png`、`login-art-clean.jpg`、`select-art*.jpg`、`teacher-logo-*.png`、`studio-sidebar-art.jpg`、`assign-sidebar-art.jpg`、`today-*.jpg`、`player-mountains-desktop.png`、`growth-hero.jpg`、`assessment-entry-*.jpg`、`reading-mountains.png`、`written-mountains.png`、`report-hero.jpg`、`history-hero.jpg`、`home-bg.png`、`hero-scene-clean.jpg` 等。

详细清单见 `V4-REUSE-DECISION.md` 第 3 节。

### 6.4 应拒绝的资产

V3 中以下静态图片不得作为功能组件使用：

- `assets/player-recorder-desktop.jpg`
- `assets/player-recorder-mobile.jpg`
- `assets/reading-recorder.jpg`
- `assets/review-player.jpg`
- `assets/report-evidence.jpg`（作为播放器区域）

真实录音与播放器功能必须由 `recorder.js` / `audio-player.js` 实现。

---

## 7. 正式项目现有路由

当前 `apps/web` 已实现以下页面（基线截图已覆盖）：

| routeId | 路径 |
|---|---|
| `home` | `/` |
| `login` | `/login` |
| `student-today` | `/student/today` |
| `assessment` | `/assessment` |
| `assessment-reading` | `/assessment/reading` |
| `assessment-written` | `/assessment/written` |
| `assessment-report` | `/assessment/report/demo-report` |
| `assessment-history` | `/assessment/history` |
| `teacher-assignments` | `/teacher/assignments` |
| `teacher-review` | `/teacher/review/1` |
| `studio` | `/studio` |

这些页面目前是占位或基础实现，Codex 的任务是将 V4 的行为与视觉迁入。

---

## 8. 现有基础设施

### 8.1 认证

- V4 `login/login.js` 有表单校验和 localStorage 会话写入，但**鉴权是模拟的**（`setTimeout` 直接成功）。
- 必须接入正式项目的 session gateway，成功后写入 token/refreshToken。

### 8.2 学校与角色上下文

- V4 `select-school/select.js` 写入 `user.role` 和 `user.school`，但学校和角色列表是硬编码的。
- 必须接入后端学校、角色和班级权限数据。

### 8.3 后端状态网关

- `assets/app-core.js` 支持：
  - URL 查询参数水合：`state.xxx`。
  - `meta[name="yuzan-state-endpoint"]` 或 `data-state-endpoint` 自动拉取后端状态。
  - `deepMerge` 合并本地草稿与后端状态。
- 迁移时优先使用 `window.__YUZAN_BOOTSTRAP__` 和 API endpoint 水合。

### 8.4 离线/本地存储

- `recorder.js` 使用 IndexedDB 保存录音 Blob，localStorage 保存元数据。
- `today.js` 有资源缓存切换 UI，但未真实持久化。
- 生产环境需接入真实离线包/同步服务。

---

## 9. Codex 工作边界

### 9.1 必须实现的页面

所有 14 个 V4 页面均需按 `V3-V4-PAGE-MAP.json` 和 `V4-REUSE-DECISION.md` 迁入 `apps/web`：

1. `home`
2. `login`
3. `select-school`
4. `teacher/courses/[course]/studio`
5. `teacher/assignments`
6. `teacher/reviews/[submission]`
7. `student/today`
8. `student/learn/[lesson]`
9. `student/growth`
10. `assessment/index`
11. `assessment/reading/[step]`
12. `assessment/written`
13. `assessment/report/[id]`
14. `assessment/history`

### 9.2 不得触碰的路径

- `source-materials/yuzan-pixel-v3-runtime`
- `source-materials/yuzan-pixel-v4-runtime`
- `worktrees/frontend-pixel-v3-runtime-adoption-001`
- `infra/database/prisma/schema.prisma`
- `packages/contracts/`
- CI/CD 配置、根 `package.json`、pnpm workspace 配置（除非提交 Contract Change Request）
- 任何真实学生数据、secret、 licensed 素材

### 9.3 允许修改的路径

- `apps/web/app/pages/**`
- `apps/web/app/features/**`（建议创建 `app/features/yuzan-ui/`）
- `apps/web/app/composables/**`
- `apps/web/app/assets/css/**`
- `apps/web/public/art/**`
- `apps/web/app/components/**`
- 与上述页面相关的测试文件

---

## 10. 已知问题

| 问题 | 影响 | 处理方式 |
|---|---|---|
| `[Vue] Load plugin failed: vue-router/volar/sfc-route-blocks` | typecheck/build 日志中出现警告，但不阻塞构建 | 已知，可忽略；属于 Volar/vue-tsc 插件版本兼容性提示 |
| `TypeError: plugin is not a function` | 同上 | 同上 |
| V4 登录/同步/报告/评分等含演示实现 | 若直接复制到生产会伪造数据 | 必须按 `V4-FAKE-FUNCTIONS.md` 替换或移除 |
| `fit.js` 固定画布缩放 | 不适合最终响应式 | 验收期保留，后续逐步改为 Grid/Flex 响应式断点 |
| Windows 上 Nuxt dev server 监听 `localhost` | `127.0.0.1` 可能无法访问 | readiness probe 使用 `http://localhost:3000/` |

---

## 11. 已知 V4 假功能

完整清单见 `docs/09-operations/frontend-pixel-v4-adoption/V4-FAKE-FUNCTIONS.md`。

核心项：

1. 登录模拟鉴权（`REPLACE_WITH_STATE_BOUNDARY`）
2. 录音同步模拟（`REPLACE_WITH_STATE_BOUNDARY`）
3. 演示声场 fallback（`VISUAL_DEMO_ONLY`）
4. 无录音源播放器模拟（`VISUAL_DEMO_ONLY`）
5. 硬编码报告 fallback（`REPLACE_WITH_STATE_BOUNDARY`）
6. 硬编码书面练习题（`REPLACE_WITH_STATE_BOUNDARY`）
7. 硬编码学生列表与评分（`REPLACE_WITH_STATE_BOUNDARY`）
8. 硬编码历史图表数据（`REPLACE_WITH_STATE_BOUNDARY`）
9. 课程提交/任务创建/反馈发布/复测安排模拟（`REPLACE_WITH_STATE_BOUNDARY`）
10. `prompt` / `confirm` 原生弹窗（`REMOVE`）
11. 全局硬编码默认状态（`REPLACE_WITH_STATE_BOUNDARY`）

---

## 12. 验收命令

Codex 完成迁移后，至少运行以下命令验证：

```powershell
# 1. 切换 Node 24
fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use 24

# 2. 安装依赖
pnpm install --frozen-lockfile

# 3. 类型检查
pnpm -r typecheck

# 4. 构建
pnpm -r build

# 5. 前端测试
pnpm --filter @yuzan/web test

# 6. 浏览器基线截图
cd design-lab\frontend-pixel-v4-adoption\preflight
node scripts\capture-baseline.mjs
```

---

## 13. 环境门禁清单

| 门禁条件 | 状态 |
|---|---|
| V3 checkpoint 已远程保存 | 是 `08c2743...` |
| V4 分支基于 V3 checkpoint | 是 |
| worktree clean（仅任务产出未跟踪） | 是 |
| V3/V4 源运行时可运行 | 是 |
| 差异报告完成 | 是 `V3-V4-DELTA-REPORT.md`、`V3-V4-PAGE-MAP.json`、`V4-REUSE-DECISION.md` |
| 浏览器环境可重复 | 是，Playwright + Chromium 已就绪 |
| 正式 Nuxt build 可运行 | 是 |
| 图片和路由已定位 | 是，基线截图已生成 |
| protected paths 明确 | 是 |
| 没有要求 Codex 再做全量扫描 | 是 |

---

## 14. 下一步给 Codex

1. 按 `V3-V4-PAGE-MAP.json` 的 `preferredSource` 决策迁入页面。
2. 将 `app-core.js`、`recorder.js`、`audio-player.js`、`fit.js` 迁移为 Nuxt composable / plugin / 组件。
3. 按 `V4-FAKE-FUNCTIONS.md` 替换所有演示实现。
4. 保持 V3 视觉资产作为验收参考。
5. 每完成一个页面，运行 `pnpm -r typecheck` 与基线截图验证。
