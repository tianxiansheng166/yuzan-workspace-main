# 多 AI 并发开发调度中心

本目录把“让多个 AI 同时写代码”变成可控工程流程。并发的目标是缩短等待时间，不是让多个代理同时修改同一套共享文件。

## 1. 角色

- **Integration Lead**：唯一有权解锁任务、批准共享契约、合并到 main。
- **Task Owner AI**：一次领取一个任务，对纵向交付和证据负责。
- **Reviewer AI/人工**：检查领域、契约、安全、UI 或测试，不直接代替 owner 修改整个任务。
- **Product/Domain Owner**：确认业务规则、内容和验收。

## 2. 状态

```text
BACKLOG → BLOCKED → READY → CLAIMED → IN_PROGRESS → IN_REVIEW
                                                ↘ CHANGES_REQUESTED
IN_REVIEW → MERGED → VERIFIED → DONE
```

只有 Integration Lead 可以把任务改为 `READY`、`MERGED`、`DONE`。

## 3. 开工流程

1. 查看 `task-board.csv`。
2. 确认依赖均为 `DONE` 或任务说明允许 mock。
3. 复制任务 JSON 中的 `branch` 和 `worktree`。
4. 在任务记录中填写 owner、时间和基线 commit。
5. 阅读 `AI-COLLABORATION-PROTOCOL.md`。
6. 只修改 `allowed_paths`。
7. 需要共享变化时提交 `requests/` 下的变更请求，停止擅自修改。
8. 完成后填写 `handoffs/HANDOFF-TEMPLATE.md`，创建 PR。
9. Reviewer 按 `CODE-REVIEW-RUBRIC.md` 审查。
10. 合并后由 Integration Lead 运行集成和 E2E，更新任务状态。

## 4. 共享文件单写者

以下默认由 Wave 0/Integration Lead 维护：

- `packages/contracts/openapi/openapi.yaml`
- `infra/database/prisma/schema.prisma`
- `packages/ui/src/tokens.css`
- 根 `package.json`、workspace、lockfile
- `.github/workflows/*`
- 认证/权限公共 guard
- 错误码注册表

业务任务不得“顺手修改”。先提交 Contract Change Request。

## 5. 并发波次

- Wave 0：治理、契约、数据、设计和 CI，低并发。
- Wave 1：身份、课程、班级、基础页面，可并行。
- Wave 2：任务、学习、练习、提交、基础离线和视觉资产。
- Wave 3：完整同步、语音、报告、迁移。
- Wave 4：安全、运维、E2E、试点和比赛证据。

详见 `dependency-graph.md` 和 `task-board.csv`。
