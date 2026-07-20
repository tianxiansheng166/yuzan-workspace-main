# QA 说明

- 已完成静态检查：HTML 可解析，JavaScript 语法通过，资产已打包。
- 已附带 `render_qa.py`，可在本地具备 Chromium / Playwright 环境时生成桌面、平板、移动端截图与差异图。
- 本次容器环境中由于浏览器策略限制，未能直接完成 Playwright 截图，因此没有伪造截图产物。
