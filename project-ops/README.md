# 项目运行与协作中心

本目录是项目状态、任务、交接和决策的唯一治理入口。

- `AI-DEVELOPMENT-CONTRACT.md`：所有开发任务默认遵守的短契约；
- `CONTEXT-ROUTER.md`：按任务类型选择最小必要上下文；
- `NEXT-DEVELOPMENT-QUEUE.md`：围绕唯一 P0 的顺序执行队列；
- `plans/P0-STUDENT-CLOSED-LOOPS.md`：学生端闭环的事实基线、实施顺序和完成定义；
- `CURRENT.md`：当前可恢复状态，只记录已验证事实；
- `DEVELOPMENT-WORKFLOW.md`：任务、审查和集成流程；
- `tasks/active/`：正在执行的任务 JSON；
- `tasks/completed/`：已合并并验证的任务；
- `handoffs/`：断点与交接；
- `templates/`：任务和交接模板；
- `prompts/`：可直接交给 AI 执行与审查的提示词；
- `prompts/P0-STUDENT-GOAL-MODE-PROMPT.md`：可直接粘贴到目标模式的首个学生闭环任务；
- `decisions/`：稳定架构与产品决策；
- `runbooks/`：本地环境和运维操作手册。

聊天记录、提示词和临时报告不能作为唯一事实来源。

已有任务每次开始或继续时运行：

```powershell
& .\scripts\repo\task-context.ps1 -Mode auto
```

它只加载短契约、当前任务和任务声明的最小上下文，不生成工作区文件。
