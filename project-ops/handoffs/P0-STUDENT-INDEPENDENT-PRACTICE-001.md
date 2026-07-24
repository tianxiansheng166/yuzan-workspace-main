# P0-STUDENT-INDEPENDENT-PRACTICE-001 Handoff

## Task
学生独立专项练习闭环（不关联课程）

## Verdict
PENDING — awaiting live browser + DB verification

## What Changed

### Backend
- **No structural changes**: `practice.service.ts` and `practice.controller.ts` already support independent practice via empty `CoursePracticeContext`
- `createOrResume(auth, schoolId, definitionId, {})` creates `AssessmentSession` with `courseSubmissionId: null` and `courseActivityId: null`, returning `mode: "SELF_PRACTICE"`
- `listForStudent` already filters `courseSubmissionId: null` for independent history
- `addFavorite` / `removeFavorite` are student-scoped by `studentId`
- `validateCourseContext` returns `null` for empty context (all three IDs absent), and rejects partial context (any but not all three present)

### Frontend
- **No structural changes**: `practice.js` already renders `/student/practices` catalog and detail pages
- `practice.js` calls `Api.createOrResumePractice(practice.id)` without course context → independent attempt
- `app.js` already handles `/student/practices/attempts/:attemptId/...` routes with real MediaRecorder
- `server.mjs` already routes `/student/practices/**` to correct shell HTML files
- `api-client.js` already has `listPractices`, `getPractice`, `createOrResumePractice`, `favoritePractice`, `unfavoritePractice`

### Tests Added
- `backend/api/test/assessment/practice.service.spec.ts`: 7 new test cases in "independent practice (no course context)" describe block:
  1. Creates SELF_PRACTICE attempt when no course context provided
  2. Resumes existing independent attempt idempotently
  3. Does not set courseSubmissionId or courseActivityId on independent attempt
  4. Rejects partial course context (only assignmentId)
  5. Rejects partial course context (only submissionId + activityId)
  6. Rejects cross-school access for independent practice
  7. Does not call submission or courseActivity validators for independent practice

### Evidence
- `evidence/p0-student-independent-practice-001/independent_practice_e2e.py`: Playwright-based browser + DB verification script covering all 12 required check categories

## Verification Commands

```bash
# Backend unit tests
pnpm --filter @yuzan/api test -- test/assessment/practice.service.spec.ts

# Typecheck
pnpm --filter @yuzan/api typecheck

# Build
pnpm --filter @yuzan/api build

# E2E browser verification (requires running frontend + backend)
python evidence/p0-student-independent-practice-001/independent_practice_e2e.py
```

## Coverage Map

| Requirement | Mechanism | Evidence |
|---|---|---|
| Catalog loading/empty/error/permission/offline | `practice.js` → `refreshCatalog()`, `error()`, `offline` listener | E2E screenshots |
| Dynamic IDs (definitionId/attemptId/itemId/recordingId) | All from API responses, no hardcoded values | API call audit in E2E |
| create/resume idempotent | `practice.service.ts` → `existing` check returns `resumed: true` | Unit test + E2E |
| Independent attempt rejects fake course context | `validateCourseContext` partial → `BadRequestException` | Unit tests |
| Real MediaRecorder + upload + binding | `app.js` → `startRecording()` with `navigator.mediaDevices.getUserMedia` | E2E with mic permission |
| Written save/refresh/finalize | `app.js` → `saveWrittenAnswer()`, `finalizeWrittenAnswer()` | E2E form interaction |
| Session submit + processing/NEEDS_REVIEW/unavailable | `app.js` → submit page, processing poll, report display | E2E submission flow |
| Favorites/history scoped to current student | `practice.service.ts` → `studentId` filter, `enrollmentId` filter | Unit tests + E2E |
| Cross-student/school rejected | `assertStudentTenant` + `activeEnrollment` schoolId check | Unit tests |
| No course ActivityProgress pollution | `courseSubmissionId: null` → no Submission/ActivityProgress created | DB query in E2E |
| 1440/1024/390 responsive | Viewport resize in E2E + overflow check | Screenshots at 3 sizes |
| Console/page/request/HTTP audit | Playwright `page.on("console"/"pageerror"/"requestfailed")` | E2E audit results |

## Shared Owner Changes
None. No OpenAPI, Prisma, api-client.js, or server.mjs modifications.

## Rollback
Revert this task branch commits. No Prisma migration, OpenAPI, or shared contract change was authorized. Existing assessment, recording, and course progress rows remain server-owned.
