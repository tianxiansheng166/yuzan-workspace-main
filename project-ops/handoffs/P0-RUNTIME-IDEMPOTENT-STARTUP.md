# P0-RUNTIME-IDEMPOTENT-STARTUP Handoff

- Owner: `codex-account-c-builder`
- Reviewer: independent runtime verifier
- Branch: `task/p0-runtime-idempotent-startup`
- Base commit: `41a0ff3656af7888d4c2e46eb180eeffc3414115`
- Status: `READY_FOR_REVIEW`

## 用户结果与方向

- 已完成的唯一用户结果：只有 nonce/PID/可执行文件/启动时间/根目录/exact commit/精确 argv/lock
  全部匹配的 canonical runtime 才能在连续启动时复用；未知或伪造进程 fail closed。
- 推进黄金闭环的环节：为后续浏览器、API、DB 同 commit 验收提供可重复的主运行入口。
- 明确未做：没有修改业务功能，没有自动清理已有重复 worker，也没有把健康检查写成黄金闭环通过。

## 实现与修改范围

- `get-runtime-status.ps1` 读取真实 readiness/health 与固定端口监听 PID，并验证 launch-time
  manifest、每个 wrapper/child 的身份、nonce、lock、角色 argv 和 exact candidate commit。
- `start-core.ps1` 在生成、构建或 `pnpm dev` 前先判断运行态：完整健康则复用；部分、异常或
  端口冲突、wrong commit 或 argv 冒充则带结构化诊断失败，不执行杀进程和换端口。
- `managed-process.py` 为每个服务持有独占 lock，并原子发布 wrapper/child PID、nonce、root、
  commit 和实际 argv 哈希；状态端按角色重建允许的完整 argv，不能由命令行子串冒充。
- review round 2 额外从 `Win32_Process.CommandLine` 读取 wrapper 与 child 的实时完整 argv，
  用 Windows 原生命令行解析规则重建参数数组；实时值、manifest 记录、attestation 与角色契约
  四者必须一致。即使伪造记录中的两个 argv 哈希，也不能替代操作系统中的真实参数。
- `test-repeatable-start.ps1` 在隔离动态端口执行两次真实 `start-core -ReuseOnly`，并将证据写到
  `runtime-local/local-runtime/repeat-start-result.json`。
- 共享事实：修改 canonical runtime startup owner；没有 OpenAPI、Prisma、根依赖或业务契约变化。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| PowerShell/Python 语法 | `powershell -NoProfile -File scripts/local-runtime/test-repeatable-start.ps1 -Mode Syntax` | `PASS`，5 PS + 3 Python |
| fixture 初次校准 | runtime 命令同下 | `FAIL`，生产 argv 契约正确拒绝 generic fixture；已将 fixture 限制到 OS temp 前缀与非生产动态端口 |
| 隔离重复与负向套件 | `powershell -NoProfile -File scripts/local-runtime/test-repeatable-start.ps1 -Mode Runtime -RepositoryRoot .` | `PASS` |
| review round 2 实时 argv 强化 | runtime 命令同上 | `PASS`，正确解释器 + 伪造记录哈希仍被实时 argv 拒绝 |
| attempt 7 exact-candidate 重跑 | syntax + runtime 命令同上 | `PASS`，候选 `e2350f3cc336c212778232ed2753930e0e1b213d`，运行时间 `2026-07-26T18:18Z` |
| attempt 8 exact-candidate 重跑 | syntax + runtime 命令同上 | `PASS`，候选 `9bb02084b6d662e44e29cd5ff8c81504a1fa52c3`，运行时间 `2026-07-26T18:52Z` |
| attempt 9 exact-candidate 重跑 | syntax + runtime 命令同上 | `PASS`，候选 `956839d32450e371d666817bf30f801c89d36c28`，运行时间 `2026-07-26T19:20Z` |

通过结果：`PASS_EXACT_COMMIT_ATTESTED`；两次启动入口 `PASS_IDENTICAL_PIDS_AND_COMMIT`；
foreign partial occupancy `PASS_FAILED_CLOSED_NO_KILL_NO_PORT_CHANGE`；包含仓库根、
`backend\worker`、`src/main.ts` 的 PowerShell sleep 为受管 wrapper 提供完整伪造记录后仍以
`COMMAND_ARGV_MISMATCH` 拒绝；使用正确 `python.exe` 的 sleeper 即使把 manifest/attestation
中的 child/wrapper 哈希改成期望值，也因实时 argv 不匹配而拒绝；wrong candidate commit 拒绝。
所有隔离进程均在 `finally` 清理。

attempt 7 输出的隔离端口为 `61531/61532/61533`，PID 指纹为
`api=40664;frontend_proxy=36360;speech=38852;worker=40032`。这些 PID 仅是本轮短生命周期
fixture 的复验事实，不是 canonical 共享运行态声明；验证脚本完成后已清理。

attempt 8 输出的隔离端口为 `56966/56967/56968`，PID 指纹为
`api=24092;frontend_proxy=39004;speech=17896;worker=39536`。这些 PID 同样只属于短生命周期
fixture；套件在 `finally` 中完成清理。

attempt 9 输出的隔离端口为 `58559/58560/58561`，PID 指纹为
`api=37028;frontend_proxy=40704;speech=38076;worker=32548`。这些 PID 同样只属于短生命周期
fixture；套件在 `finally` 中完成清理。

## 自审

- [x] 差异只服务任务结果且均在 `allowed_paths`
- [x] 无固定业务 ID、静态业务数据、假成功或 demo fallback
- [x] 部分/异常运行态显式失败，不伪装成可用
- [x] 最高风险由隔离 managed-runtime 的 clean exact-candidate、两次 `ReuseOnly` PID 稳定性及负向状态直接测试
- [x] 无密钥、真实学生数据或来源不明资产
- [ ] 独立 reviewer 复验并签发 `VERIFIED`

## 风险、限制与回滚

- 已知风险：worker 没有健康端口；本任务证明受管进程身份与 exact commit，不替代队列端到端消费。
- 已知限制：attempt 2 或其他旧运行态没有新 manifest/lock，必须由其所有者清理后才能启动并证明
  exact candidate；脚本不会自动终止它们。
- 假设：Windows PowerShell 可用 `Get-NetTCPConnection`；缺失时监听器发现回退 `netstat`。
- 回滚步骤：revert 本任务提交；可删除 gitignored 的 `runtime-local/local-runtime/`，无需终止进程。

## 集成说明

- 依赖与合并顺序：本任务无业务依赖，可先于教师/学生纵向功能集成。
- Integration Lead 需要在 exact candidate/integration commit 独立复验 clean startup、两次复用、
  foreign partial port、PowerShell command-line spoof 与 wrong-commit 五种状态。
- 实现提交：`b95f666`（nonce/PID manifest 与 exact commit/argv/lock 联合证明）、
  `e2350f3`（Windows live wrapper/child argv 校验与伪造哈希负向覆盖）。
- 最终候选提交由本 handoff/evidence 更新提交产生，并通过控制面 `COMPLETE_CANDIDATE` 精确上报。
