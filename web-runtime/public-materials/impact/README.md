# 项目成效与社会影响｜独立网页

这是根据参考图重建的独立 HTML/CSS/JS 页面，不写入现有项目。

## 运行

直接打开 `index.html`，或在目录内执行：

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080/`。

## 图片职责

- `header-mountains.png`：仅用于顶部右侧的浅色山脊装饰带，经过横向裁切、降饱和、提亮与渐隐处理。
- `sidebar-mountains.png`：由线稿山体提取为金色透明线条，只用于深藏蓝侧栏底部。
- `report-cover-*.webp`：作为报告封面缩略图，不承载动态数据。
- `evidence-watermark.webp`：作为证据区底部低透明装饰，不覆盖主要信息。
- `logo-mark.png`：只保留用户提供的红橙色图案，品牌文字由 HTML 渲染。

## 实现边界

导航、筛选器、指标、文件标签、案例、反馈、报告按钮和弹层均由 HTML/CSS/JS 重建。生产接入时应替换示例内容并使用真实数据。动态内容不应栅格化到图片中。
