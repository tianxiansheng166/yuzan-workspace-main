# 包内验证记录

生成阶段已执行：

- 41 个任务 JSON 与 `task-board.csv` 一致性检查；
- 所有 JSON 文件语法解析；
- OpenAPI YAML 基础解析（3.1.0，17 个 path）；
- legacy 运行时引用静态检查；
- 简单 emoji/运行时 DOM 修补静态检查；
- 旧项目压缩包 SHA-256 记录；
- 文件清单和校验和生成（见 `manifests/`）。

未在当前环境执行：

- `pnpm install`；
- Nuxt/Nest/Prisma 的真实编译；
- PostgreSQL migration；
- Docker Compose；
- Playwright 浏览器测试；
- 真实语音供应商或模型测试。

原因：交付包是工程基线，依赖安装和运行必须在你的实际开发机由 `GOV-001` 验证。任何 AI 不得把本文件误读为“产品已运行或生产就绪”。
