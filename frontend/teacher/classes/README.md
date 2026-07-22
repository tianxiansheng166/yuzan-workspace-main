# 语赞心声｜教师班级列表独立网页

这是一个独立静态网页压缩包，不会写入原项目。

## 运行方式

解压后直接打开 `index.html`。

浏览器若限制本地资源，可在解压目录运行：

```bash
python -m http.server 8080
```

随后访问 `http://localhost:8080/`。

## 文件

- `index.html`：完整 DOM 结构和内联 SVG 图标
- `styles.css`：桌面、平板、手机响应式布局
- `app.js`：地图 / 列表切换、年级筛选、班级选择、弹窗等交互
- `assets/yuzan-logo-mark.png`：从用户提供 Logo 中提取的左上角图案，未重新绘制
- `assets/class-valley-background.webp`：用户提供的班级山谷背景图
- `assets/sidebar-landscape.webp`：从背景图派生的侧栏山川装饰
- `assets/paper-texture.webp`：从背景图派生的轻量纸张纹理
- `reference/`：参考截图和页面说明，仅用于比对，不参与运行

## 还原内容

- 教师端固定侧栏、顶部学校与学期选择
- 我的班级标题区、创建班级、导入学生和视图切换
- 班级学习路径指南
- 班级山谷背景、路径、五张班级卡片和创建入口
- 教学日历、今日安排、待处理事项和快捷操作
- 桌面、平板和移动端响应式收束
