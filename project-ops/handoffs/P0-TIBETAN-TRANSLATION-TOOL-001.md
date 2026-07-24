# P0-TIBETAN-TRANSLATION-TOOL-001 Handoff

## Status: BLOCKED

## Blocking Reason

**真实 translation provider 凭据缺失。** 任务要求 "真实 provider 凭据缺失、合同/数据出境未明确或 provider 不支持藏文时，任务如实 BLOCKED"。

具体阻塞条件：
1. `TRANSLATION_PROVIDER_ENDPOINT` 未在 .env 中配置
2. `TRANSLATION_PROVIDER_API_KEY` 未在 .env 中配置
3. 合同/数据出境审批状态不明
4. 需确认 provider 对藏文 (BO) 的支持能力

mock provider 只能证明失败和契约路径，不能把任务标 READY_FOR_REVIEW。

## Completed Work

### 后端核心实现 (steps 1-10 of integration_order)

1. **Prisma schema + migration**: TranslationJob 和 TranslationGlossary 模型，包含 createdByUserId, machineResult, revisedResult, reviewStatus, revision, reviewedByUserId, reviewedAt, glossaryVersion, provider* 元数据字段
2. **Domain types**: 完整的 TranslationJob, GlossaryEntry, TranslationStatus, ReviewStatus, SupportedLanguage 枚举
3. **PrismaTranslationRepository**: 替换 UnavailableTranslationRepository，实现 findJobByIdOnly, updateJobResult, updateJobRevision (乐观并发 + APPROVED 保护)
4. **AES-GCM 加密**: 替换 Base64 伪装加密，使用 TRANSLATION_CRYPTO_KEY 环境管理密钥，响应/日志/evidence 不泄露源文或密钥
5. **Redis/内存限流**: 替换 no-op，实现 TranslationRateLimiterPort
6. **ConfigurableTranslationProvider**: 超时 (AbortController)、认证 (401/403)、quota (429)、重试逻辑、unavailable 分类
7. **TranslationsService**: createdByUserId 绑定 + listMyJobs 用户过滤 + revision 乐观并发 + machineResult 与 revisedResult 分离 + provider retry 不覆盖 APPROVED
8. **DTO + Response**: 匹配 OpenAPI 契约，sanitization 剥离 sourceTextEncrypted 和 provider key
9. **PATCH /revise 和 /approve 端点**: 乐观并发 409，reviewedByUserId/reviewedAt
10. **Worker TranslationConsumer**: BullMQ 消费者，解密→调用 provider→写结果

### 测试

- **45 个单元测试全部通过**:
  - createTranslation (9): TEACHER/STUDENT 创建、跨租户拒绝、暂停用户拒绝、字符上限 5000、同语言拒绝、不泄露加密文本、限流
  - getJobStatus (9): 真实状态、COMPLETED+machineResult、PROVIDER_UNAVAILABLE 无伪造完成、跨租户拒绝、学生 ownership 检查、不泄露加密文本、错误码消毒
  - listMyJobs (3): userId 过滤、跨租户拒绝、暂停用户拒绝
  - listJobs (4): TEACHER/SCHOOL_ADMIN 可列、STUDENT 拒绝、跨租户拒绝
  - reviseJob (3): TEACHER 修订、409 revision mismatch、STUDENT 拒绝
  - approveJob (2): TEACHER 批准、409 revision mismatch
  - rejectJob (1): TEACHER 拒绝
  - fail-closed (5): repository 不可用时所有操作抛 TranslationUnavailableException，不返回伪造完成
  - cross-tenant (1): 所有操作拒绝跨学校
  - PLATFORM_ADMIN (1): 可在任何学校创建
  - rate limiting (2): 限流异常传播
  - error sanitization (4): 不泄露加密文本、不泄露 provider key、消毒未知错误码、保留安全错误码
  - provider retry protection (1): 不覆盖 APPROVED job

### 构建验证

- Prisma validate: PASS (1 warning about onDelete SetNull)
- Prisma generate: PASS (client 7.8.0)
- API typecheck: PASS
- Worker typecheck: PASS

## Remaining Work (unblocked 后)

1. 配置真实 TRANSLATION_PROVIDER_ENDPOINT 和 TRANSLATION_PROVIDER_API_KEY
2. 确认 provider 对藏文 (BO) 的支持
3. 确认合同/数据出境审批
4. 重写前端 script.js: 真实 API 绑定、移除写死'服务正常'和'离线可用'、字符上限、隐私文案
5. 修复前端 index.html: 替换损坏的视觉稿为真实数据绑定
6. 收集完整证据: BO↔ZH 真实 Job、provider metadata、NEEDS_REVIEW→revision→APPROVED、新上下文恢复、跨用户拒绝、unavailable 无 resultText、Unicode/空白/上限/timeout/quota/auth、1440/1024/390 审计
7. 运行完整 E2E 验证
8. task-gate review/finish

## Files Changed

- `infra/database/prisma/schema.prisma`: TranslationJob + TranslationGlossary 模型
- `infra/database/prisma/migrations/20260724_add_translation_review/migration.sql`: 数据库 migration
- `backend/api/src/modules/translations/domain/translation.types.ts`: 新增字段和枚举
- `backend/api/src/modules/translations/domain/translation.errors.ts`: 新增错误类型
- `backend/api/src/modules/translations/translations.service.ts`: 完整业务逻辑重写
- `backend/api/src/modules/translations/translations.controller.ts`: 新增 revise/approve 端点
- `backend/api/src/modules/translations/translations.policy.ts`: ownership 检查
- `backend/api/src/modules/translations/translations.module.ts`: 绑定真实实现
- `backend/api/src/modules/translations/dto/translation.response.ts`: 匹配 OpenAPI
- `backend/api/src/modules/translations/ports/prisma-translation.repository.ts`: Prisma 实现
- `backend/api/src/modules/translations/crypto/aes-gcm.crypto.ts`: AES-GCM 实现
- `backend/api/src/modules/translations/rate-limit/translation-rate-limit.ts`: Redis/内存限流
- `backend/api/src/modules/translations/provider/translation-provider.adapter.ts`: Provider adapter
- `backend/worker/src/translation/translation.consumer.ts`: BullMQ 消费者
- `backend/worker/src/translation/translation-result.writer.ts`: 结果写入器
- `backend/api/test/modules/translations/**`: 45 个测试

## Branch

- Branch: `task/p0-tibetan-translation-tool-001`
- Latest commit: `ad121f6` - feat(translations): update test infrastructure for new domain types
