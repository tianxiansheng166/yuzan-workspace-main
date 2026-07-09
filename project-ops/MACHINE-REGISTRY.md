# MACHINE-REGISTRY: 机器注册表

## VM-UBUNTU

- **角色**：当前集成总控
- **main 操作者**：是
- **Codex**：现有任务（GOV-003、GOV-004、MIG-001）
- **Trae**：现有任务（GOV-001、GOV-002）
- **职责**：
  - 维护 main 分支的完整历史；
  - 执行 fast-forward 合并；
  - 创建快照 tag；
  - 推送所有 task 分支到 GitHub；
  - 生成项目运营真源文档。

## PHYSICAL-UBUNTU

- **角色**：新增开发节点
- **main 操作者**：否
- **Codex**：待分配
- **Trae**：待分配
- **职责**：
  - 从 GitHub clone 仓库；
  - 独立创建本地 worktree；
  - 领取 READY 状态任务；
  - 完成任务后 push 到 origin 并在 TASK-REGISTRY.yaml 登记。

## 注册规则

1. 每台机器必须有唯一标识。
2. 一个任务只能有一个 ownerMachine 和一个 ownerAgent。
3. main 分支的写操作只能由 VM-UBUNTU 执行，除非通过正式的集成总控交接。
4. 新机器加入前，必须确认已阅读 `MULTI-MACHINE-PLAYBOOK.md` 和 `AI-TASK-TEMPLATE.md`。
