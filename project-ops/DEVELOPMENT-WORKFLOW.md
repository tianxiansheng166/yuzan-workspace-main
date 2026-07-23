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

先自动定位当前分支对应的 task JSON 并运行 review：

```powershell
$branch = (git branch --show-current).Trim()
$taskFiles = @(Get-ChildItem .\project-ops\tasks\active -Filter *.json |
  Where-Object {
    (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 |
      ConvertFrom-Json).branch -eq $branch
  })
if ($taskFiles.Count -ne 1) { throw "Task file not unique for $branch" }
$taskFile = $taskFiles[0].FullName
$task = Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8 | ConvertFrom-Json
& .\scripts\repo\task-gate.ps1 -Mode review -TaskFile $taskFile
```

review 通过后，用 `git status --short` 和 `git diff --name-only` 取得完整清单，把逐项
核对过的实际路径显式传给 `git add --`；不使用 `git add -A`，也不复制示意占位符。
确认 staged 清单后填写真实提交说明，再执行：

```powershell
$stagedPaths = @(git diff --cached --name-only)
if ($stagedPaths.Count -eq 0) { throw 'No reviewed paths are staged' }
$commitMessage = Read-Host 'Commit message for the actual user outcome'
if ([string]::IsNullOrWhiteSpace($commitMessage)) { throw 'Commit message is required' }
git commit -m $commitMessage
& .\scripts\repo\task-gate.ps1 -Mode finish -TaskFile $taskFile
git push -u origin $task.branch
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

## 6. 多泳道并行

多路线开发先读取：

```text
project-ops/multitrack-tasks.json
project-ops/MULTITRACK-BOARD.md
project-ops/runbooks/MULTITRACK-INTEGRATION.md
```

并行只发生在依赖已由 accepted baselines 解除且 registry 的 `shared_locks` 不相交
的任务之间；`shared_writes` 用于审查路径边界，不作为字符串相等的互斥算法。每条
泳道内部仍按依赖顺序推进；发现必须写另一个任务持有的共享文件时，将任务置为
`BLOCKED` 并提交 CCR，不以复制契约、页面内硬编码或延后补文档绕过。

每个 Goal 检查点更新自己的 task JSON 和 handoff。Integration Lead 每次收到分支
后在 `origin/integration/p0-multitrack-001` 控制分支更新接受表、看板和 checkpoint，
并在合并 2–3 个任务后安排一次硬化窗口。硬化窗口期间不继续合入新功能，只处理
当前集成线的回归、契约漂移和证据缺口。
