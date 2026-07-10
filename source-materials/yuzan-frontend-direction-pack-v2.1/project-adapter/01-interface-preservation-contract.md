# 接口与业务语义保护合同

## 目标

前端可以大幅重做 HTML、Vue template、CSS、视觉组件和动效，但不得让已有接口、
权限、状态或错误处理丢失。

## 三层所有权

### 业务语义 owner

拥有：

- API path 和 operation；
- request/response 类型；
- auth/session/refresh；
- tenant/role；
- loading/error/offline/unavailable；
- mutation 和并发；
-数据缓存；
-业务测试。

### 视觉 owner

拥有：

- template；
-布局；
-展示组件；
-CSS；
-动效；
-可访问呈现；
-视觉资产；
-响应式。

### integration controller

负责同一文件冲突。合并原则：

```text
保留最新业务语义
+ 迁移视觉模板
```

不能选择“保留漂亮页面、丢掉真实接口”。

## 受保护路径

默认受保护：

```text
apps/web/app/lib/api/**
apps/web/app/middleware/**
apps/web/app/plugins/**
apps/web/server/**
apps/web/app/**/ports/**
apps/web/app/**/adapters/**
apps/web/app/**/state/**
apps/web/app/**/runtime/**
packages/contracts/**
apps/api/**
infra/database/**
package.json
pnpm-lock.yaml
```

需要修改时必须有单独 scope grant，并由对应业务 owner 复核。

## 必须保留的页面行为

- SSR；
- useHead/title；
- route params；
- auth guard；
- school selection；
- 401 refresh；
- 403/404 归一化；
- 409 冲突；
- service unavailable；
- offline saved / pending sync / sync failed；
- loading；
- empty；
- permission；
- future publish 不可见；
- session 过期；
-提交失败不显示成功。

## 开发前快照

必须保存：

- pages route manifest；
- API endpoint 字面引用；
- contract imports；
- protected file hashes；
-现有测试文件；
- middleware/plugins；
- feature ports/adapters/state 文件。

## 开发后判断

允许：

- API 引用增加；
- route 明确新增；
- protected paths 未变；
- 业务测试增加。

阻塞：

- route 无授权消失；
- endpoint 引用消失；
- contract import 消失；
- protected file被修改；
-业务测试被删除；
- unavailable 被替换成 fake success；
- middleware/plugin 被移除；
- SSR 变成仅客户端可用。

## 冲突处理

冲突过大时不要在 integration worktree 直接重写页面。

正确流程：

1. integration controller 保留业务 commit；
2. 页面 owner 从最新 integration 创建兼容 follow-up；
3. 页面 owner重新迁移视觉；
4.测试通过后再 merge。
