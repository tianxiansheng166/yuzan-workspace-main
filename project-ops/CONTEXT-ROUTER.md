# 最小上下文路由

所有任务默认只读 `AI-DEVELOPMENT-CONTRACT.md`、任务 JSON 和
`context.required`。创建任务时从下表选择必要资料；没有直接关系的行不要加入。

| 任务类型 | 加入 `context.required` | 继续查证的代码事实 |
|---|---|---|
| 产品取舍/用户旅程 | `PROJECT-CHARTER.md`、`docs/项目指导/README.md` | 当前 P0、非目标、验收结果 |
| 当前状态/恢复/集成 | `project-ops/CURRENT.md`、相关 handoff | HEAD、运行入口、已验证证据 |
| 前端页面/交互 | `project-ops/FRONTEND-QUALITY-BAR.md` | 目标页面、api-client、真实响应、各 UI 状态 |
| API/DTO/权限 | 相关 Controller/DTO/service/spec | 调用者、OpenAPI、tenant/resource scope |
| 契约变更 | OpenAPI/共享 contract、相关 CCR | provider 与所有 consumer |
| 数据库/迁移 | Prisma schema、相关 migration/runbook | 现有模型、数据边界、回滚 |
| worker/语音评分 | 相关 worker、speech-scoring、队列契约 | 重试、幂等、provider unavailable、回写 |
| 测试/运行环境 | 相关 package scripts、runtime runbook | Node/pnpm、服务地址、真实依赖 |
| 仓库治理/CI | `DEVELOPMENT-WORKFLOW.md`、目标脚本/workflow | worktree、分支、共享 owner |

## 路由原则

- 优先读目标文件及其直接 import/caller，不按目录全量读取；
- 文档与源码冲突时，以当前源码、契约、数据和运行证据为事实，并登记文档漂移；
- 只有需要判断集成现状时才读 `CURRENT.md`；
- 只有需要改变产品方向时才读完整章程并申请决策；
- 旧 `web-runtime`、`apps/*` 和归档材料只在明确恢复任务中读取；
- 如果新增上下文没有改变决策，就停止继续扩张阅读范围。

任务 JSON 的 `context.required` 应尽量保持 2–6 项。超过 6 项时，先判断任务是否
过大，能否拆成共享前置任务和一个更小纵向任务。
