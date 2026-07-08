# Visual Review

- Task: GOV-004
- Page/asset: design token and primitive acceptance preview
- Reviewer: Codex Design AI
- Date: 2026-07-09
- Viewports: 1440 / 1024 / 390

## User task hierarchy

优先验证基础交互是否能服务后续学生端、教师端、教研端和管理端，而不是验证某一张业务页面是否“好看”。

## Composition and rhythm

- 组件层保持线性节奏和明确边界，不通过卡片套卡片制造层级。
- “学习路径与地形线”只落在焦点、边界、路径推进与节奏中。
- “语言与声波”只体现在动作与状态节拍，不体现在大面积背景。

## Typography

- 正文基线 16px 起步；
- 标题与正文分离字体栈；
- 输入、按钮、状态标签在 390 宽度下保持可读。

## Brand language

- 品牌酒红只承担动作与强调，不接管全部背景；
- contrast variant 只服务深色或品牌底，不建立完整 dark mode。

## States reviewed

- normal
- hover
- focus-visible
- active
- disabled
- loading
- error
- reduced motion
- contrast surface

## Anti-template checks

- [x] no card-in-card
- [x] no generic three-column wall
- [x] no emoji
- [x] no meaningless icons
- [x] no generic gradient/glass
- [x] image integrated into composition
- [x] mobile re-composed

说明：本任务未生成完整页面图像资产，因此“image integrated into composition”在这里指状态板与组件节奏统一，而非首页插画合成。

## Accessibility

- `YxButton` 使用原生 `<button>`，支持 `type`、`disabled`、`aria-busy`；
- `YxLink` 使用原生 `<a>`，下划线常驻，不把链接伪装成按钮；
- `YxInput` 具备 `label` 关联、`aria-invalid`、`aria-describedby`、`role="alert"`；
- 全局 `:focus-visible` 在浅底与深底都可见；
- reduced motion 通过 token 时长降级与全局 transition/animation 降速生效；
- 颜色组合按正文/动作/状态做了 AA 导向设计，焦点和边界可辨。

## Performance/asset size

- 无新增运行时依赖；
- 预览图板仅为本地评审证据，不进入生产路由。

## Cultural/rights review

- 未引入外部图标库、emoji 或版权不明图片；
- 视觉母题仅用抽象节奏规则表达，不涉及文化图腾误用。

## Evidence

- 本地预览说明：[GOV-004-preview.html](/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-004/design-lab/reviews/GOV-004-preview.html)
- 1440 图板：[GOV-004-concept-board-1440.png](/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-004/design-lab/reviews/GOV-004-concept-board-1440.png)
- 1024 图板：[GOV-004-concept-board-1024.png](/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-004/design-lab/reviews/GOV-004-concept-board-1024.png)
- 390 图板：[GOV-004-concept-board-390.png](/home/admin01/Documents/yuzan-workspace-main/worktrees/gov-004/design-lab/reviews/GOV-004-concept-board-390.png)

说明：

- Firefox headless 在当前环境中可启动但截图渲染挂起，因此未取得真实浏览器 PNG；
- 为保证交接有视觉证据，改为基于同一套 token 与组件规范导出 concept board PNG；
- 这些图板不是生产页面截图，也不是键盘、响应式或可访问性“实际通过”的浏览器证据；
- `GOV-004-preview.html` 复用了 `tokens.css` 与 `base.css`，但组件区块仍是静态等价标记，后续仍需在真实组件运行环境中补浏览器终验。

## Decision

CHANGES

需要后续在真实组件运行环境中补一次浏览器级键盘操作与对比度终验，但本任务的 token、原语 API、状态矩阵与轻量验收预览已经具备交接条件。
