# Hydration Mismatch 调查报告 — FRONTEND_PIXEL_V4_TRAE_QA_001

## 调查环境

- QA worktree：`D:\program\test_program\yuzanxinsheng\three\worktrees\frontend-pixel-v4-runtime-qa-001`
- Codex 基线提交：`12c31733bf1692604325f4eee3ff6ed518b1ab53`
- Node：`v24.18.0`
- pnpm：`10.13.1`
- 浏览器：Playwright Chromium

测试分别在 Nuxt dev (`pnpm --filter @yuzan/web dev`) 与 production build preview (`pnpm --filter @yuzan/web preview`) 下进行。

## 原始问题

启动 QA 后，在以下页面稳定复现 `Hydration completed but contains mismatches`：

- `/login`
- `/assessment/report/missing`
- `/teacher/review/1?scenario=default`

Vue 警告分为两种：

1. `AppShell > RoleNavigation` 节点不匹配
2. `LoginPanel > YxStatus / YxInput / YxButton` 节点不匹配

## 根因分析

### 1. AppShell 缺失 `RoleNavigation` 组件 import

**表现**

```text
[Vue warn]: Hydration node mismatch:
- rendered on server: JSHandle@node
- expected on client: RoleNavigation
  at <AppShell>
```

SSR DOM 片段对比（来自 `ssr-dom-compare-1783763440361.json`）：

```html
<!-- server -->
<div class="yx-shell app-shell__navigation app-shell__navigation--desktop" data-v-2371682a=""><!----></div>

<!-- client -->
<div class="yx-shell app-shell__navigation app-shell__navigation--desktop" data-v-2371682a="">
  <rolenavigation data-v-2371682a="" current-path="/login"></rolenavigation>
</div>
```

**根因**

`AppShell.vue` 模板中使用了 `<RoleNavigation>`，但 `<script setup>` 中没有 import。Nuxt dev SSR 在缺少显式 import 时无法解析组件，渲染为空注释节点；客户端 Vue 解析成功，导致节点数量不一致。

**修复**

在 `apps/web/app/components/app-shell/AppShell.vue` 中增加：

```ts
import RoleNavigation from "./RoleNavigation.vue";
```

### 2. LoginPanel 缺失 `@yuzan/ui` 组件 import

**表现**

```text
[Vue warn]: Hydration node mismatch:
- rendered on server: JSHandle@node
- expected on client: YxStatus
  at <LoginPanel status="loading" service-mode="demo" ...>
```

同页面还出现 `YxInput`、`YxButton` 的类似警告。

**根因**

`LoginPanel.vue` 模板中使用了 `<YxStatus>`、`<YxInput>`、`<YxButton>`，但未从 `@yuzan/ui` 导入。SSR 无法解析这些组件，渲染为注释节点；客户端正常渲染，触发 mismatch。

**修复**

在 `apps/web/app/features/auth/components/LoginPanel.vue` 中增加：

```ts
import { YxButton, YxInput, YxStatus } from "@yuzan/ui";
```

## 验证结果

### Dev 环境

运行 `capture-hydration-log.cjs` 与 `capture-routes-hydration.cjs` 后，所有测试路由 hydration mismatch 为 0。

### Production preview 环境

运行 `compare-ssr-dom.cjs`（比较 `.app-shell__navigation--desktop` 的 SSR 与客户端 DOM）结果：

| route | match |
|---|---|
| `/login` | true |
| `/assessment/report/missing` | true |
| `/teacher/review/1?scenario=default` | true |

运行 `capture-routes-hydration.cjs` 15 条候选路由结果：

- hydration issues：0/15
- HTTP/errors：1/15（`/select-school` 返回 404，属于页面缺失，非 hydration 问题）
- horizontal overflow：0/15

## 重点排查项确认

针对任务要求的 hydration 风险点，逐一确认如下：

| 风险点 | 是否发现 | 说明 |
|---|---|---|
| `Date.now()` / `new Date()` 模板初始渲染 | 否 | 未在模板中直接使用 |
| `Math.random()` / 随机 ID | 否 | 未使用 |
| `window` / `document` / `navigator` / `localStorage` / `sessionStorage` / `indexedDB` SSR 读取 | 否 | 受影响的组件均 SSR 安全 |
| `matchMedia` / `online` / `devicePixelRatio` | 否 | 未在初始渲染使用 |
| 麦克风能力探测 | 否 | 仅在客户端事件中探测 |
| 音频 duration/currentTime | 否 | `EvidenceAudioPlayer` 初始 `duration = 0`，SSR 不读取 `Audio` |
| 客户端生成 SVG path | 否 | AppShell Logo SVG 为静态 path |
| 不稳定对象迭代顺序 | 否 | `roleNavigationGroups` 为静态数组 |
| SSR fixture / 客户端 store 差异 | 否 | `useReviewDetail` 在 SSR 与客户端使用相同 fixture |
| 服务端默认 unavailable / 客户端 ready | 否 | 登录与播放器均保持一致的 unavailable 初始状态 |
| `<ClientOnly>` fallback 不一致 | 否 | 未使用整页 `<ClientOnly>` 包裹 |
| invalid HTML nesting | 否 | 未发现 button/button、link/link 嵌套 |
| class/style SSR/客户端不一致 | 否 | 修复 import 后一致 |
| Teleport/modal 初始状态 | 否 | 未使用 |
| 自动生成 aria id | 否 | `YxInput` 使用 Vue `useId()`，SSR/客户端一致 |

## 结论

所有 hydration mismatch 均由**组件 import 缺失**这一机械问题导致，已在 QA 分支内修复。未发现需要重写状态机、报告架构或整页 client-only 的复杂根因，因此**不**需要提交 `CODEX_COMPLEX_HYDRATION_FIX_REQUIRED`。
