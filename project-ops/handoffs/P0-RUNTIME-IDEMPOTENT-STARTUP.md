# P0-RUNTIME-IDEMPOTENT-STARTUP Handoff

- Owner: `codex-runtime-builder`
- Reviewer: independent runtime verifier
- Branch: `task/p0-runtime-idempotent-startup`
- Base commit: `41a0ff3656af7888d4c2e46eb180eeffc3414115`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：同一 canonical runtime 已完整运行时，连续执行启动只复用固定端口
  4000/4175/8100 与既有 worker，不重复拉起服务、不终止任何进程、也不漂移端口。
- 推进黄金闭环的环节：为后续浏览器、API、DB 同 commit 验收提供可重复的主运行入口。
- 明确未做：没有修改业务功能，没有自动清理已有重复 worker，也没有把健康检查写成黄金闭环通过。

## 实现与修改范围

- 新增 `get-runtime-status.ps1`，读取真实 API readiness、前端代理 readiness、语音 health、
  固定端口监听 PID 与 canonical worker PID。
- `start-core.ps1` 在生成、构建或 `pnpm dev` 前先判断运行态：完整健康则复用；部分、异常或
  端口冲突则带结构化诊断失败，不执行杀进程和换端口。
- 新增 `test-repeatable-start.ps1`，对真实 canonical runtime 连续执行两次启动，比较前后 PID
  指纹、健康状态和固定端口，并将 gitignored 证据写到
  `runtime-local/local-runtime/repeat-start-result.json`。
- 共享事实：修改 canonical runtime startup owner；没有 OpenAPI、Prisma、根依赖或业务契约变化。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| PowerShell 语法 | `powershell -NoProfile -File scripts/local-runtime/test-repeatable-start.ps1 -Mode Syntax` | `PASS`，4/4 |
| 首轮 runtime 检查 | 同下 | `FAIL`，测试器错误捕获 `Write-Host`，功能已复用但断言误判 |
| 修正后连续启动 | `powershell -NoProfile -File scripts/local-runtime/test-repeatable-start.ps1 -Mode Runtime -RepositoryRoot D:\program\test_program\yuzanxinsheng\three\yuzan-next` | `PASS`，两轮 PID 不变，API/代理/语音均 200 |
| whitespace | `git diff --check` | `PASS` |

现场 PID 指纹：`api=2960;frontend_proxy=10796;speech=32820;worker=23900,30388`。脚本明确报告
两个 canonical worker 的历史重复进程，但没有自动停止它们。两次启动前后 PID 集合完全相同，
证明本次启动没有继续制造重复进程。

## 自审

- [x] 差异只服务任务结果且均在 `allowed_paths`
- [x] 无固定业务 ID、静态业务数据、假成功或 demo fallback
- [x] 部分/异常运行态显式失败，不伪装成可用
- [x] 最高风险由真实 canonical runtime 两次启动和 PID 稳定性直接测试
- [x] 无密钥、真实学生数据或来源不明资产
- [ ] 独立 reviewer 复验并签发 `VERIFIED`

## 风险、限制与回滚

- 已知风险：worker 没有健康端口，当前只能按 canonical 路径和命令行识别；进程存在不等于队列消费
  已完成端到端验证。
- 已知限制：现场旧运行态无法仅凭端口证明其加载产物恰好等于当前 commit，因此状态如实标记
  `OBSERVED_RUNTIME_NOT_COMMIT_ATTESTED`；集成后仍须从 exact commit 受控重启并做黄金 E2E。
- 假设：Windows PowerShell 可用 `Get-NetTCPConnection` 和 `Get-CimInstance`。
- 回滚步骤：revert 本任务提交；可删除 gitignored 的 `runtime-local/local-runtime/`，无需终止进程。

## 集成说明

- 依赖与合并顺序：本任务无业务依赖，可先于教师/学生纵向功能集成。
- Integration Lead 需要复验：在没有服务、完整服务、部分占端口三种状态分别确认启动、复用、
  fail-closed；仅由明确拥有进程的终端负责退出，脚本不得自动清理未知进程。
- 推送分支/commit：提交后补充。
