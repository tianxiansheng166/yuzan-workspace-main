# Stream B：教师页面视觉迁移

## 路由

- `/studio`
- `/studio/[draftId]`
- `/teacher/assignments/**`
- `/teacher/review/**`
-已有教师报告路由

## 只改呈现

允许：

- page template；
-feature presentation components；
-page styles；
-accessibility；
-responsive；
-visual assets；
-必要的 presentation tests。

保护：

- curriculum/assignment/submission gateways；
-ports/adapters/state；
-auth/session；
-route middleware；
-contract types；
-业务 tests。

## 冲突规则

若页面已被 API owner 修改，必须从包含该 commit 的 frontend integration exact commit 创建。
不要从旧页面复制模板覆盖新逻辑。

## 目标

- studio 三栏工作区；
-assignments 列表/表格/步骤；
-review 三栏证据与反馈；
-真实 401/403/404/409/unavailable；
-不使用卡片墙。

返回 `FRONTEND_STREAM_B_READY`，附接口比较结果。
