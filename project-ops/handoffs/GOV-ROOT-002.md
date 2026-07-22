# GOV-ROOT-002 Handoff

- Owner: Integration Lead
- Branch: `task/gov-root-002`
- Base commit: `e42a67010092e6875394f1969292d1d751c2c7fe`
- Status: `COMPLETED`

## User outcome

`three/yuzan-next` 已成为结构清晰的唯一主目录。旧前端、旧图片证据、未使用 package 和临时根文件已移到外部归档；当前前后端、共享依赖和开发入口都有唯一解释。

## Implemented

- 将选定静态运行时提升为 `frontend/` 唯一前端；
- 将 API、worker、speech-scoring 统一到 `backend/`；
- 将旧 `apps/apps-web` 移到外部归档，避免 AI/IDE 错判当前前端；
- 归档 291 个、252.51 MiB 且未被运行时引用的 QA/reference 文件；
- 将未使用 workspace package 移出活跃安装，只保留 contracts/domain；
- 重写 workspace、根脚本、CI、启动脚本、环境样例和路径文档；
- 保留根 Docker/环境配置及服务运行配置，并完成 API proxy smoke；
- 修复 worker speech test 的迁移后导入/alias；
- 审计同分支并发提交，未发现真实环境文件、构建依赖目录或常见密钥进入 Git。

## Tests actually run

- `CI=true pnpm install --no-frozen-lockfile --force`：通过，7 workspace；
- Node `24.18.0` 下 `pnpm install --frozen-lockfile --offline`：通过，锁文件无漂移；
- `pnpm db:generate`：通过；
- `pnpm db:validate`：通过，保留既有 Prisma `SetNull` warning；
- `pnpm typecheck`：通过；
- `pnpm build`：通过；
- frontend lint/test/build：通过；
- API：49 files / 903 tests passed，4 files / 55 tests skipped；
- worker：2 files / 33 tests passed；
- API readiness、frontend `/login`、frontend API readiness proxy：HTTP 200；
- JSON、Compose、PowerShell parser 与 Git whitespace 检查：通过。

## Security and tenant coverage

- API 全套测试包含既有租户越权、资源范围和未知角色拒绝覆盖；
- `.env`、依赖树和构建目录未跟踪；
- 未修改 OpenAPI 业务内容或 Prisma schema；
- 未删除 Docker volume、数据库或归档恢复材料。

## Migration and rollback

完整目录、数量和回滚步骤见 `project-ops/ROOT-CLEANUP-MANIFEST-20260722.md`。归档是可恢复移动，不是不可逆删除。

## Remaining operator action

- 复核本 handoff 后决定是否将任务分支快进到 GitHub `main`；
- 退出当前桌面会话后删除被句柄占用的空 `../workers/p0-integration` 及空 `workers/`；
- 后续功能一律从 sibling `../worktrees/<task-id>` 开始，耦合 API 切片先在任务 JSON 写明依赖与合并顺序。
