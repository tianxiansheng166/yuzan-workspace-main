# AI 开发短契约

这是所有开发任务的稳定默认规则。任务 JSON 只补充本次目标、事实、范围和证据；
不要在每个任务里重复整套项目知识。

## 1. 当前方向

当前唯一 P0 是把“古诗文朗读与理解训练”做成可审计的教师—学生黄金闭环：

```text
教师配置/发布 → 学生真实作答与录音 → 异步处理
→ 教师复核 → 学生看到可信反馈 → 教师继续干预
```

新任务必须直接闭合其中一环、修复一处阻塞，或提供必需的质量/治理能力。当前不以
铺更多页面、增加社区/内容商城、重造通用平台或优先建设 AI Agent 为完成标准。

## 2. 默认上下文预算

已有任务每次开工或续作先运行：

```powershell
& .\scripts\repo\task-context.ps1 -Mode auto
```

入口只输出三类稳定内容和实时 Git 现场：

1. 本短契约；
2. 自己的任务 JSON；
3. 任务 `context.required`。

续作时若 handoff 已存在则一并读取。脚本按当前 branch 自动发现任务，单文件和总量
都有字节预算，且不写临时文件。不要让用户每次重新附加项目规范或任务文件。

不要习惯性通读 `docs/`、历史报告、全部源码、`PROJECT-CHARTER.md` 或
`CURRENT.md`。需要补事实时按 `CONTEXT-ROUTER.md` 增量读取直接相关文件。
聊天、旧报告和截图不能覆盖当前源码、契约、数据与实际运行证据。

## 3. 任务可开工条件

任务必须明确：

- 一个用户结果，以及它对 P0 的贡献；
- 当前事实和明确非目标；
- 精确 branch、`base_commit`、依赖与集成顺序；
- `allowed_paths` 和共享文件 owner；
- 最小测试、handoff 与回滚方式。

自主排程时先选“最接近用户闭环、依赖已满足、没有共享文件冲突”的最小任务。
结果尚不确定时，将它定义为 discovery 任务：写清假设、时间边界、可证伪实验和
退出条件；不能把探索结果直接写成已完成功能。

任务元数据形成提交后，在独立 worktree 运行 `task-context.ps1 -Mode auto`。
PLANNED 且干净时它运行 preflight；已有执行现场时它运行 resume。分支、基线、
工作区、上下文或白名单不匹配时，不开始写代码。

## 4. 实现规则

- 一个任务只闭合一个最小纵向结果；
- 先复用现有数据模型、API、组件和执行器；
- 前端字段以真实 DTO/OpenAPI/响应为准，不能分别猜契约；
- 数据来自真实 API/持久化；禁止固定 ID、静态业务数据和假成功 fallback；
- loading、empty、error、offline、permission、processing、provider unavailable
  按任务风险真实呈现，不能把 unavailable 写成 success；
- school/resource/user scope 在服务端 fail closed；
- AI 结果是可追踪、可复核的建议，不冒充确定评分；
- OpenAPI、Prisma、根依赖、CI、全局路由和 UI token 是共享事实；
- 超出白名单的必要改动先拆前置任务；OpenAPI/Prisma 变更必须有 CCR；
- 稳定决策写入 `project-ops/decisions/`，不能只留在对话中。
- PowerShell 读取 UTF-8 文本/JSON 时显式指定 `-Encoding UTF8`，保证 Windows
  PowerShell 5.1 与 PowerShell 7 结果一致。

实现细节不确定时，AI 可自主选择最小、可逆、可测试的方案并在 handoff 写明假设。
只有方向、契约/schema、权限、数据解释、他人工作或生产状态将被改变时才暂停。

## 5. 最小测试

最小测试是“能最快证伪本次改动的一组检查”，不是固定的全仓命令：

| 改动类型 | 最小证明 |
|---|---|
| 文档/治理/脚本 | 格式或解析检查 + 聚焦 smoke + `git diff --check` |
| 前端逻辑 | 相关单测/静态检查 + 真实请求或渲染证据 |
| 可见 UI | 相关检查 + 1440/1024/390 页面证据 + console/page error |
| API/worker | 相关单元或集成测试 + 失败路径 |
| 身份/租户/资源读取 | 正向用例 + 越权负向用例 |
| OpenAPI/DTO/client | 契约校验 + provider/consumer 对齐测试 |
| Prisma/migration | generate/validate + 迁移/回滚 + 数据边界测试 |
| 跨服务黄金链路 | 动态 ID 的真实纵向 smoke/E2E |

风险可以增加测试，不能用无关全量绿灯替代相关验证。0 个测试、只返回 HTTP 200、
fixture/fixed ID 或静态截图都不能单独证明功能完成。实际命令与结果写入
`test_evidence`；失败、跳过和环境阻塞原样记录。

## 6. 自审问题

提交前检查：

1. 差异是否只服务任务用户结果和 P0？
2. 是否修改了白名单外文件或未声明共享事实？
3. 是否复用了现有模型/契约，且没有硬编码或假成功？
4. 正常与本任务相关的失败、权限、离线/provider 状态是否真实？
5. 测试是否直接覆盖改动和最高风险？
6. 是否泄露密钥、真实学生数据、受限资产或敏感日志？
7. handoff 是否足以让陌生 reviewer 恢复、验证和回滚？

## 7. 完成定义

任务只有同时满足以下条件才是 `READY_FOR_REVIEW`：

- 用户结果已实现，非目标未被偷偷扩张；
- 所有 changed paths 在白名单内；
- 每项 `minimal_tests` 都有真实 `PASS` 证据；
- handoff 记录实现、风险、验证、限制和回滚；
- review 门禁通过并完成提交；
- finish 门禁确认分支领先基线且 `git status --porcelain` 为空。

推送 task branch 不等于集成完成。Integration Lead 合并并复验后，才更新
`CURRENT.md`、把任务移入 completed 并删除 worktree。
