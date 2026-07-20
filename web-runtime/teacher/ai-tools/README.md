# 语赞心声｜教师 AI 工具中心独立网页

这是一个独立静态网页压缩包，不写入原项目。

## 运行

直接打开 `index.html`。

需要本地服务器时，在解压目录执行：

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080/`。

## 内容

- `index.html`：可编辑 DOM 结构与 SVG 图标
- `styles.css`：桌面、平板、手机响应式布局
- `app.js`：路径生成、模式切换、邀请码复制、弹窗和提示交互
- `assets/yuzan-logo-mark.png`：从用户提供 Logo 中直接提取的图案，不包含图片文字
- `assets/top-mountain-panorama.webp`：用户提供的右上角山水图
- `assets/sidebar-landscape.webp`：从视觉母版裁取的侧栏山川
- `assets/paper-texture.webp`：由提供素材派生的纸张纹理
- `reference/`：参考设计和需求说明
- `qa/`：浏览器截图与校准说明

## 主要还原区域

- 左侧教师工具中心导航、邀请码与新手引导
- 顶部标题、隐私保护提示和右上角山水背景
- 备课目标、关联课程与生成路径操作
- 五阶段备课工作流：MindMate、思路、MindGraph、藏汉翻译、学习单
- 教学资源库
- 最近使用、草稿和外部服务状态

页面中的按钮、输入框、动态文字和状态均由 HTML/CSS/JS 实现，不使用整页截图作为网页背景。
