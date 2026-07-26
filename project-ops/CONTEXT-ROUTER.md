# 最小上下文路由

活动控制面任务默认只读动态工作单 `context_manifest` 中列出的文件。唯一入口是：

```powershell
& .\scripts\repo\mvp-control.ps1 -Action context -AgentId <worker-id>
```

无租约不读取旧任务、不写功能代码。工作单确认后再运行 `task-context.ps1 -Mode auto`
校验任务分支、基线、白名单和 Git 现场。创建工作单时从下表选择必要资料；没有直接
关系的行不要加入。

| 任务类型 | 加入 `context.required` | 继续查证的代码事实 |
|---|---|---|
| Controller/调度 | `control-plane/goal.json`、scheduler policy、runtime state/actions | Goal gap、DAG、租约、资源与 Git 事实 |
| 当前状态/恢复 | 当前 work order、task/FeatureChain、最新 rejection/handoff delta | lease/epoch、HEAD、changed paths、唯一 next action |
| 前端页面/交互 | 当前 FeatureChain、唯一 journey、`FRONTEND-QUALITY-BAR.md` | 目标页面、direct handler/client、真实响应、各 UI 状态 |
| API/DTO/权限 | 相关 Controller/DTO/service/spec | 调用者、OpenAPI、tenant/resource scope |
| 契约变更 | OpenAPI/共享 contract、相关 CCR | provider 与所有 consumer |
| 数据库/迁移 | Prisma schema、相关 migration/runbook | 现有模型、数据边界、回滚 |
| worker/语音评分 | 相关 worker、speech-scoring、队列契约 | 重试、幂等、provider unavailable、回写 |
| 测试/运行环境 | 相关 package scripts、runtime runbook | Node/pnpm、服务地址、真实依赖 |
| 仓库治理/CI | `DEVELOPMENT-WORKFLOW.md`、目标脚本/workflow | worktree、分支、共享 owner |
| Verifier | exact SHA、FeatureChain、唯一 journey、evidence schema | 全新 browser context、动态 ID、API/DB/对象存储和权限负向 |
| Integration | Goal revision、verdict/manifest/hash、task gate | remote SHA、changed paths、合入后黄金链复验 |
| 历史发现/迁移 | 工作单明确列出的单个旧文档 | 只输出 hypothesis/document drift，不得改变 Goal 或关闭功能 |

## 路由原则

- 优先读目标文件及其直接 import/caller，不按目录全量读取；
- 产品意图冲突时优先级为：Goal revision > acceptance journey/decision > FeatureChain/task >
  稳定短契约 > reference；当前事实优先级为：exact Git/当前 OpenAPI/Prisma/真实 runtime
  evidence > handoff/CURRENT/历史报告；
- Goal 与源码不一致表示待实现 gap，不得用“源码优先”取消 Goal；
- 只有需要判断集成现状时才读 `CURRENT.md`；
- 只有需要改变产品方向时才读完整章程并申请决策；
- 旧 `web-runtime`、`apps/*` 和归档材料只在明确恢复任务中读取；
- 如果新增上下文没有改变决策，就停止继续扩张阅读范围。
- 未登记的 `docs/**` 和旧 prompt 默认 `REFERENCE_NO_AUTOLOAD`；不得把目录级“先读”清单
  加入普通任务；
- Verifier 独立运行前不读 Builder 的结论性文字和截图，失败后只按 artifact/reproduction
  精确取证；
- `context.required` 只能列仓库内的具体文本文件，不能列目录、`.env`、密钥、
  二进制或生成物；
- 自动入口限制单文件和总上下文字节数；超限时缩小任务，而不是提高预算后通读。

启动 capsule 推荐不超过 32 KiB、硬上限 48 KiB。`context_manifest` 每项必须含
`path + sha256 + purpose + scope`；超过 6 个文件或预算时，先拆任务，不扩大为通读。
