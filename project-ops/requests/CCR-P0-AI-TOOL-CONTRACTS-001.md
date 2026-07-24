# CCR: P0-AI-TOOL-CONTRACTS-001

## Summary
Add LessonPlanning and Translations OpenAPI paths and schemas to the shared contract, making it the single source of truth for both teacher lesson-planning and translation tool lanes.

## Change Scope

### Files Changed
| Path | Change Type | Description |
|------|-------------|-------------|
| `packages/contracts/openapi/openapi.yaml` | ADD/MODIFY | New LessonPlanning tag (7 paths), Translations tag (6 paths), 9 new schemas |
| `packages/contracts/src/generated.ts` | REGENERATE | TypeScript types regenerated from updated OpenAPI |
| `project-ops/tasks/active/P0-AI-TOOL-CONTRACTS-001.json` | MODIFY | Task status updated to IN_PROGRESS -> DONE |

### New Paths
**LessonPlanning (7 paths)**
- `POST /schools/{schoolId}/ai/lesson-plan-jobs` — createLessonPlanJob
- `GET /schools/{schoolId}/ai/lesson-plan-jobs/{jobId}` — getLessonPlanJob
- `POST /schools/{schoolId}/ai/lesson-plan-jobs/{jobId}/cancel` — cancelLessonPlanJob
- `GET /schools/{schoolId}/ai/lesson-plan-drafts` — listLessonPlanDrafts
- `GET /schools/{schoolId}/ai/lesson-plan-drafts/{draftId}` — getLessonPlanDraft
- `PUT /schools/{schoolId}/ai/lesson-plan-drafts/{draftId}` — replaceLessonPlanDraft
- `PATCH /schools/{schoolId}/ai/lesson-plan-drafts/{draftId}` — updateLessonPlanDraft
- `POST /schools/{schoolId}/ai/lesson-plan-drafts/{draftId}/approve` — approveLessonPlanDraft
- `GET /schools/{schoolId}/ai/lesson-planner/workflow-status` — getLessonPlannerWorkflowStatus
- `GET /schools/{schoolId}/ai/lesson-plans/workflow-status` — getLessonPlanWorkflowStatusAlias

**Translations (6 paths)**
- `POST /schools/{schoolId}/translations/jobs` — createTranslationJob
- `GET /schools/{schoolId}/translations/jobs/mine` — listMyTranslationJobs
- `GET /schools/{schoolId}/translations/jobs` — listAllTranslationJobs
- `GET /schools/{schoolId}/translations/jobs/{jobId}` — getTranslationJob
- `GET /schools/{schoolId}/translations/glossary` — getTranslationGlossary

### New Schemas
- CreateLessonPlanJobRequest
- LessonPlanJobResponse
- LessonPlanDraftResponse (with revision for optimistic concurrency)
- LessonPlanWorkflowStatus
- TranslationStatus (enum: PENDING, PROCESSING, COMPLETED, FAILED, NEEDS_REVIEW, APPROVED)
- CreateTranslationRequest
- TranslationJobResponse (machineResult/revisedResult/reviewStatus decomposition; errorCode sanitized to 4 safe values)
- GlossaryEntryResponse
- ListJobsQuery (status, cursor, limit)

## Design Decisions
1. **Optimistic concurrency**: LessonPlanDraftResponse includes `revision` field; `PUT` replaces, `PATCH` partial updates
2. **Safe error codes**: TranslationJobResponse errorCode only exposes PROVIDER_UNAVAILABLE/QUOTA_EXCEEDED/INVALID_INPUT/INTERNAL_ERROR (aligned with sanitizeErrorCode filter)
3. **Result decomposition**: TranslationJobResponse splits `resultText` into `machineResult` + `revisedResult` + `reviewStatus` for clearer state transitions
4. **Dual workflow path**: Both `/ai/lesson-planner/workflow-status` and `/ai/lesson-plans/workflow-status` for backward compatibility

## Validation Results
- Redocly lint: PASS (openapi/openapi.yaml validated in 87ms)
- operationId uniqueness: PASS (109 unique operationIds)
- TypeScript type generation: PASS (870 new lines in generated.ts)
- git diff --check: PASS (no whitespace errors)

## Non-Goals
- No backend controller/service/worker implementation changes
- No frontend implementation changes
- No provider or database changes
