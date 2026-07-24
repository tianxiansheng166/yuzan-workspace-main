# CCR-P0-TIBETAN-TRANSLATION-TOOL-001

## Change Description
实现藏汉翻译工具从 fail-closed 骨架到真实持久化可用状态的完整转换。

## Scope
### Prisma Schema (shared owner: Integration Controller)
- 新增 `TranslationJob` 模型 (id, schoolId, createdByUserId, sourceLanguage, targetLanguage, sourceTextHash, sourceTextEncrypted, status, machineResult, revisedResult, reviewStatus, revision, reviewedByUserId, reviewedAt, glossaryVersion, provider, providerRequestId, providerModel, providerLatencyMs, errorCode, createdAt, updatedAt)
- 新增 `TranslationGlossary` 模型 (id, schoolId, term, sourceLanguage, targetLanguage, translation, category, version, createdAt)
- Migration: `add_translation_review`

### Backend API (translation module owned)
- PrismaTranslationRepository 替换 UnavailableTranslationRepository
- AES-GCM 加密替换 Base64
- Redis 限流替换 no-op
- TranslationProviderAdapter (超时/认证/quota/重试/unavailable)
- Service: createdByUserId + listMyJobs 用户过滤 + revision 乐观并发 + machineResult 与 revisedResult 分离
- PATCH revise 和 PATCH approve 端点
- DTO/Response 匹配 OpenAPI 契约

### Worker (translation owned)
- Translation consumer (BullMQ queue)

### Frontend (translation owned)
- script.js 重写: 真实 API 绑定、移除写死状态、字符上限、隐私文案

## Shared Owner Justification
- `infra/database/prisma/schema.prisma`: 新增模型，不修改现有模型
- `backend/worker/src/main.ts`: 注册新 queue，不修改现有 consumer

## Contract Compatibility
- OpenAPI 不修改 (冻结契约)
- TranslationJobResponse 字段对齐已冻结的 openapi.yaml

## Risk Assessment
- Low: Prisma 新增模型不影响现有表
- Medium: AES-GCM 密钥管理需要环境变量配置
- High: 真实 provider 可用性取决于外部服务

## Rollback
Revert all task branch commits; UnavailableTranslationRepository remains as fallback.
