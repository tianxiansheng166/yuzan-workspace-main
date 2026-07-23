# AGENTS.md

## 最小开工上下文

已有 active task 的分支每次开始、继续、上下文压缩或机器重启后，第一条命令统一为：

```powershell
& .\scripts\repo\task-context.ps1 -Mode auto
```

脚本从当前 branch 自动匹配唯一任务，执行 start/preflight 或 resume 门禁，并只
输出：

1. `project-ops/AI-DEVELOPMENT-CONTRACT.md`；
2. 当前任务 JSON；
3. 任务 `context.required` 中的 2–6 个文件；
4. 已有 handoff（仅续作）；
5. 当前 Git status、最近提交和相对 base 的 changed paths。

不要要求用户重复上传这些文件，不要默认通读 `docs/`、`PROJECT-CHARTER.md` 或
`CURRENT.md`。没有任务 JSON 时先用模板和 `CONTEXT-ROUTER.md` 创建任务，在独立
worktree 提交元数据后再运行自动入口。脚本拒绝仓库外路径、二进制和超预算上下文，
且不会生成临时文件或改变 Git 状态。

## 仓库边界

- 唯一主项目是 `D:/program/test_program/yuzanxinsheng/three/yuzan-next`；
- 每个任务使用 sibling `../worktrees/<task-id>`，不要在主项目内创建完整克隆；
- `frontend/` 是唯一当前前端；
- 后端只在 `backend/api/`、`backend/worker/`、`backend/speech-scoring/`；
- 共享源码在 `packages/`，数据库与基础设施在 `infra/`；
- `../legacy-archive/` 只作恢复证据，不作开发输入；
- 不得重建 `apps/apps-web`、`web-runtime`、`apps/api`、`apps/worker` 或
  `services/speech-scoring`。

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
