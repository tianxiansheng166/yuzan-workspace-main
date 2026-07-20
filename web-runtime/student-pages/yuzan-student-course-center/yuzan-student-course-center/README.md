# 语赞心声｜学生课程中心静态高保真还原

直接打开 `index.html` 即可预览。建议通过本地 HTTP 服务运行：

```bash
python -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

## 页面实现

- 导航、筛选、课程卡片、进度、路径节点、教师建议、离线管理均为真实 HTML/CSS/SVG/JavaScript。
- Logo 仅提取用户提供的品牌图案，不使用原图中的文字位图。
- 用户提供的插画仅作为独立背景、课程封面和装饰层；未把整张参考页面作为网页背景。
- 包含桌面、平板和手机响应式布局，以及 `prefers-reduced-motion` 支持。
- 演示交互：导航切换、课程分类筛选、筛选下拉、薄弱点高亮、课程弹窗、离线内容与教师建议。

## Playwright 校准

运行：

```bash
bash qa/run-qa.sh
```

输出位于 `qa/current.png`、`qa/diff.png` 和 `qa/report.json`。
