# P0-TEACHER-AI-LESSON-PLAN-001 Handoff

## Branch
`task/p0-teacher-ai-lesson-plan-001`

## HEAD
`0c5402e` (local = remote)

## Summary
Fixed 8 hard gaps in AI lesson plan generation pipeline and collected Flowise closure evidence.

## Changes

### Gap Fixes (commit 880ccc6)
1. **Gap 1**: `lessonPlanDraftId` → `draftId` field alignment in toJobResponse
2. **Gap 2**: Frontend DRAFT_FIELDS aligned with JSON Schema: `lessonFlow`, `differentiation`, `practiceDraft`, `teacherReviewChecklist`
3. **Gap 3**: Object array rendering fixed (no more `[object Object]`); `schemaVersion`/`context` preserved on update
4. **Gap 4**: Credential injection via `overrideConfig` in Flowise prediction call
5. **Gap 5**: `externalFlowId` from DB as single source of truth; env var as fallback only
6. **Gap 6**: `isFlowiseReachable` replaced with HTTP health check; `isWorkerAvailable` checks actual worker state
7. **Gap 7**: `reportResult` retry with JOB_STUCK marker on persistent failure
8. **Gap 8**: `courseVersionId`/`lessonId` queries scoped by `schoolId`; exceptions no longer silently swallowed

### Flowise 3.1.1 Auth Fix (commit 0c5402e)
- Added `x-request-from: internal` header for Flowise 3.1.1 API access
- Updated docker-compose with FLOWISE_USERNAME/FLOWISE_PASSWORD credentials
- Updated bootstrap-flow.ps1 to use `/api/v1/chatflows` endpoint with `type:AGENTFLOW`

## Test Results
- API focused tests: 23/23 PASSED
- Worker focused tests: 33/33 PASSED
- Flowise closure: Health OK, Auth OK, Bootstrap OK, Prediction 500 (expected — no AI provider credential configured)

## Known Limitations
- Flowise prediction returns 500 because no AI provider API key is configured in the Flowise instance. The full end-to-end pipeline (Job → Flowise → Draft) requires a real AI provider credential to be configured via Flowise UI.
- Front-end validation of field alignment (Gaps 1-3) has not been browser-tested yet; changes are code-level only.

## Files Modified (within allowed_paths)
- `backend/api/src/modules/ai-lesson-planning/ai-lesson-planning.service.ts`
- `backend/worker/src/ai-generation/ai-generation.consumer.ts`
- `frontend/teacher/ai-tools/app.js`
- `infra/ai/flowise/docker-compose.yml`
- `infra/ai/flowise/scripts/bootstrap-flow.ps1`
- `infra/ai/flowise/schemas/lesson-plan-output.schema.json`

## Rollback
Revert task branch commits; all changes are within allowed_paths and no shared schema/migration changes.
