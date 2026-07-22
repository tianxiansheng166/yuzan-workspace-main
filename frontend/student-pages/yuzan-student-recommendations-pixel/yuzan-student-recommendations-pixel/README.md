# 语赞心声｜学生端推荐页

独立静态前端实现，不写入现有项目。页面布局、导航、按钮、路径、课程卡、雷达图、进度与弹窗均由 HTML/CSS/SVG/JavaScript 构建；提供的插画仅作为独立背景、头像和课程封面素材使用。

## 运行

直接打开 `index.html`，或在目录中启动静态服务器：

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080`。

## 设计基准

- 桌面校准视口：1659 × 948
- 主要断点：1120px、820px
- 390px 下转为纵向学习路径并保留单一主要行动
- 支持 `prefers-reduced-motion`
