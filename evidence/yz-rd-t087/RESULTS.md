# YZ-RD-T087 — Practice server eligibility first slice

TASK_ID: YZ-RD-T087
RETURN_TO: 语赞心声｜研发施工与上线 Commander 线
STATUS: RETURNED_WITH_LEGACY_TEST_FIXTURE_CONFLICT
BASE: 7f0663893eadf153373a121169678b94e83d05dd
BRANCH: feat/yz-rd-t087-practice-server-eligibility-guard-only
NOTION_POLICY_READ: READ_OK (Commander checked the current T087 task and Lane via Notion)
FINAL_SHA: See independently reported pushed branch HEAD; the commit cannot contain its own SHA.

## Ownership and security

- Independent worktree created at exact BASE; no pre-existing T087 branch or overlapping edits found.
- Changed only assessment/practice.service.ts, new t087-practice-eligibility.spec.ts, and this evidence file.
- Shared Contracts, Prisma tracked files, student-courses, UI, and source corpus unchanged. Original BASE Contracts blob SHA: openapi.yaml dc865d0f483e154ca85eec7a9d79bb9b86331f74; generated.ts 04cea1142533aa01cf503e4331baa2392b15922f.
- No T005 dirty diff, mixed original curriculum or Level 4 source was read. L4_SOURCE_READ=NO; L4_IMPORT_APPLIED=NO; L4_RUNTIME_OPENED=NO; HISTORICAL_L4_INCIDENT_OPEN=YES.
- No Docker, PG, Redis, MinIO or Chromium runtime used. Generated local Prisma client with a placeholder DATABASE_URL solely for offline client generation; no database connection was made.

## Behavior

- Verifies every required PracticeItemRef before finding/resuming any OPEN Attempt or writing AssessmentSession.
- Requires non-null matching questionVersionId, existing version status PUBLISHED, valid non-future publishedAt, and strict matching item.schoolId. Rejects null-school until Owner approves GLOBAL policy.
- Rejects missing, mismatched, draft, retired, un-dated, cross-school versions and legacy config fallback. Ensures authorization and course-context checks continue before writing.
- Eligible version produces student snapshot from safe deliverySpec only; scoringSpec is not serialized, only its numeric maximum score is used.
- Completed historical attempt read path remains unchanged; withdrawn OPEN attempts fail closed rather than silently resume.

## Measured validation

- New T087 isolated Vitest: PASS 30/30, including invalid create=0/item createMany=0, invalid OPEN resume, valid published create, valid same-ID resume, cross-school/role/absence of enrollment, 404 delivery, course scope and completed historical read.
- Existing practice.service.spec.ts: 10 FAILED / 10 PASS out of 20. The ten positive fixtures have questionVersionId=null and rely on legacy config-only creation. T087 prevents that flow by design; this existing test file is outside authorized ownership. It must be updated by its owner to use legitimate published version fixtures, or explicitly adjudicated. This is a known regression-test conflict, not a passing suite.
- Combined targeted attempt: 40 PASS / 10 FAIL, 50 cases. API_VITEST=PARTIAL_FAILURE.
- Node v24.20.0, pnpm v10.13.1. Offline install --frozen-lockfile --ignore-scripts completed. Local database Prisma generate/build and Contracts build performed without changing tracked protected files. API source typecheck PASS (exit 0).
- Targeted ESLint (service + T087 spec) PASS after local generated types/build. git diff --check PASS.
- FULL_LINT_MEASURED_OR_INHERITED=INHERITED_NOT_RERUN; no numbers from other branches are asserted as this branch's measurement.
- NATIVE_PG_E2E_PASS_FAIL_SKIP_NOTRUN=0 / 0 / 0 / NOT_RUN (no isolated authorized runtime).

## Outstanding gates

- FOLLOWUP_CONTRACT_REQUEST: T086 Practice catalog/detail available/unavailableReason and typed contracts remain blocked pending T005 path-owner clean commit or explicit path authorization. T083 student-course nextActivity parity remains blocked. Do not modify those paths here.
- Formal QuestionBank review and PUBLISH authority has no Owner-approved workflow; synthetic technical fixture is not classroom-published content.
- Existing positive test fixtures conflict with fail-closed behavior and require their owning lane to update tests; no permission to modify legacy practice.service.spec.ts in T087.
- READY_TO_MERGE=NO; no native persistence/E2E, no full API lint gate, no formal classroom approval, and targeted old positive fixture failures.
