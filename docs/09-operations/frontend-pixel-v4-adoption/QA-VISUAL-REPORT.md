# QA 视觉回归报告 — FRONTEND_PIXEL_V4_TRAE_QA_001

## 截图说明

- 基线：Preflight 已生成 V3/V4/official-before 截图，见 `design-lab/frontend-pixel-v4-adoption/preflight/baseline-report.json`。
- 本轮：在 QA worktree 中分别基于 Codex 原始提交与修复后提交生成两组截图。
  - Round 1：`design-lab/frontend-pixel-v4-adoption/qa/round-1/`
  - Round 2：`design-lab/frontend-pixel-v4-adoption/qa/round-2/`
- 视口：390×844、768×1024、1440×900。
- 截图方式：Playwright viewport 截图（非整页滚动截图）。

## 截图路由

| routeId | 实际路径 | round-1 HTTP | round-2 HTTP |
|---|---|---|---|
| login | `/login` | 200 | 200 |
| student-today | `/student/today` | 200 | 200 |
| assessment-entry | `/assessment` | 200 | 200 |
| assessment-reading | `/assessment/reading` | 200 | 200 |
| assessment-written | `/assessment/written` | 200 | 200 |
| assessment-report | `/assessment/report/demo-report` | 200 | 200 |
| assessment-history | `/assessment/history` | 200 | 200 |
| teacher-review | `/teacher/review/1?scenario=default` | 200 | 200 |
| teacher-assignments | `/teacher/assignments` | 200 | 200 |
| studio | `/studio` | 200 | 200 |

说明：`/select-school` 在正式 Nuxt 路由中不存在（404），未纳入截图范围。

## 横向溢出检查

对 Round 2 所有 30 张截图对应的页面执行 `document.documentElement.scrollWidth > clientWidth + 1` 检查，结果：

- 横向溢出：0/30

## 视觉差异

### Round 1 → Round 2 的修复内容

QA 在 Round 1 后修复了两处组件 import 缺失：

1. `AppShell.vue` 增加 `RoleNavigation` import。
2. `LoginPanel.vue` 增加 `YxButton`、`YxInput`、`YxStatus` import。

### 观察结果

- 两组截图在**可见区域**基本一致。原因是 Vue 在 hydration mismatch 发生后会回退到客户端重新渲染，最终 DOM 与修复后相同。
- 真正的差异体现在 SSR 阶段：Round 1 的 SSR HTML 中，桌面导航栏与登录面板组件位置为注释节点；Round 2 的 SSR HTML 与客户端完全一致。
- SSR DOM 对比证据见 `design-lab/frontend-pixel-v4-adoption/qa/logs/ssr-dom-compare-1783763440361.json`（Round 1，match=false）与 `ssr-dom-compare-1783763158968.json`（Round 2，match=true）。

## 已知视觉/产品问题

以下问题属于产品 backlog，不在本次 QA 机械修复范围内：

- 多数页面仍为静态占位，需接入后端数据（见 `QA-IMPLEMENTATION-COVERAGE.md`）。
- `/select-school` 页面缺失。
- 录音、播放器、成长报告等页面的真实业务状态尚未接入。

## 结论

- 30 张 Round 2 截图全部生成成功，HTTP 200，无横向溢出。
- Hydration 修复未引入新的视觉回归。
- 当前状态满足 QA 视觉回归通过标准。
