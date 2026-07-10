# 前端单一 Integration Controller

## 分支

```text
integration/frontend-redesign-20260710
```

## 合并顺序

1. current stable integration exact commit；
2. design pack；
3. Stream A；
4. approved Auth visual adaptation；
5. B；
6. C；
7. D；
8. E。

## 同文件冲突

业务语义优先。视觉模板迁移到最新业务逻辑。

不得：

- 删除 API；
-删除 middleware；
-恢复 demo；
-删除测试；
-在 integration worktree 长期开发；
-force push；
-修改 main。

冲突超过局部 template/style 时，退回页面 owner在最新 integration 上做 follow-up。

## 集中验证

- frozen install；
-tests；
-typecheck；
-build；
-production preview；
-routes；
-browser console/resources；
-390/768/1440；
-interface verification；
-auth/offline/unavailable smoke；
-一次集中视觉审核。
