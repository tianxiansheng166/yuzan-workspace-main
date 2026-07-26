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

启动脚本先检查固定端口、真实健康端点和 `runtime-local/local-runtime/process-manifest.json`
中的受管进程证明。每个服务必须同时匹配启动 nonce、canonical 根目录、exact commit、wrapper
与 child 的 PID/可执行文件/启动时间、仍持有的 lock，以及该角色唯一允许的完整 argv 结构。
状态检查还会从 Windows 进程表读取 wrapper 与 child 当前真实的完整 argv；manifest 或
attestation 中仅声称正确的哈希不构成所有权证明，实时 argv 与记录/角色契约任一不一致都会
fail closed。
只有 API、前端代理、语音服务与 worker 全部满足这些条件时才报告 `Reusing`，不会再次构建或
拉起进程。如果只存在部分服务、健康检查失败、固定端口被占用、证明缺失、argv 冒充或 commit
不同，脚本会输出结构化诊断并失败；不会终止未知进程，也不会自动改到其他端口。可单独查看：

```powershell
.\scripts\local-runtime\get-runtime-status.ps1 | ConvertTo-Json -Depth 8
```

状态只有在全部 ownership 与 commit 检查通过时才给出 `EXACT_COMMIT_ATTESTED` 和
`all_ready=true`。旧运行态、未知监听器或仅在命令行中包含仓库/worker 路径的进程都只能得到
`UNATTESTED_OR_UNOWNED`，不能触发复用；由原进程所有者自行清理后再启动 exact candidate。

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
