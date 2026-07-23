# 多路线跟踪、审查与合并 Runbook

本流程中的“已接受”只有一个机器含义：

```text
project-ops/accepted-baselines.json 中存在该 task_id，
acceptance_status 为 VERIFIED 或 INTEGRATED，
commit 是可解析的完整 40 位提交，
且远端 branch HEAD 与记录一致。
```

口头“完成”、task 自称 `READY_FOR_REVIEW` 或仅有远端分支都不等于已接受。
`accepted-baselines.json` 只由 Integration Lead 更新。

调度所用的 registry、accepted baselines、看板和本 runbook 只认远端控制面
`origin/integration/p0-multitrack-001` 的同一完整 commit。规划任务分支只负责提出
初始方案，不在自身分支写入“接受自己”的提交，也不是后续调度事实源。

## 1. 权威控制面与一次性启动

规划任务 review、finish、push 且远端 HEAD 一致后，Integration Lead 执行一次启动：

1. 读取远端规划分支的 handoff 和完整 diff，确认无 P0/P1 finding；
2. 以该远端规划 HEAD 为精确 base，在 sibling worktree 创建
   `integration/p0-multitrack-001`；普通 `new-worktree.ps1` 不支持 integration
   branch，因此使用经过目标路径核对的 `git worktree add -b`；
3. 只在新控制分支把规划任务写入 `accepted-baselines.json`，将 integration status
   改为 `ACTIVE`，并把 `current_checkpoint_commit` 设为规划 HEAD；
4. 提交、推送控制分支，核对远端 HEAD，随后在该 worktree 运行 validator。

专用创建命令：

```powershell
$canonicalRoot = 'D:\program\test_program\yuzanxinsheng\three\yuzan-next'
$controlTarget = 'D:\program\test_program\yuzanxinsheng\three\worktrees\p0-multitrack-integration-001'
$planningBranch = 'task/p0-multitrack-closure-plan-001'
git -C $canonicalRoot fetch origin
$remoteLine = @(git -C $canonicalRoot ls-remote --heads origin $planningBranch)
if ($remoteLine.Count -ne 1) { throw 'Planning remote head is missing or ambiguous' }
$planningCommit = ($remoteLine[0] -split '\s+')[0]
if ($planningCommit -notmatch '^[0-9a-f]{40}$') { throw 'Invalid planning commit' }
if (Test-Path -LiteralPath $controlTarget) { throw "Control target already exists: $controlTarget" }
git -C $canonicalRoot worktree add -b integration/p0-multitrack-001 `
  $controlTarget $planningCommit
```

已有控制 branch/worktree 时只恢复并确认本地 HEAD 等于远端控制 HEAD，不重复创建。
控制面是持续角色：每接受一个任务，就更新接受表；按 `integration_rank` 合入可用
子集；每产生一个同时包含后续任务全部依赖的 merge commit，就在下一个控制元数据
提交中登记为 `current_checkpoint_commit`。不能等全部任务结束后才启动 integration。

## 2. 开工前

任何 Goal 先验证 canonical、branch、worktree、remote 和 status。canonical 有用户
改动时保留原样，只在 sibling worktree 工作。已有目标 worktree 时恢复，不重复创建。

新任务：

1. 在控制 worktree 拉取并核对 `origin/integration/p0-multitrack-001`，从该 commit
   读取 branch、依赖、base strategy 和 prompt；
2. 运行 `validate-multitrack-plan.ps1`，它会核对所有 accepted task 的远端 HEAD；
3. 运行 `resolve-multitrack-task.ps1`。该脚本真实实现四种 base strategy，未接受、
   checkpoint 不含全部依赖或任务不可派发时会失败；
4. 需要创建或恢复 worktree 时显式传 `-CreateWorktree`；
5. 从 `project-ops/templates/task.template.json` 用 `apply_patch` 创建 registry
   指定的 `task_file`，把解析后的 SHA 写入 `base_commit`；
6. 单独提交任务元数据，使 worktree 干净；
7. 第一条开发命令运行：

   ```powershell
   & .\scripts\repo\task-context.ps1 -Mode auto
   ```

可复制的解析/物化命令：

```powershell
$controlRoot = 'D:\program\test_program\yuzanxinsheng\three\worktrees\p0-multitrack-integration-001'
$selectedTaskId = 'P0-AI-TOOL-CONTRACTS-001'
git -C $controlRoot fetch origin
$localControlHead = (git -C $controlRoot rev-parse HEAD).Trim()
$remoteControlHead = ((git -C $controlRoot ls-remote --heads `
  origin integration/p0-multitrack-001) -split '\s+')[0]
if ($localControlHead -ne $remoteControlHead) { throw 'Control worktree is not at remote HEAD' }
& "$controlRoot\project-ops\scripts\resolve-multitrack-task.ps1" `
  -TaskId $selectedTaskId `
  -CreateWorktree
```

恢复任务直接运行同一命令，不要求用户重新附文件。

## 3. 实现检查点

每个检查点必须是可验证子结果，不以“写了多少文件”衡量。先跑最快反证测试，再决定
是否进入下一步。中断时更新 task JSON/handoff，保留真实失败，不为保持绿色删除
证据。

以下情况立即停止写入并置 `BLOCKED`：

- 精确 base 不能解析；
- 依赖未满足；
- 必须修改另一个任务持有的共享事实；
- 需要改变权限、schema、provider 数据出境或生产状态但没有已批准决策；
- 发现他人未提交工作与本任务路径重叠；
- live provider 或必要运行环境缺失，且 mock 无法证明用户结果。

状态同步顺序：Task Owner 先在 task JSON 把 execution status 置 `BLOCKED`，并在
handoff 写清阻塞证据和解除条件；Integration Lead 随后在控制分支把
`dispatch_status` 同步为 `BLOCKED`。解除后由 Integration Lead 恢复
`READY_TO_RESUME`，Task Owner 再把任务恢复为 `IN_PROGRESS`。Task Owner 不直接
修改控制分支的 accepted/evidence/integration 状态。

## 4. Task Owner 自审

完成前：

```powershell
$taskFile = 'project-ops/tasks/active/P0-AI-TOOL-CONTRACTS-001.json'
$task = Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8 | ConvertFrom-Json
& .\scripts\repo\task-gate.ps1 -Mode review -TaskFile $taskFile
git diff --check "$($task.base_commit)...HEAD"
git status --short
```

必须审查：

- `base...HEAD`、staged、unstaged、untracked 的全部差异；
- changed paths 与 allowed_paths；
- shared owner/CCR；
- 固定 ID、fixture provider、静态业务结果、假成功；
- tenant/resource/user scope；
- 相关失败、offline、processing、provider unavailable；
- evidence 是否可复跑并且不含秘密或真实学生数据；
- handoff 是否记录命令、数量、限制和回滚。

## 5. Reviewer 门禁

Reviewer 先只读，不修改代码：

```powershell
& .\scripts\repo\task-context.ps1 -Mode resume
```

完整 reviewer 规则位于 `project-ops/prompts/REVIEW-PROMPT.md`。

按 P0–P3 报告具体 findings。以下任一项直接拒收：

- 用户结果没有真实成立；
- OpenAPI/DTO/client 或 Prisma/runtime 漂移；
- 越权读取、跨学校泄露、Job/草稿/译文归属错误；
- 用 mock、API link、空 Blob、直接 seek、固定 ID 冒充 live；
- 测试命令或证据文件不存在；
- handoff/任务 JSON/本地 HEAD/远端 HEAD 互相矛盾；
- Git 不干净或 finish 未通过。

修复使用新提交，不 rebase/force-push 已共享历史。

## 6. 提交与推送

先用 `git diff --name-only`、`git diff --cached --name-only` 和 `git status --short`
得到完整清单，再由 Task Owner 把已经逐项核对且位于 allowed paths 的实际路径显式
传给 `git add --`。提交说明必须写本任务真实用户结果；不要把示意占位符复制进
PowerShell。

```powershell
$taskFile = 'project-ops/tasks/active/P0-AI-TOOL-CONTRACTS-001.json'
$task = Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8 | ConvertFrom-Json
& .\scripts\repo\task-gate.ps1 -Mode finish -TaskFile $taskFile
git push -u origin $task.branch
git status --porcelain
git rev-parse HEAD
git ls-remote --heads origin $task.branch
```

最后一条 status 必须无输出，本地和远端必须是同一完整 commit。推送不等于合并。

## 7. 集成顺序

唯一活动集成线不是普通 active task，不使用 task branch 或 task-gate：

```text
integration/p0-multitrack-001
```

首次创建前由 Integration Lead 核实当前接受基线，不从 canonical 脏工作区猜测。
整个任务分支一次性合并，不能把一个 task branch 的 Prisma、worker、页面拆成三次
选择性合并。任务级优先顺序以 registry 的 `integration_rank` 为唯一事实：

1. `P0-AI-TOOL-CONTRACTS-001`；
2. `P0-STUDENT-COURSE-SUBMIT-001`；
3. `P0-STUDENT-INDEPENDENT-PRACTICE-001`；
4. `P0-TEACHER-AI-LESSON-PLAN-001`；
5. `P0-TIBETAN-TRANSLATION-TOOL-001`；
6. `P0-STUDENT-COURSE-VIDEO-PROGRESS-001`；
7. `P0-STUDENT-COURSE-VIDEO-NOTE-001`；
8. `P1-TIBETAN-BILINGUAL-COURSE-001`。

未就绪任务可以跳过；以后补入较低 rank 时，必须重跑所有受影响 consumer。一个任务
内部仍应按“schema/契约 → provider → worker → 页面 → E2E”实现和验证。

Contracts 与 Course Submit 都接受后，应立即按顺序合入并登记共同 checkpoint，
然后 Video Progress 才可派发。Translation Tool 与 Video Note 都接受并进入同一
checkpoint 后，Bilingual 才可派发。checkpoint 必须是远端 integration branch 的
祖先，且每个 `depends_on` 的 accepted commit 都是 checkpoint 的祖先。

每次合并前：

```powershell
git fetch origin
$taskBranch = 'task/p0-ai-tool-contracts-001'
git merge --no-ff --no-edit "origin/$taskBranch"
```

发生冲突时中止该次合并，先判断 owner 和契约，不以“ours/theirs 全选”解决。

## 8. 分层复验

### 每个任务合入后

- 任务自己的 focused tests；
- 相关 OpenAPI/DTO/client 或 Prisma validate；
- 相关 API/worker/frontend tests；
- `git diff --check` 和 secret scan；
- 一条 live smoke。

### 每合入 2–3 个任务后的硬化窗口

- Node 24 / 仓库 pnpm 版本确认；
- contracts validate；
- database generate/validate；
- API、worker、frontend typecheck/build；
- 相关全包测试，并记录既有 lint 基线问题；
- 登录、学生课程/练习、教师 AI、翻译工具跨页面 smoke；
- 1440/1024/390；
- console/page/request/HTTP 错误审计。

### 最终试点门禁

- 所有目标任务为 `INTEGRATED`；
- 动态 ID 的浏览器/API/DB/provider 证据链完整；
- 新浏览器上下文验证持久化；
- provider unavailable 不产生假结果；
- 课程原文在翻译不可用时仍可学习；
- integration Git 干净、远端 HEAD 一致；
- `CURRENT.md`、看板、任务状态和 handoff 同步；
- main 的合并或快进由用户/Integration Lead 单独授权。

## 9. 回滚

- 单任务业务回归：revert 该任务 merge commit；
- migration：先按 CCR 中的向后兼容/回滚步骤处理数据，再 revert；
- provider 故障：关闭对应 provider/consumer，保留明确 unavailable，不切换假结果；
- 前端 consumer 回归：回退页面任务，不回退已经被其他 consumer 使用的共享契约；
- 不使用 `git reset --hard`、强推或删除用户工作区作为回滚方式。
