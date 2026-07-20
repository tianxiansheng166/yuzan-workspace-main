# 语赞心声｜教师测评任务列表独立网页

这是一个独立静态网页压缩包，没有写入原项目。

## 打开方式

直接双击 `index.html`。

如浏览器限制本地剪贴板，可以在解压目录运行：

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080/`。

## 文件结构

- `index.html`：页面 DOM、表格结构、SVG 图表和图标
- `styles.css`：桌面、平板、手机响应式布局
- `app.js`：搜索、筛选、折叠分组、导出、菜单和弹窗交互
- `assets/yuzan-logo-mark.png`：直接从用户提供 Logo 中提取的左上角图案，未重新绘制
- `assets/sidebar-mountain.webp`：用户提供背景图的侧栏裁切
- `assets/paper-texture.webp`：用户提供母版派生的浅纸张纹理
- `assets/sound-wave-layer.png`：用户提供的声波装饰层
- `reference/`：参考设计图和页面说明，仅用于比对

## 页面特点

- 动态文字、任务状态、筛选、表格、操作按钮全部使用真实 HTML/CSS/JS。
- 趋势图使用 SVG 重建，不是截图切片。
- 左上角 Logo 图案完全来源于用户提供文件，Logo 文字由网页 DOM 渲染。
