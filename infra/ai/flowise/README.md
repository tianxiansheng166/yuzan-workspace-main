# Flowise Local Runtime — 语赞心声 AI 备课工作流

## 版本信息

- **Flowise 镜像**: `flowiseai/flowise:3.0.12`
- **许可证**: Apache-2.0 (Community Edition)
- **不使用**: `packages/server/src/enterprise` 或其他商业许可模块

## 快速开始

```powershell
# 1. 创建配置
cp .env.example .env
# 编辑 .env，设置 FLOWISE_PASSWORD

# 2. 配置 AI Provider
cp ../../runtime-local/secrets/ai-provider.env.example ../../runtime-local/secrets/ai-provider.env
# 编辑 ai-provider.env，填入真实 AI_BASE_URL / AI_API_KEY / AI_MODEL

# 3. 启动
.\scripts\start.ps1

# 4. 检查状态
.\scripts\status.ps1
.\scripts\health-check.ps1

# 5. 导入工作流（Commit 2 之后可用）
.\scripts\bootstrap-flow.ps1

# 6. 停止
.\scripts\stop.ps1
```

## 访问地址

| 服务 | 地址 |
|------|------|
| Flowise UI | http://127.0.0.1:4300 |
| Flowise Ping | http://127.0.0.1:4300/api/v1/ping |
| Prediction API | `POST http://127.0.0.1:4300/api/v1/prediction/:flowId` |

## 目录结构

```
infra/ai/flowise/
├── README.md              ← 本文件
├── docker-compose.yml     ← Flowise Docker 服务定义
├── .env.example           ← 环境变量模板
├── flows/                 ← 版本化工作流 JSON
│   └── lesson-planner-v0.json  (Commit 2 创建)
├── schemas/               ← 输出 JSON Schema
│   └── lesson-plan-output.schema.json  (Commit 2 创建)
└── scripts/
    ├── start.ps1          ← 启动 Flowise
    ├── stop.ps1           ← 停止 Flowise
    ├── status.ps1         ← 查看容器状态
    ├── bootstrap-flow.ps1 ← 创建/更新工作流
    ├── export-flow.ps1    ← 导出工作流到 JSON
    └── health-check.ps1   ← 健康检查

runtime-local/flowise/     ← 运行时数据（已 gitignore）
├── data/                  ← SQLite 数据库
├── logs/                  ← 日志
├── storage/               ← 上传文件
├── secret/                ← 加密密钥
└── flow-id.txt            ← bootstrap-flow 写入的 flowId

runtime-local/secrets/     ← 密钥配置（已 gitignore）
└── ai-provider.env        ← AI Provider 真实密钥
```

## 安全约束

- Flowise 只绑定 `127.0.0.1:4300`，不暴露公网
- Flowise UI 需要用户名/密码登录
- Prediction API 需要 Bearer Flow API Key
- AI Provider 真实密钥不存入 Git、不返回给浏览器
- Flowise 通过内部代理访问 AI Provider：
  `host.docker.internal:4000/api/v1/internal/ai/openai/v1/chat/completions`
- 如果 AI Provider 未配置，服务仍可启动，页面显示 `PROVIDER_NOT_CONFIGURED`

## 生产环境说明（P0 不实现）

- 正式环境应使用独立 PostgreSQL 替代 SQLite
- 正式环境应使用独立密钥管理（Vault / K8s Secrets）
- 正式环境不得使用 SQLite
- 需要添加 TLS 终结
- 需要在基础设施层面限制网络

## 不允许的操作

- 禁止使用 `:latest` 镜像标签
- 禁止把 API Key 提交到 Git
- 禁止把 Flowise 密码提交到 Git
- 禁止把数据库文件提交到 Git
- 禁止把日志提交到 Git
- 禁止复制 Flowise 完整源码到主项目
