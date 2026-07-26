# AGENTS.md

## 最小开工上下文

控制面已初始化时，每次开始、继续、上下文压缩或机器重启后的唯一入口是：

```powershell
& .\scripts\repo\mvp-control.ps1 -Action context -AgentId <worker-id>
```

它先校验 Goal revision、租约、围栏 epoch 和动态工作单。没有有效租约时，不加载旧任务、
不写功能代码；有租约时，只读取工作单 `context_manifest` 中列出的文件并校验 SHA256，
然后再按工作单指示运行 `task-context.ps1 -Mode auto` 做 Git/白名单门禁。

每轮启动 capsule 推荐不超过 32 KiB、硬上限 48 KiB，只包含短契约、动态工作单、当前
任务/功能链、最新失败和 Git 事实。目标源码及 direct import/caller 在执行过程中按需读取，
不塞入启动上下文。上下文压缩后重跑同一入口，不凭压缩摘要猜 Goal 或继续旧指令。

`docs/**`、旧 prompt、看板和 `CURRENT.md` 默认是 `REFERENCE_NO_AUTOLOAD`，不能覆盖
当前 Goal、验收旅程、FeatureChain、Git/契约或真实运行证据。只有动态工作单以精确路径和
用途授权时才能增量读取。文档生命周期和冲突优先级以
`project-ops/control-plane/document-registry.json` 为准；未登记的 `docs/**` 一律不自动加载。

尚未初始化控制面或执行治理迁移任务时，才直接运行 `task-context.ps1 -Mode auto`。不要要求
用户重复上传仓库内文件，也不要默认通读整个 `docs/`、`PROJECT-CHARTER.md` 或历史报告。

## 仓库边界

- 唯一主项目是 `D:/program/test_program/yuzanxinsheng/three/yuzan-next`；
- 每个任务使用 sibling `../worktrees/<task-id>`，不要在主项目内创建完整克隆；
- `frontend/` 是唯一当前前端；
- 后端只在 `backend/api/`、`backend/worker/`、`backend/speech-scoring/`；
- 共享源码在 `packages/`，数据库与基础设施在 `infra/`；
- `../legacy-archive/` 只作恢复证据，不作开发输入；
- 不得重建 `apps/apps-web`、`web-runtime`、`apps/api`、`apps/worker` 或
  `services/speech-scoring`。

`worktrees/` 的代码永远不是默认运行目标。需要给用户、产品或集成测试查看最新成果时，
先将已验收 checkpoint 合入 `integration/p0-multitrack-001`，经硬化后提升到 `main`，
再仅从 canonical `yuzan-next` 运行 `scripts/local-runtime/start-main.ps1`。

pnpm 管理整个 workspace。依赖只在仓库根安装，不在子包运行 `npm install`。
兼容 Windows PowerShell 5.1 的脚本读取 UTF-8 文本/JSON 时必须显式指定
`-Encoding UTF8`。

## 不可协商规则

- 只在任务分支/worktree 和 `allowed_paths` 内工作；
- 先复用现有模型、契约和执行器，再考虑新增抽象；
- 禁止用固定 ID、静态业务数据、假成功或 demo fallback 冒充真实闭环；
- 服务端强制 school/resource/user scope，失败必须显式；
- OpenAPI、Prisma、根依赖、CI、全局路由和 UI token 是共享事实；
- 共享事实变更必须声明 owner；OpenAPI/Prisma 变更还必须有 CCR；
- 不执行破坏性 Git 清理，不覆盖其他人的脏工作区；
- 不提交密钥、真实学生数据或来源不明资产；
- 未实际运行的测试不得写成通过。

## 完成门禁

完成前更新测试证据和 handoff，运行 `task-gate.ps1 -Mode review`；提交后运行
`task-gate.ps1 -Mode finish`。只有 finish 通过、`git status --porcelain` 为空，
才能报告任务完成或推送分支。

## Checkpoint 合并门禁

任务不必等待完整产品闭环才可合并。达到检查点可合入时，应提交、推送并交给
Integration Lead：一个用户可观察结果可运行，或明确返回 `UNAVAILABLE` /
`NEEDS_REVIEW` / `PROVIDER_UNAVAILABLE`；局部测试、类型检查、task-gate 与 handoff
有真实证据；共享变更有 CCR/owner；未完成部分不破坏既有流程。Integration Lead 重跑
定向验证后合入 integration 并更新看板。只有 integration 硬化完成才可执行
`scripts/repo/promote-integration.ps1 -Apply` 提升到 `main`。
