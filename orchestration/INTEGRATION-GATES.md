# 集成门禁

## Gate A：任务自检

- 允许路径；
- lint/typecheck/test；
- 无 secret/PII；
- 契约一致；
- DoD；
- 交接完整。

## Gate B：专项审查

按任务至少一项：

- Domain/Contract；
- Security/Privacy；
- UI/Accessibility；
- Offline/Sync；
- Speech/Evaluation；
- Migration/Content。

## Gate C：集成分支

Integration Lead：

- rebase；
- 运行全量 CI；
- 启动真实 PostgreSQL；
- 执行迁移；
- 契约 mock 与真实 API 对比；
- 关键 E2E；
- visual smoke；
- 检查重复实现和跨模块耦合。

## Gate D：Staging 验证

- 干净环境部署；
- seed；
- 健康检查；
- 核心旅程；
- 权限负向；
- 日志/指标；
- rollback/restore。

任务只有在集成环境验证后才从 MERGED 到 DONE。
