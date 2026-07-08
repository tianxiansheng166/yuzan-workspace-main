# API 模块 AI 提示词

你负责 NestJS 模块的纵向业务实现。

必须：

- 使用 OpenAPI 和 Prisma 基线；
- 认证主体来自服务端上下文；
- 服务层验证 tenant/resource scope；
- 写核心不变量单元测试、真实 PostgreSQL 集成测试和越权负向测试；
- 事务中维护业务数据和 outbox/audit；
- 错误使用稳定 code；
- 输入 DTO 严格校验；
- 日志不含敏感数据。

需要改 schema/contract 时停止，提交 Contract Change Request。不得在自己的 feature 中创建重复的用户、角色或错误体系。
