# 开发、审查与集成流程

## 一条标准任务链

```text
定义任务 → 独立 worktree → 自动 start/resume → 实现 → 最小测试
→ 自审与 handoff → review → 提交 → finish → 推送 → 集成复验
```

## 1. 定义任务

从 `templates/task.template.json` 创建一个任务 JSON。任务必须回答：

- 用户最终能完成什么动作；
- 它直接推进黄金闭环的哪一环，或为该闭环解除什么阻塞；
- 当前事实、明确非目标、依赖和集成顺序；
- branch、精确 `base_commit`、`allowed_paths` 和共享文件 owner；
- 能证明本次改动的最小测试与回滚方式。

不确定实现细节时，选择最小、可逆、能被测试证伪的纵向切片；不确定产品方向、
契约、权限或数据解释时，任务保持 `BLOCKED` 并提交决策/CCR 请求。

## 2. 建立隔离工作区

```powershell
& .\scripts\repo\new-worktree.ps1 `
  -TaskId <task-id> `
  -Branch task/<id>-<slug> `
  -BaseRef <exact-base-commit>
```

任务元数据应先形成一个小提交，使开工时工作区可验证为干净。进入 worktree 后：

```powershell
& .\scripts\repo\task-context.ps1 -Mode auto
```

脚本自动匹配当前 branch 的 active task。PLANNED 且干净时调用 preflight；任务已有
改动或处于 IN_PROGRESS/READY_FOR_REVIEW/BLOCKED 时调用 resume，并输出 handoff
和实时 Git 现场。每次恢复任务都重复运行同一命令，不要求用户重新发送上下文。

## 3. 实现与最小测试

- 只读任务 JSON、开发短契约和 `context.required`；
- 只修改 `allowed_paths`；
- 先验证当前代码事实，再复用现有模型、API 和执行器；
- 每次只闭合一个用户动作，不顺手扩展旁支；
- 最小测试是最小的反证集，不是“能启动”或“HTTP 200”；
- 功能 owner 跑局部验证，Integration Lead 在合并窗口跑跨任务/全量验证。

风险升级规则见 `AI-DEVELOPMENT-CONTRACT.md`。实际命令、结果和通过数量写入
`test_evidence`，失败或跳过必须原样记录。

## 4. 自审、提交与推送

从 `templates/HANDOFF.template.md` 创建 handoff，并用
`prompts/REVIEW-PROMPT.md` 检查 `base_commit...HEAD` 与当前未提交差异。

```powershell
& .\scripts\repo\task-gate.ps1 -Mode review -TaskFile <task-json>
git add -- <allowed-paths>
git commit -m "<type>(<scope>): <outcome>"
& .\scripts\repo\task-gate.ps1 -Mode finish -TaskFile <task-json>
git push -u origin <task-branch>
```

只有任务明确授权推送时才执行最后一条命令。finish 必须证明：

- 所有改动在白名单内；
- 必要 CCR 和 handoff 存在；
- 每项最小测试都有 `PASS` 证据；
- 分支至少领先基线一个提交；
- `git status --porcelain` 为空。

## 5. 分支与集成职责

- `main`：已验证、可部署基线，不直接开发；
- `integration/<mvp>`：同一时间只保留一条活动集成线；
- `task/<id>-<slug>`：单个纵向任务；
- `hotfix/<id>`：生产紧急修复。

OpenAPI、Prisma、根依赖、CI、全局路由和 UI token 采用单写者。两个任务争用同一
共享文件时，先建共享前置任务。

Integration Lead 按“共享事实 → 后端提供者 → 前端消费者 → E2E”合并。失败时用
新修复提交，不重写共享历史。验收后更新 `CURRENT.md`，把任务移入
`tasks/completed/`，再删除干净 worktree。
