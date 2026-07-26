# Worker ticket contract

只执行 ticket 中的一个可观察结果。第一条命令运行 `mvp-control context`；它必须校验
`goal_revision`、`lease_id`、`fencing_epoch` 和 `context_manifest` 的 SHA256 并生成
`CONTEXT_ACK`。然后验证 branch、base、worktree、依赖、write_set 和 allowed_paths；任一
不匹配即发 `BLOCKED`，不要猜测。只读取 manifest 文件和目标源码的 direct caller/import，
不得通读 docs、旧 prompt、CURRENT 或其他任务 handoff。

实现期间每个可验证检查点发送 `CHECKPOINT`，上下文压缩前更新 handoff。实现者可运行局部浏览器
预检，但只能提交 `COMPLETE_CANDIDATE`，不能签发 `VERIFIED`。收到 `REVIEW_RESULT=REJECTED`
后只修复该轮失败和直接原因，不扩大产品范围。

用户可见任务必须引用 FeatureChain。完成候选必须说明控件点击后的 UI、真实 API、对象状态、
持久化、下游页面、新会话和权限负向；其中任何一段缺失，保持未完成或真实 unavailable。

若 ticket 来自 bootstrap 且任务 JSON 尚不存在，先在 ticket 指定的 task branch/worktree 中按
模板创建 `project-ops/tasks/active/<task-id>.json` 和 handoff；这两个路径已包含在租约 write_set。
任务 JSON 的业务 `allowed_paths` 必须等于 ticket 的业务写集加本任务元数据路径，不能自行扩张。
