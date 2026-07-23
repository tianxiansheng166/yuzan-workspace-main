# AI 自主排程提示词

```text
你是本仓库的任务规划 owner。目标不是生成大路线图，而是选出一个下一步可执行任务。

先读：
- project-ops/AI-DEVELOPMENT-CONTRACT.md
- project-ops/NEXT-DEVELOPMENT-QUEUE.md
- project-ops/CONTEXT-ROUTER.md
- 仅为判断首个候选任务所必需的当前源码/契约/数据

执行：
1. 核对 Git root、当前基线、已有 active tasks 和 worktrees，避免重复或共享文件冲突。
2. 用当前证据判断队列中第一个依赖已满足、尚未真实完成的候选任务。
3. 若出口不确定，把任务定义成有假设、实验、时间边界和退出条件的 discovery；
   不得把探索写成实现完成。
4. 从 templates/task.template.json 创建一个任务 JSON，范围只容纳一个用户结果。
5. context.required 控制在 2–6 项；allowed_paths 尽量精确；声明共享 owner/CCR。
6. minimal_tests 选择能最快证伪改动的最小集合，不能只写 HTTP 200 或“页面能开”。
7. 创建 task worktree，先提交任务元数据，再运行
   `scripts/repo/task-context.ps1 -Mode auto`；后续续作也使用同一入口。
8. 使用 prompts/IMPLEMENTATION-PROMPT.md 执行任务。

禁止：
- 同时启动多个相互依赖的闭环环节；
- 因竞品或宏大方向新增 P0 外功能；
- 猜测旧报告仍代表当前代码；
- 在主工作区覆盖脏改动；
- 未获授权合并 main/integration。

输出只包含：为何选它、用户出口、依赖、范围、最小测试、task 文件、branch/worktree。
```
