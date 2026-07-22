# 语赞心声｜教师班级详情与学情地图

独立静态网页，未写入任何现有项目。解压后直接打开 `index.html` 即可查看。

## 文件结构

- `index.html`：页面结构、SVG 图标与可访问语义
- `styles.css`：桌面、平板、手机布局
- `app.js`：日期范围、问题切换、阶段选择、侧栏操作与导出交互
- `assets/class-growth-map.png`：用户提供的班级成长路径背景
- `assets/yuzan-logo-mark.png`：只保留用户 Logo 中的图案部分，品牌文字由 HTML 渲染
- `assets/course-cover.webp`：由用户提供的视觉母版裁切
- `assets/sidebar-terrain.webp`：侧栏山川装饰
- `reference/teacher-class-detail-reference.png`：原始页面参考图，仅用于视觉校准

## 本地启动

直接双击 `index.html`，或在目录中运行：

```bash
python -m http.server 8080
```

浏览器访问 `http://127.0.0.1:8080/`。

## 已实现交互

- 日期范围选择
- 导出报表与班级设置侧栏
- 课程详情
- 成长路径阶段选择
- 发音问题 / 书写问题切换
- 教师行动入口
- 班级学情报告入口
