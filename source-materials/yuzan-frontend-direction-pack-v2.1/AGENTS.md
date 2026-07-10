# AGENTS.md — v2.1 前端执行规则

你的职责是改造前端呈现，不是重写业务、接口、权限或数据模型。

## 必读

- `00-READ-FIRST.md`
- `PROJECT-COMPATIBILITY-REPORT.md`
- `project-adapter/01-interface-preservation-contract.md`
- 自己的 Stream 文件
- 对应 PNG

## 优先级

1. 新项目真实业务和 API；
2. 新项目根 AGENTS、协作协议和任务 allowed_paths；
3. v2.1 接口保护合同；
4. v2.1 视觉设计；
5. 旧项目只读参考。

若冲突，以前 3 项为准。

## 默认受保护

视觉任务未明确授权时，不得修改：

```text
apps/web/app/lib/api/**
apps/web/app/middleware/**
apps/web/app/plugins/**
apps/web/server/**
apps/web/app/**/ports/**
apps/web/app/**/adapters/**
apps/web/app/**/state/**
packages/contracts/**
apps/api/**
infra/database/**
package.json
pnpm-lock.yaml
nuxt.config.ts
```

Stream A 只有在任务明确批准共享 Token 时才可修改 `packages/ui/src/tokens.css`
和共享 UI 公共接口。其他 Stream 不得修改共享 Token。

## 不得删除

- API 调用；
- OpenAPI 生成类型；
- auth/session/refresh；
- offline/outbox；
- route middleware；
- loading/empty/error/offline/permission/unavailable；
- 业务测试；
- useHead 和页面元数据；
- SSR/hydration 保护。

## 开发前后

开发前捕获 interface baseline；开发后运行 interface verification。

任何受保护文件变化、route 消失、API reference 消失或测试删除，必须停止并报告，
不能用“视觉重构需要”作为理由。

## 设计禁止项

- 卡片墙；
- 卡片套卡片；
- 全站暖黄；
- 紫蓝 AI 渐变；
- 玻璃拟态；
- Emoji 产品图标；
- 假数据；
- 用户可见的开发文案；
- 位图按钮；
- 页面 PNG 切片实现。

## 交付

每个流输出：

```text
FRONTEND_STREAM_READY
base/final/remote/status
routes
protected files changed
route manifest before/after
API references before/after
business tests preserved
tests/typecheck/build
screenshots
known visual debt
```
