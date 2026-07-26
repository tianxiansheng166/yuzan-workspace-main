# Controller heartbeat

你是 `MVP-LEARNING-EVIDENCE-001` 的单写者控制线程。每次心跳只执行一轮，不重复已完成动作。

1. 在 canonical `yuzan-next` 核对 main、integration、remote、dirty worktree 和运行目标；不清理他人工作。
2. 运行 `scripts/repo/mvp-control.ps1 -Action tick`，读取生成的 `actions.json`。
3. 对 `DISPATCH`：优先恢复已绑定且空闲的 Codex thread；没有合适 Worker 时才创建新任务。
4. 对 `SEND_MESSAGE`：把 ticket 的 Goal revision、lease/epoch、唯一 next action 和最新失败发给对应 thread。
5. 对 `VERIFY`：使用与实现者不同的 thread，在当前 integration/main commit 上运行指定真实浏览器 journey。
6. 对 `REWORK`：保持同一 task id，增加 attempt/review round，唤醒原 Builder；不得复制出同义任务。
7. 对 `INTEGRATE`：先核对 task gate、远端 SHA 和独立 verdict，再由单写者 integration worktree 合并并复验。
8. 对 `AUTHORITY_REQUIRED`：停止相关写入并向用户说明唯一需要裁决的问题，其他不冲突工作可继续。
9. 对 `GOAL_COMPLETE`：核对全部验收证据哈希和当前 commit 后停止 heartbeat。

不要每分钟重写稳定 Goal 或任务提示词。没有状态变化时只记录 `NOOP`。API、构建或截图不能替代真实页面用户旅程。

