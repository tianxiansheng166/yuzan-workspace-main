# ADR-0002：Contract-first OpenAPI

状态：Accepted

## 决策

HTTP API 以 OpenAPI 3.1 为共享事实源，前端类型、mock 和契约检查由其产生。

## 理由

多 AI 并行开发时，口头约定和手写重复 DTO 极易漂移。先冻结契约可让前后端并行，并通过 breaking-change 检查控制集成风险。

## 后果

- 共享契约有单一 owner；
- 任何变化走变更请求；
- 实现必须通过契约测试；
- OpenAPI 不取代内部领域模型。
