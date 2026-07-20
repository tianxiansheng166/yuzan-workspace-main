# 语赞心声沉浸式登录入口 V2

这是一个无外部依赖、可直接打开运行的登录/注册前端页面。页面不是静态截图，核心界面、表单、身份选择、转场和动效均由 HTML/CSS/JavaScript 实现。

## 主要升级

- 全屏高原世界，而非左图右表单的普通后台布局
- 页面入场仪式、雪山/地形视差、云雾漂移、声波与路径流动
- 纸面入口卡、细边框与东方装饰角，不使用玻璃拟态模板
- 登录按钮承担“点亮学习路径”的品牌交互
- 注册身份使用四套定制线性 SVG 图标，不含 Emoji
- 登录/注册内容、左侧叙事与色彩状态联动
- 登录提交后执行完整的高原路径点亮转场
- 可选麦克风声场响应；拒绝权限时自动保留合成动效
- 响应式布局及 `prefers-reduced-motion` 支持

## 运行

直接打开 `index.html`，或在目录内启动本地静态服务器：

```bash
python -m http.server 8080
```

浏览器访问 `http://localhost:8080`。

## 接入真实接口

编辑 `app.js` 顶部：

```js
const AUTH_ENDPOINTS = {
  login: '/api/auth/login',
  register: '/api/auth/register'
};
```

接口成功时可返回：

```json
{ "redirect": "/student" }
```

未配置接口时，页面会完整演示转场，并明确提示这是视觉独立版本，不会伪造真实登录成功。

## 文件结构

```text
index.html
styles.css
app.js
README.md
assets/
  highland-world.webp
  paper-texture.webp
  yuzan-logo.png
  concept-login.webp
  concept-register.webp
```
