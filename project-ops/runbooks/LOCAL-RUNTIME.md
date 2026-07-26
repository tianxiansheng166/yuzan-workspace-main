# 本地运行配置

## 配置来源

- 根 `.env`：API、worker、PostgreSQL、Redis、MinIO、语音服务；不提交；
- `infra/ai/flowise/.env`：Flowise 登录和工作流；不提交；
- `runtime-local/secrets/ai-provider.env`：AI provider 与内部 API；不提交；
- 所有可提交变量名和安全占位值写在对应 `.env.example`。

## 当前端口

| 服务                | 地址                      |
| ------------------- | ------------------------- |
| PostgreSQL          | `127.0.0.1:55432`         |
| Redis               | `127.0.0.1:6380`          |
| MinIO API / Console | `127.0.0.1:59000 / 59001` |
| API                 | `127.0.0.1:4000`          |
| Flowise             | `127.0.0.1:4300`          |
| Speech scoring      | `127.0.0.1:8100`          |

健康检查：API 使用 `/api/v1/health/live` 和 `/api/v1/health/ready`；语音服务使用 `/health`。

## 唯一演示/联调启动方式

```powershell
Set-Location D:\program\test_program\yuzanxinsheng\three\yuzan-next
.\scripts\local-runtime\start-main.ps1
```

不要从 `worktrees/` 启动共享演示。脚本固定校验 canonical 根目录与 `origin/main`，
自动启用 Node 24；随后加载 `.env`、启动 Redis/MinIO、检查既有 PostgreSQL、生成
Prisma Client 并启动前端/API/worker。`Ctrl+C` 只停止本次前台开发进程，不停止共享
Docker 容器。

## 启动顺序（脚本内部执行）

1. 使用 Node 24 和 pnpm 10。
2. `docker compose up -d minio redis`。
3. 确认现有 `yuzan-four-port-postgres-55432` 容器健康。
4. `pnpm db:generate`，按任务要求执行迁移。
5. 启动 API，再启动 worker 和可选 AI/语音服务。

语音服务使用 `./scripts/local-runtime/start-speech.ps1`，脚本会从根 `.env` 加载 `FFMPEG_DIR` 等本机配置；当前目录为 `backend/speech-scoring`。

`postgres` Compose 服务位于 `bootstrap-db` profile。当前数据库仍由既有容器承载；在备份并停止旧容器前，不要执行 `docker compose --profile bootstrap-db up postgres`。
