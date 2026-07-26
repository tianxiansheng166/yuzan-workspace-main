# 项目运行与协作中心

本目录是项目状态、任务、交接和决策的唯一治理入口。

- `control-plane/goal.json`：当前唯一 P0 Goal、非目标和终止门；
- `control-plane/README.md`：弹性 Worker、租约、反馈重派和上下文恢复入口；
- `control-plane/document-registry.json`：活动规范、参考材料和废止关系；
- `control-plane/inventory/`：全前端控件静态盘点；静态状态不等于功能完成；
- `AI-DEVELOPMENT-CONTRACT.md`：所有开发任务默认遵守的短契约；
- `CONTEXT-ROUTER.md`：按任务类型选择最小必要上下文；
- `NEXT-DEVELOPMENT-QUEUE.md`：历史人工队列，当前只作迁移参考；
- `plans/P0-STUDENT-CLOSED-LOOPS.md`：学生端闭环的事实基线、实施顺序和完成定义；
- `CURRENT.md`：人工历史视图，不是活动调度事实；
- `DEVELOPMENT-WORKFLOW.md`：任务、审查和集成流程；
- `tasks/active/`：正在执行的任务 JSON；
- `tasks/completed/`：已合并并验证的任务；
- `handoffs/`：断点与交接；
- `templates/`：任务和交接模板；
- `prompts/`：旧的一次性提示词默认不自动读取；活动角色提示在 `control-plane/prompts/`；
- `decisions/`：稳定架构与产品决策；
- `runbooks/`：本地环境和运维操作手册。

聊天记录、提示词和临时报告不能作为唯一事实来源。

控制面任务每次开始、继续或上下文压缩后运行：

```powershell
& .\scripts\repo\mvp-control.ps1 -Action context -AgentId <worker-id>
```

只有有效租约才返回动态工作单；工作单再指示是否运行 `task-context.ps1 -Mode auto`。
未登记的 `docs/**` 默认 `REFERENCE_NO_AUTOLOAD`，不能覆盖当前 Goal 或真实运行证据。
