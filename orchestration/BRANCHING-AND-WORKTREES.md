# 分支与 Worktree

## 分支

- `main`：受保护、可部署；
- `integration/<wave>`：可选波次集成；
- `task/<id>-<slug>`：单任务；
- `hotfix/<id>`：生产紧急修复。

禁止 AI 在同一工作目录频繁切分支。一个任务一个 worktree。

## 提交

格式：

```text
<type>(<scope>): <summary>

Task: WEB-001
Contract: unchanged
Tests: pnpm --filter web test
```

类型：feat/fix/test/docs/refactor/chore/migrate/design。

## 合并

- 默认 squash；
- 数据迁移/重要调试历史可保留；
- owner 不自批；
- 合并后删除 worktree 和远程任务分支；
- Contract Owner 更新任务依赖和生成物。
