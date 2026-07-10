# 实现架构

## 1. 推荐目录

```text
packages/ui/src/
  tokens.css
  base.css
  components/

apps/web/app/
  layouts/
  components/
    navigation/
    shell/
    visual/
  features/
    brand/
    teacher/
    student/
    assessment/
    reports/
  assets/
  pages/

apps/web/public/art/
design-lab/
  asset-briefs/
  generated/
  reviews/
```

## 2. Token 分层

```text
primitive
→ semantic
→ component
→ page
```

禁止页面直接散落大量 HEX。

允许页面级少量局部变量，但必须引用 semantic token。

## 3. 组件策略

基础组件：

- Button；
- Link；
- Input；
- Select；
- Textarea；
- Status；
- Notice；
- Tabs；
- Dialog；
- Drawer；
- DataList；
- Table；
- EmptyState；
- ProgressPath；
- AudioWaveform；
- PageHeader；
- AppShell。

视觉组件：

- ContourField；
- LearningPath；
- MissionBand；
- SoundTrace；
- PlateauDivider。

视觉组件只能负责图形，不持有业务数据。

## 4. 避免冲突

视觉开发阶段：

- 不修改后端；
- 不修改 OpenAPI；
- 不改变 API payload；
- 不重写业务状态机；
- 不绕过权限；
- 不添加 fake success；
- 页面尚未接线时显示真实 unavailable 或 demo 标识；
- 视觉和 API 接线并行时，以 feature 边界拆分文件。

## 5. SSR 与 Hydration

- 不在渲染期间读取浏览器专属 API；
- 动画初始化在 mounted 后；
- 静态首屏必须完整；
- 不依赖 JS 才显示主内容；
- `prefers-reduced-motion` 服务端采用静态默认；
- 动态尺寸避免导致 CLS。

## 6. 资源

- 所有视觉资产本地化；
- 文件名使用语义；
- 记录来源和用途；
- 不使用外链背景；
- 不提交未授权人物照片；
- SVG 应可读、可优化；
- 大图使用 WebP/AVIF 和响应式尺寸；
- 资源失败时不影响操作。
