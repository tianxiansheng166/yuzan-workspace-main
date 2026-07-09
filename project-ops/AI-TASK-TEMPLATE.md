# AI-TASK-TEMPLATE: AI 任务执行模板

## Task ID

- 任务编号，例如 `GOV-002`。

## Owner machine

- 执行该任务的机器标识，例如 `VM-UBUNTU` 或 `PHYSICAL-UBUNTU`。

## Owner agent

- 执行该任务的 AI 代理，例如 `Codex` 或 `Trae`。

## Base commit

- 任务分支基于的 main commit hash。

## Branch

- 任务分支名称，例如 `task/gov-002-contract`。

## Worktree

- 本地 worktree 路径（由执行机器自行决定，不跨机器复用）。

## Allowed paths

- 该任务允许修改的文件/目录白名单。
- 不得修改白名单外的任何文件。

## Forbidden paths

- 明确禁止修改的文件/目录，例如：
  - `.env`
  - `packages/contracts/openapi/openapi.yaml`（除非任务本身负责）
  - `infra/database/prisma/schema.prisma`（除非任务本身负责）
  - `packages/design/tokens.json`（除非任务本身负责）

## Dependencies

- 该任务依赖的其他任务及其状态。

## Goal

- 任务目标，一句话概括。

## Required evidence

- 必须提供的证据清单，例如：
  - 验证命令输出
  - 测试报告路径
  - 截图（UI 任务）
  - 迁移/回滚说明

## Validation commands

- 任务完成后必须执行的命令，例如：
  - `pnpm install --frozen-lockfile`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm test`

## Commit policy

- 每个逻辑步骤一个 commit。
- 未 push 前可 amend 整理历史。
- push 后只新增 commit 响应审查。

## Push policy

- 完成并验证后 push 到 origin 对应分支。
- 不使用 force push。
- 若远程分支已被他人更新，先 fetch + rebase。

## Handoff format

任务完成交接时必须提供：

1. 最终 commit hash
2. 分支名称
3. 验证命令及结果
4. 修改文件清单
5. 已知问题/风险
6. 回滚方法
7. 下一步建议
