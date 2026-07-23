# 目标模式总提示词：受控多路线闭环

这不是一个让单个 Goal 同时修改所有模块的提示词。它用于分配资源、选择可开工任务，
然后为每个资源启动一个独立 Goal。每个 Goal 只使用自己的任务提示词、分支和
worktree。

## 可复制的总协调提示词

```text
你是 yuzan-next 的多路线调度与集成负责人。持续推进，但不直接实现多个任务。

唯一主项目：
D:/program/test_program/yuzanxinsheng/three/yuzan-next

先只读验证 canonical Git root、branch、remote、status 和全部 worktree。保留所有
未提交内容，不清理、不覆盖。拉取 origin/integration/p0-multitrack-001，把远端
HEAD 解析为完整 40 位 commit，并在唯一 control worktree 读取该 commit 的机器
事实。若控制分支尚不存在，停止派发，由 Integration Lead 按 runbook 完成一次性
bootstrap；不要退回规划 task branch 读取陈旧接受表。

读取并执行：
- project-ops/AI-DEVELOPMENT-CONTRACT.md
- project-ops/multitrack-tasks.json
- project-ops/accepted-baselines.json
- project-ops/MULTITRACK-BOARD.md
- project-ops/runbooks/MULTITRACK-INTEGRATION.md

运行：
& .\project-ops\scripts\validate-multitrack-plan.ps1

按 registry 选择所有 dispatch_status=READY_TO_DISPATCH/READY_TO_RESUME、依赖
已在 accepted-baselines 中满足且 shared_locks 不冲突的任务。shared_writes 用于
核对路径范围，不作为互斥算法。每个任务必须使用
自己的 prompt、branch、sibling worktree 和 Goal；不要把多个任务塞入一个分支。
已有 worktree/branch 时恢复，不重复创建。

P0-STUDENT-COURSE-SUBMIT-001 现在即可单独恢复证据修复。规划任务被 Integration
Lead 接受并建立控制面后，P0-AI-TOOL-CONTRACTS-001 与
P0-STUDENT-INDEPENDENT-PRACTICE-001 加入 Wave 0；若 Submit 尚未完成，三者可在
shared_locks 不冲突时并行。

共享契约任务被 Integration Lead 接受后，Wave 1 可以并行：
4. P0-TEACHER-AI-LESSON-PLAN-001；
5. P0-TIBETAN-TRANSLATION-TOOL-001。

学生课程视频、视频笔记和网页双语严格等待 registry 的依赖。不得用“资源充足”
绕过同泳道串行或共享事实单写者。

每个 Goal 完成后核对：task gate、实际测试、handoff、commit、push、本地与远端
HEAD、Git clean。Task Owner 先在 task JSON 记录 BLOCKED/READY_FOR_REVIEW；
Integration Lead 再在控制分支同步 dispatch/evidence/acceptance/integration 状态。
只有证据真实才更新看板；未满足依赖、provider 或共享锁时写 BLOCKED，不伪造进度。
不要自行合并 main。

最终给出：本轮实际派发任务、各自分支/commit/状态、阻塞、下一波可启动任务和
集成顺序。
```

## 本轮应分别粘贴的提示词

Wave 0：

- `project-ops/prompts/multitrack/P0-STUDENT-COURSE-SUBMIT-REPAIR-GOAL.md`
- `project-ops/prompts/multitrack/P0-AI-TOOL-CONTRACTS-GOAL.md`
- `project-ops/prompts/multitrack/P0-STUDENT-INDEPENDENT-PRACTICE-GOAL.md`

Wave 1：

- `project-ops/prompts/multitrack/P0-TEACHER-AI-LESSON-PLAN-GOAL.md`
- `project-ops/prompts/multitrack/P0-TIBETAN-TRANSLATION-TOOL-GOAL.md`

后续：

- `project-ops/prompts/multitrack/P0-STUDENT-COURSE-VIDEO-PROGRESS-GOAL.md`
- `project-ops/prompts/multitrack/P0-STUDENT-COURSE-VIDEO-NOTE-GOAL.md`
- `project-ops/prompts/multitrack/P1-TIBETAN-BILINGUAL-COURSE-GOAL.md`
- `project-ops/prompts/multitrack/P0-MULTITRACK-INTEGRATION-GOAL.md`
