# 语赞心声整合首页

- `index.html`：整合首页入口
- `assets/hero-bg.png`：首页主视觉背景
- `sections/`：用户提供的五个已开发页面，已通过嵌入样式移除重复导航
- 直接以 HTTP 静态服务器打开，避免浏览器阻止 iframe 本地资源。

推荐运行：

```bash
python -m http.server 8080
```

打开 `http://localhost:8080`。
