# MVP 持续闭环控制面

## 它解决什么

旧体系擅长约束一个已经分配的任务，但缺少“任务结束后重新计算 MVP 缺口”的循环。
本控制面把一次性提示词改成可恢复的运行协议：

```text
读取唯一 Goal
→ 对账 Git、任务、租约和事件
→ 计算未满足验收项
→ 选择依赖满足且写集/资源不冲突的任务
→ 发出租约工作单
→ Builder 提交候选
→ 独立 Verifier 在集成运行环境证伪
→ REJECTED：生成聚焦返工工作单
→ VERIFIED：排队集成并重新验证
→ 重算 Goal 缺口
→ 直到全部终态门禁通过才停止
```

它不是另一份手工看板。稳定事实放在 Git，高频运行状态放在已忽略的
`runtime-local/control-plane/`，避免每分钟提交心跳或让多个 worktree 冲突。

## 权威事实

| 信息 | 权威位置 | 写入者 |
| --- | --- | --- |
| 唯一产品结果、非目标、终态验收 | `goal.json` | Product Owner 批准，Controller 维护 revision |
| 初始 DAG、写集、锁、资源、验收映射 | `bootstrap-work-items.json` | Controller/Integration Lead |
| 调度、租约与围栏规则 | `scheduler-policy.json` | Controller owner |
| 真实用户验收标准 | `../acceptance/**` | Independent verification owner |
| 任务施工合同 | `../tasks/active/<id>.json` | 对应 Task Owner |
| 高频 Worker、租约、事件、证据 | `runtime-local/control-plane/**` | Controller 单写 state；Worker 独立事件文件 |
| Git/分支/提交事实 | Git | Git 本身 |

`CURRENT.md`、历史看板和 handoff 可以帮助人阅读，但不再单独决定派发。

## 弹性并发

并发数不绑定有几个 Codex，也不写死在 `.codex/config.toml`。每次 tick 的安全并发等于：

```text
依赖已满足的工作
∩ 当前在线 Worker 能力
∩ 不冲突的 shared locks 与 write_set
∩ 具名运行资源剩余容量
∩ reviewer 与 implementer 独立性
```

一个根 Codex 产生的子 Agent 也作为独立 Worker 注册。Worker 默认一次只领取一个写任务；
只读探索可以作为子任务并发，但不得自行扩大父任务写集。

## 为什么需要租约和 fencing epoch

Agent 会中断、压缩上下文、网络掉线或机器重启。仅写 `IN_PROGRESS` 无法证明谁还在工作。
控制器为每次 claim 签发 `lease_id + fencing_epoch`：

- 心跳续租必须携带两者；
- 租约过期后先进入 `ORPHANED_QUARANTINE`，不立即把同一 worktree 交给别人；
- 恢复检查 Git、进程、handoff 和 changed paths 后，才以更高 epoch 重新派发；
- 旧 Agent 迟到的事件因 epoch 过期被拒绝，避免重复完成或覆盖新工作。

## 文件可变性

### Tier 0｜目标与验收，低频且需要批准

- `project-ops/control-plane/goal.json`
- `project-ops/acceptance/**`
- `project-ops/decisions/**`

Agent 不能为了让测试通过而降低这些标准。

### Tier 1｜共享事实，单写者

- OpenAPI、Prisma/migration、根依赖/lockfile、CI；
- 身份/租户/权限中间件；
- `frontend/server.mjs`、全局 API client、UI token；
- integration、accepted baseline 和控制状态。

任务必须声明语义锁和 owner。需要新增共享写入时释放当前租约，提出 scope/CCR，不边做边扩。

### Tier 2｜任务拥有的代码

只允许当前有效 work ticket 中 `write_set` 与任务 JSON `allowed_paths` 的交集。两个前缀存在
父子关系即视为冲突；无法证明不相交的 glob 保守冲突。

### Tier 3｜每次运行独立、追加式证据

- `runtime-local/control-plane/events/incoming/<event-id>.json`
- `runtime-local/control-plane/evidence/<task>/<attempt>/<run-id>/**`
- verifier 的每轮 verdict。

禁止多个 Agent 追加同一个 JSONL；每个事件一个文件，控制器统一归并。

### Tier 4｜本机临时状态

心跳、租约、日志、截图、trace、PID、端口和本地密钥不进入 Git。

## 上下文恢复

每次新回合、压缩、重启或 handoff 后，Worker 首先运行：

```powershell
& .\scripts\repo\mvp-control.ps1 -Action context -AgentId <worker-id>
```

它验证并返回：Goal revision/digest、当前工作单、lease/epoch、带 SHA256 的
`context_manifest`、最新失败、Git 现场和唯一 next action，同时生成 `CONTEXT_ACK` 事件。
Goal/hash/租约不一致立即 `REPLAN_REQUIRED`。没有有效租约时不得根据旧聊天继续写代码。

原 `task-context.ps1 -Mode auto` 继续负责任务级源码上下文；两者职责不同：前者回答“整个
MVP 现在为什么让我做这件事”，后者回答“这个分支具体允许我怎么做”。

控制面规范本身不应成为每轮负担：活动 capsule 推荐 32 KiB、硬上限 48 KiB；未登记的
`docs/**`、旧 prompt、看板和 CURRENT 默认不加载。完整读取矩阵、冲突优先级、反馈如何
纠偏以及旧文档的两阶段归档规则见 `CONTEXT-GOVERNANCE.md` 和 `document-registry.json`。

## Controller 心跳

仓库脚本负责确定性状态计算，不直接调用 Codex App 的线程 API。Codex App 中的同一控制
线程可设置一分钟 heartbeat，执行 `prompts/controller-heartbeat.md`：

1. 运行一次 `tick`；
2. 读取 `actions.json`；
3. 向已有 Worker 线程发送续作/返工消息，或按工作单创建新 worktree 任务；
4. 不因一次无变化而修改提示词；
5. 仅在新证据、过期租约、方向 revision 或失败发生时重写动态 ticket；
6. Goal 完成或出现 authority blocker 时停止自动派发并通知用户。

30 秒或 60 秒只是观察频率，不是每次都必须启动 Agent、跑全量测试或产生提交。

## 命令

```powershell
# 初始化本机运行黑板
& .\scripts\repo\mvp-control.ps1 -Action init

# 注册任意数量 Worker
& .\scripts\repo\mvp-control.ps1 -Action register -AgentId codex-a -Capabilities frontend,api,browser

# 控制器对账并派发
& .\scripts\repo\mvp-control.ps1 -Action tick

# Worker 获取当前上下文或领取一个兼容任务
& .\scripts\repo\mvp-control.ps1 -Action claim -AgentId codex-a
& .\scripts\repo\mvp-control.ps1 -Action context -AgentId codex-a

# Worker 续租或提交事件
& .\scripts\repo\mvp-control.ps1 -Action heartbeat -AgentId codex-a -TaskId P0-...
& .\scripts\repo\mvp-control.ps1 -Action emit -AgentId codex-a -TaskId P0-... `
  -EventType COMPLETE_CANDIDATE -PayloadFile runtime-local/my-candidate.json

# 查看状态
& .\scripts\repo\mvp-control.ps1 -Action status
```

## 停止条件

单个任务 `COMPLETE_CANDIDATE`、测试全绿或提交合入都不会停止 Goal。只有
`goal.json` 的所有验收项在同一当前集成 commit 上获得独立 verifier 的 L3/L4/L5 证据，
Goal 才能成为 `COMPLETED`。外部 provider 缺失或方向问题只有达到 authority blocker 才暂停；
普通失败会生成返工 ticket 继续循环。
