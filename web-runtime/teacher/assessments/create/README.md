# 语赞心声｜教师创建测评独立网页

此压缩包为独立静态网页，不写入原项目。

## 运行

直接双击 `index.html`。

浏览器如果限制剪贴板或本地资源，可在解压目录运行：

```bash
python -m http.server 8080
```

随后打开 `http://localhost:8080/`。

## 文件说明

- `index.html`：完整页面 DOM 和内联 SVG 图标
- `styles.css`：桌面、平板、手机响应式布局
- `app.js`：步骤切换、测评类型、能力维度、预检、草稿、发布等交互
- `assets/yuzan-logo-mark.png`：完全从用户提供的 Logo 中提取的左上角图案，未重新绘制
- `assets/sidebar-landscape.webp`：从用户提供的视觉母版中裁取
- `assets/paper-texture.webp`：由视觉母版派生的轻量纸张纹理
- `reference/`：原始参考设计与说明，仅供比对，不参与页面运行

## 初始视图

初始页面按参考图约 `1659 × 948` 的构图还原。所有按钮、输入框、步骤、校验区和文本均为可编辑 DOM，不是整页截图背景。
