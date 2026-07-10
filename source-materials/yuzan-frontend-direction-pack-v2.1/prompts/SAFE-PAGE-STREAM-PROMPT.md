# 页面流安全执行模板

输入：

```text
STREAM_ID=
OWNER=
MACHINE=
BASE_COMMIT=
TASK_BRANCH=
WORKTREE=
ROUTES=
ALLOWED_PATHS=
PROTECTED_PATHS=
RELATED_API_COMMITS=
```

步骤：

1. fetch origin；
2. 验证 exact base；
3. 创建独立 worktree；
4. 读取共同设计文件和本 Stream；
5. 捕获 interface baseline；
6. 定点读取页面、API client、contract 和 tests；
7. 只重构呈现；
8. 跑原业务 tests；
9. 跑 interface verification；
10. typecheck/build/screenshots；
11.普通 commit/push。

禁止 reset、amend、force push、假数据、删除接口和测试。

最终返回：

```text
FRONTEND_STREAM_READY
base/final/remote/status
routes
protected files changed
route manifest comparison
API reference comparison
tests preserved
tests/typecheck/build
screenshots
known debt
```
