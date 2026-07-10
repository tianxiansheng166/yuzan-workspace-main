# 新项目仓库适配图

## 技术结构

当前新项目是 pnpm monorepo：

- `apps/web`：Nuxt 4 / Vue 3；
- `apps/api`：NestJS；
- `apps/worker`：后台任务；
- `packages/contracts`：OpenAPI 与生成类型；
- `packages/ui`：共享 Vue 组件和 Token；
- `infra/database`：Prisma；
- `design-lab`：设计资产登记；
- `source-materials`：非运行时参考资料。

## 当前前端结构

主要目录：

```text
apps/web/app/
  assets/
  components/app-shell/
  features/
  layouts/
  middleware/
  pages/
```

现有 feature 包含 auth、app-shell、assessment、assignment-builder、classes、
curriculum-studio、learning-player、offline、reports、role-navigation 等。

## 当前页面

当前稳定 integration 已存在：

- `/`
- `/login`
- `/studio`
- `/studio/[draftId]`
- `/teacher/assignments`
- `/teacher/review`
- `/student/today`
- `/student/learning/[activityId]`
- `/assessment`
- `/assessment/reading`
- `/assessment/written`
- `/assessment/history`
- `/assessment/report/*`
- `/reports`
- 以及 teacher-tools、training、products 等既有入口。

创建页面前必须先扫描真实 routes，不得因为设计包写了一个名字就创建重复路由。

## 当前接口风险点

项目已有独立 Auth Web 分支，包含：

- typed API client；
- `/auth/login`；
- `/auth/refresh`；
- `/auth/logout`；
- `/me`；
- cookie/session；
- refresh single-flight；
-多学校选择。

视觉分支不得覆盖或重写这些内容。

当前各业务页面也已有 feature gateway、状态机、离线和 unavailable 语义。
视觉重构应迁移模板，不重建第二套状态。

## 当前共享事实

新项目根规则把以下内容视为 shared-owner：

- OpenAPI；
- Prisma schema；
- UI tokens；
- root config；
- CI。

因此 Stream A 修改 Token 必须有明确授权并冻结接口；其他 Stream 只消费。
