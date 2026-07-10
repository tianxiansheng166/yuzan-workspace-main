# Stream A：Foundation 与公共首页

## 负责

- `packages/ui` 获明确授权后的 semantic tokens；
- AppShell 呈现；
-角色导航呈现；
-首页；
-共享 Button、Status、Notice、PageHeader；
-Contour/Path/Sound 等纯视觉组件；
-品牌资产和资源登记。

## 不负责

- login/select-school 的 API 与 session；
-auth ports/adapters/state；
-middleware/plugins；
-curriculum/assignment/learning/assessment 状态；
-后端；
-contract；
-database。

## 与原 ACC_UI-001

必须继续使用原 `task/acc-ui-001-app-shell`，不得新建第二个 Foundation 分支。

若原 worktree 有成果：

-先 commit/push；
-merge design-pack exact commit；
-追加正常提交；
-不 reset/rebase/amend。

## 共享文件授权

开始前必须得到明确 scope：

```text
packages/ui/src/tokens.css
packages/ui/src/base.css
apps/web/app/components/app-shell/**
apps/web/app/layouts/**
apps/web/app/pages/index.vue
apps/web/app/features/brand/**
apps/web/app/features/role-navigation/**  # presentation only
apps/web/app/assets/**
apps/web/public/art/**
design-lab/**
```

不允许改 role-navigation 的业务状态/授权来源。

## 冻结输出

返回：

- semantic token names；
-AppShell slots/props；
-navigation presentation contract；
-Button/Status/Notice/PageHeader public props；
-asset path contract；
-final exact commit。

其他流只能使用这些接口，不能各自改 Token。
