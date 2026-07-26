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

启动脚本先检查固定端口和真实健康端点。如果 API、前端代理、语音服务与 canonical worker
都已存在且健康，它只报告 `Reusing` 并退出，不会再次执行 `pnpm dev`。如果只存在部分服务、
健康检查失败或固定端口被占用，它会输出结构化诊断并失败；脚本不会终止未知进程，也不会
自动改到其他端口。可单独查看当前状态：

```powershell
.\scripts\local-runtime\get-runtime-status.ps1 | ConvertTo-Json -Depth 8
```

状态中的 `OBSERVED_RUNTIME_NOT_COMMIT_ATTESTED` 表示健康端点和进程已现场观察，但旧进程
加载的构建产物尚不能仅凭端口反推为当前 commit；最终黄金闭环仍必须在集成后的 exact commit
重新启动和验收。若出现 `duplicate_worker_warning`，脚本只报警，不会擅自清理既有终端的进程。

MinIO 的 `MINIO_API_CORS_ALLOW_ORIGIN` 必须包含 `http://127.0.0.1:4175`；浏览器录音
直传需要该来源。修改它后执行 `docker compose up -d --force-recreate minio`，仅重建容器，
不会删除既有 MinIO 数据卷。

## 启动顺序（脚本内部执行）

1. 使用 Node 24 和 pnpm 10。
2. `docker compose up -d minio redis`。
3. 确认现有 `yuzan-four-port-postgres-55432` 容器健康。
4. `pnpm db:generate`，按任务要求执行迁移。
5. 启动 API，再启动 worker 和可选 AI/语音服务。

语音服务使用 `./scripts/local-runtime/start-speech.ps1`，脚本会从根 `.env` 加载 `FFMPEG_DIR` 等本机配置；当前目录为 `backend/speech-scoring`。

`postgres` Compose 服务位于 `bootstrap-db` profile。当前数据库仍由既有容器承载；在备份并停止旧容器前，不要执行 `docker compose --profile bootstrap-db up postgres`。
