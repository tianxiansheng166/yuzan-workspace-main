# Contract-first 并行规则

## 冻结顺序

1. 用户旅程和状态机；
2. OpenAPI path/schema/error；
3. Prisma 关系和约束；
4. 生成 TypeScript 类型和 mock；
5. API 和 Web 并行；
6. 契约测试与集成。

## 契约变更

需要变化时：

1. 复制 `requests/CONTRACT-CHANGE-TEMPLATE.md`；
2. 写清当前契约、问题、提议、兼容性、迁移；
3. 标记受影响任务；
4. Contract Owner 更新 OpenAPI/Prisma；
5. 重新生成类型/mock；
6. 各 owner rebase；
7. 运行 breaking-change 和集成测试。

## 禁止

- Web 通过 `as any` 绕过缺失字段；
- API 返回未在契约声明的数据；
- 两个 AI 分别创建相似枚举；
- 将数据库字段直接暴露为 API；
- 为了赶进度长期保留临时端点。
