# P0 多路线控制面 Bootstrap

- Control branch: `integration/p0-multitrack-001`
- Initial checkpoint: `7cd3b1a8f19a9536ae2a97ce917b39867e0b654b`
- Accepted planning task: `P0-MULTITRACK-CLOSURE-PLAN-001`
- Accepted planning branch: `task/p0-multitrack-closure-plan-001`
- Accepted remote HEAD: `7cd3b1a8f19a9536ae2a97ce917b39867e0b654b`

## 已完成

- 从规划任务的远端完整 HEAD 创建唯一 integration sibling worktree；
- 在 control branch 接受规划任务，未写回 task branch；
- 将 control status 置为 `ACTIVE`；
- 登记规划 commit 为初始 checkpoint；
- 解锁 `P0-AI-TOOL-CONTRACTS-001` 和
  `P0-STUDENT-INDEPENDENT-PRACTICE-001`；
- 保持 `P0-STUDENT-COURSE-SUBMIT-001` 为 `READY_TO_RESUME /
  EVIDENCE_REPAIR`。

## 下一步

1. 可同时运行 Course Submit evidence repair、AI Tool Contracts 和 Independent
   Practice 三个 Goal；
2. AI Tool Contracts 被接受后，才解锁 Teacher Lesson Plan 和 Tibetan
   Translation Tool；
3. Contracts 与 Course Submit 均接受后按 rank 合入本分支，登记共同 checkpoint，
   再解锁 Video Progress；
4. 不合并 `main`，不把未验证业务任务标记为 accepted/integrated。

## 验证

控制提交推送后运行：

```powershell
& .\project-ops\scripts\validate-multitrack-plan.ps1
& .\project-ops\scripts\resolve-multitrack-task.ps1 `
  -TaskId P0-AI-TOOL-CONTRACTS-001
& .\project-ops\scripts\resolve-multitrack-task.ps1 `
  -TaskId P0-STUDENT-INDEPENDENT-PRACTICE-001
git diff --check
git status --porcelain
```

`current_checkpoint_commit` 必须是远端 control HEAD 的祖先；两个 Goal 的 base 均应
解析为被接受的规划 commit。
