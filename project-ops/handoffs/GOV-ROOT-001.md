# GOV-ROOT-001 Handoff

- Owner: Integration Lead
- Branch: `task/gov-root-001`
- Base commit: `49b8277c3b8cd7572b7c087db0eb79dda3fc5c0b`
- Governance commit: `a5611c1`
- Runtime commit: `ee8991e`
- Status: `IN_REVIEW`

## User outcome

当前 P0 集成项目已提升为 `three/yuzan-next` 唯一主路径；旧项目和依赖集中到 `legacy-archive`，并发目录统一为 `three/worktrees`。

## Implemented

- 修复根规范断链，新增中心恢复点、工作流、runbook、任务和迁移清单；
- 将 GitHub 设置为主 `origin`，旧本地仓库保留为 `legacy-local`；
- 重建 Node 24/pnpm 依赖和锁文件；
- 统一 PostgreSQL、Redis、MinIO、Flowise、Speech 的模板和端口；
- 恢复旧主仓库的语音评分实现，保留 P0 兼容初始化代码；
- 新增安全 worktree 创建/移除脚本和核心运行启动脚本；
- 归档临时登录脚本、旧 worker 和旧依赖，不删除 Docker volume。
- 提交 `CCR-GOV-ROOT-001`，明确本地端口、volume、环境变量和回滚责任。

## Tests actually run

- `pnpm install --frozen-lockfile --offline ...`：通过。
- `pnpm db:generate`：通过。
- `pnpm db:validate`：通过，保留一个 Prisma `SetNull` schema warning。
- `pnpm typecheck`：共享包、database、API、worker 通过；Web 在 `useRecordingUpload.ts:98` 失败。
- `pnpm --filter @yuzan/api test`：49 files / 903 tests 通过，4 files / 55 tests skipped。
- `pnpm --filter @yuzan/worker test`：AI 25 tests 通过；speech suite 因错误导入路径未加载，命令失败。
- API、worker build：通过。
- API `/api/v1/health/live`、`/ready`：200。
- Speech `/health`：`status=ok`。
- Compose config、MinIO/Redis 管理和端口探测：通过。
- worktree create/remove smoke：通过，验证后临时分支已普通删除。

## Security and data

- `.env` 和嵌套 provider 配置保持未跟踪，未输出或提交密钥值；
- PostgreSQL 容器和 volume 未删除；
- 旧仓库的脏文件和 `p0-tests` 未提交内容均保留；
- API 测试包含租户越权和未知角色拒绝场景。

## Known blockers

- 审核并吸收归档 P0 worker 尚未进入集成线的提交；
- 修复 Web nullable type error；
- 修复 worker speech test 的错误相对导入或 Vitest config 加载；
- 完成上述门禁前不更新 GitHub `main`。

## Session-exit cleanup

旧 `workers/p0-integration` 目前为空，但被本次 Codex 会话持有，Windows 不允许
在进程退出前删除。结束本会话后运行
`../legacy-archive/cleanup-empty-workers-after-session.ps1`；脚本会先归档任何
意外残留，再删除空目录，使 `three` 最终只保留主目录、worktrees 和
legacy-archive。
