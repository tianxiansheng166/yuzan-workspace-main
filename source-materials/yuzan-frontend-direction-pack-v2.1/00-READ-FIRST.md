# 语赞心声前端设计与安全改造执行包 v2.1

本包服务于新项目仓库 `yuzan-workspace-main`。旧项目 `yuzan-workspace`
只用于品牌、色彩、文化语义和页面经验参考，绝不能成为运行时数据源。

## 安装位置

不要把本包内容散落到 `apps/web`、`packages/ui` 或仓库根目录。

统一安装到：

```text
source-materials/yuzan-frontend-direction-pack-v2.1/
```

原因：

- 新项目的 pnpm workspace 只包含 `apps/*`、`packages/*` 和 `infra/database`；
- `source-materials/` 已被项目的 Prettier 配置排除；
- 设计参考不会被打包到 Web 或 API；
- 两台机器可以通过 GitHub 获得同一 exact commit；
- 每个 worktree 都能读取同一套设计事实源。

## 先读什么

1. `PROJECT-COMPATIBILITY-REPORT.md`
2. `README-USE-IN-PROJECT.md`
3. `project-adapter/00-current-repo-map.md`
4. `project-adapter/01-interface-preservation-contract.md`
5. `project-adapter/02-two-machine-runbook.md`
6. `project-adapter/03-existing-task-relationship.md`
7. 自己对应的 `streams/STREAM-*.md`
8. 对应 PNG 视觉参考

## 最重要的开发规则

```text
视觉重构 != 重写业务
```

视觉任务必须保留：

- API client；
- OpenAPI 生成类型；
- auth/session/refresh；
- route middleware；
- tenant/role 语义；
- loading/empty/error/offline/unavailable；
- future publish、权限和服务不可用等真实状态；
- 现有业务测试。

视觉执行者默认不能修改 `ports`、`adapters`、`state`、`lib/api`、
`middleware`、`plugins`、`packages/contracts` 和后端。

## 开发模式

```text
设计包入库
→ Stream A 冻结视觉基础
→ B/C/D 三路页面并发
→ E 公共/管理第二阶段
→ 单一 integration controller 集中合并
→ 一次全站截图审核
→ 一次集中返工
```

普通前端页面不再逐任务安排完整独立审查。身份、权限、多租户、数据库、
文件边界、隐私和根安全接线仍执行严格独立复审。

## AI 开始编码前必须返回

```text
DESIGN_DIRECTIVE_LOADED=yes
CURRENT_REPO_ADAPTER_LOADED=yes
INTERFACE_BASELINE_CAPTURED=yes
LEGACY_USED_AS_REFERENCE_ONLY=yes
API_CLIENT_PROTECTED=yes
CARD_WALL_DEFAULT=forbidden
GLASSMORPHISM=forbidden
WARM_YELLOW_CANVAS=forbidden
BATCH_REVIEW_MODE=enabled
```
