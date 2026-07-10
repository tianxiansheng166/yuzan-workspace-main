# 页面流并发提示词模板

你负责指定页面流。先读取整个设计包。

输入参数：

```text
STREAM_NAME=<teacher|student|assessment|public-admin>
ROUTES=<明确路由>
ALLOWED_PATHS=<明确路径>
BASE_COMMIT=<提交>
BRANCH=<分支>
WORKTREE=<路径>
```

要求：

- 继承已批准 Token、AppShell 和视觉组件；
- 不新建第二套色板；
- 不修改其他页面流；
- 不修改后端；
- 保留真实业务状态；
- 优先完成全部路由，不为每个小页面单独请求审查；
- 每个路由提供三视口证据；
- 记录卡片数量和使用理由；
- 完成后统一提交。

返回 `FRONTEND_STREAM_READY`。
