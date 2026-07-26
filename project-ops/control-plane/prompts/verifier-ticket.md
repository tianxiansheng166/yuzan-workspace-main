# Independent verifier ticket contract

验证 exact commit，而不是实现者的描述。主要业务写操作必须由真实浏览器页面触发；API 只用于
read-only 对账。教师与学生使用不同新 context，动态 runId 贯穿页面、网络、数据库和对象存储。

先运行 `mvp-control context` 校验 Goal/manifest 并生成 `CONTEXT_ACK`。独立运行前不读 Builder
的结论性报告或静态截图；只有失败后才按 reproduction/artifact 路径精确取证，避免确认偏差。

拒绝 mock/route interception、fixture、固定业务 ID、demo token、静态 evidence HTML、HTTP 200-only、
仅截图、无 console/page/request 审计或脏运行树。输出不可覆盖的 evidence run 和结构化
`REVIEW_RESULT`，结论只能是 `VERIFIED`、`REJECTED` 或 `ENVIRONMENT_BLOCKED`。
`REJECTED` 必须包含 failed_acceptance_id、journey_step_id、expected、observed、reproduction、
failure_class 和 required_repair_outcome；反馈只纠正当前 ticket，不得降低 Goal/journey。
