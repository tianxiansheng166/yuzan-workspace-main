# AI 上下文加载规则

## 目标

避免执行者一次读取整个仓库、全部历史文档和所有页面，导致上下文浪费、遗忘设计目标和误改他人文件。

## 必读：最多 6 个共同文件

1. `00-READ-FIRST.md`
2. `AGENTS.md`
3. `machine/design-contract.json`
4. `machine/design-tokens.json`
5. `implementation/visual-reference-usage.md`
6. 自己的 `streams/STREAM-*.md`

## 必看图片

每个 Stream 文件会列出 2–5 张 PNG。图片是页面结构和艺术方向的主要事实源，文字用来解释不能从图片看出的状态、交互和工程边界。

## 项目代码读取限制

执行者只应读取：

- 自己拥有的页面；
- 这些页面直接引用的 components/features/composables；
- 相关 API client；
- 对应 OpenAPI operation 或 TypeScript contract；
- 对应测试；
- AppShell 和 Token 的公共接口。

不得为了“了解项目”递归读取：

- 全部 docs；
- 全部后端模块；
- 全部迁移；
- 其他角色页面；
- 历史审查报告；
- 旧项目所有源码。

## 定点搜索

优先：

```bash
rg -n "route-name|operationId|gateway-name|feature-name" apps/web packages/contracts apps/api/src/modules/<related>
```

先看调用链，再打开具体文件。

## 上下文摘要

每个执行者开始开发前，在自己的任务报告中写一个不超过 40 行的摘要：

```text
routes owned：
existing API clients：
backend readiness：
shared components used：
visual references：
conflicting files：
implementation plan：
```

这个摘要代替重复读取全项目。

## 上下文更新

开发过程中只在发生以下情况时重新读取远程信息：

- integration base 更新；
- 相关 API contract 更新；
- shared Token/AppShell 负责人完成合并；
- integration controller 通知冲突。

不要每隔几十分钟 pull 全仓库。
