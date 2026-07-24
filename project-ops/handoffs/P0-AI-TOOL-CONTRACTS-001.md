# Handoff: P0-AI-TOOL-CONTRACTS-001

## Task
冻结教师教案与藏汉翻译共享 OpenAPI 契约

## Outcome
OpenAPI 成为教师教案和翻译工具的共同 provider/consumer 事实，不再靠 controller、前端 mock 和旧 readiness 文档分别猜字段。

## Deliverables
- `packages/contracts/openapi/openapi.yaml` — 新增 LessonPlanning (7+ paths) 和 Translations (6 paths) 标签与路径、9 个新 schema
- `packages/contracts/src/generated.ts` — 从更新后的 OpenAPI 重新生成的 TypeScript 类型
- `project-ops/requests/CCR-P0-AI-TOOL-CONTRACTS-001.md` — 变更请求文档
- `project-ops/tasks/active/P0-AI-TOOL-CONTRACTS-001.json` — 任务元数据（status -> DONE）

## Validation Evidence
| Test | Result |
|------|--------|
| Redocly lint openapi.yaml | PASS — validated in 87ms |
| operationId uniqueness (109 ids) | PASS — all unique |
| TypeScript type generation | PASS — 870 new lines |
| git diff --check | PASS — no whitespace errors |

## Key Decisions
1. TranslationJobResponse decomposes resultText into machineResult + revisedResult + reviewStatus
2. errorCode only exposes 4 sanitized values (PROVIDER_UNAVAILABLE/QUOTA_EXCEEDED/INVALID_INPUT/INTERNAL_ERROR)
3. LessonPlanDraftResponse includes revision for optimistic concurrency
4. Dual workflow-status paths for backward compatibility

## Commits (task branch)
- `28cf0b0` — chore(ops): bootstrap P0-AI-TOOL-CONTRACTS-001 task JSON
- `2fbbec5` — feat(contracts): freeze lesson-planning and translation OpenAPI contracts
- `530048e` — chore(contracts): regenerate TypeScript types from frozen OpenAPI

## Next Steps
- Teacher lesson-planning implementation lane can consume these contracts for Job/Draft/Workflow
- Translation tool implementation lane can consume these contracts for Job/Glossary
- Both lanes must reference this OpenAPI as the single source of truth for field names, status values, error codes, and permission boundaries
