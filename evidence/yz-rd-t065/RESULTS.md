# YZ-RD-T065 Results

| Field | Result |
|---|---|
| `TASK_ID` | `YZ-RD-T065` |
| `STATUS` | `PASS_TEST_FIXTURE_FLOW; REAL_TEACHING_AUTHORITY_GAP_OPEN` |
| `BASE` | `d3d2623747eda173aeea71d8bdb2cf52630e98c0` |
| `REFERENCE_T060` | `70f5e4c03f1be6c5bf0a84f135d29f9da19da642` |
| `BRANCH` | `feat/yz-rd-t065-reviewable-practice-fixture-authority-gate` |
| `WORKTREE` | `/home/tian/code/work/yuzan-workspace-t065` |
| `FINAL_SHA` | Returned with the task result; omitted here to avoid a self-referential commit hash. |
| `READY_TO_MERGE` | `NO` — the existing practice remains without a legal published QuestionBankItemVersion, and no official Question Bank author/publish API is exposed. The verified content is test-only. |
| `L4_OPEN` | `NO` |

## First phase: read-only audit

- `QuestionBankItemVersion` is the persisted Question Version model. It has `status` and `publishedAt`; `PracticeItemRef.questionVersionId` already exists as a nullable foreign key to it. The schema relationship is present, so the existing practice blocker is a missing data association, not a missing database column.
- Student attempt creation carries only a `PUBLISHED` QuestionBankItemVersion into its immutable `AssessmentItem` snapshot. The teacher review queue filters for non-null `questionVersionId`, null `scoredScore`, and a `PUBLISHED` version. Manual review rejects missing/unpublished versions. Sources: [`schema.prisma`](../../infra/database/prisma/schema.prisma), [`practice.service.ts`](../../backend/api/src/modules/assessment/practice.service.ts), [`assessment-review.service.ts`](../../backend/api/src/modules/assessment/assessment-review.service.ts).
- The reference T060 read-only result identifies the existing seed practice `停顿与节奏专项训练`, associated course links and the sample media path `/student/growth/assets/practice-sample.wav`. T060 found that those legacy `PracticeItemRef` rows have no `questionVersionId`; the accepted T049 course writer publishes courses and links practices, not Question Bank item versions. No task-owned live or shared database was queried for education records in T065.
- There is no public Question Bank author/publish controller or route in the current API. The runtime import service is an internal import path and was not run. Existing integration tests construct temporary QuestionBankItemVersion records directly through Prisma, providing the legal technical fixture pattern used here.
- The target repository `AGENTS.md` lacks the `AA-DEV-V2.2` marker, and this card did not supply a separate Lane policy path. The user-provided `/home/tian/code/AGENTS.md` baseline and explicit T065 limits governed.

## Fixture provenance and isolation

- The only content created for this task is marked `TEST_FIXTURE_ONLY`: a synthetic written rubric practice, 20 synthetic question versions, synthetic answers, and synthetic identities. It contains no real educational content, Tibetan resource, sourced question, or classroom publication. The existing `停顿与节奏专项训练` records were not changed.
- The fixture was created directly through the existing Prisma data model in `yuzan_t065_native`, PostgreSQL 17 on `127.0.0.1:55765`, under the T065-only `runtime-local/native-web-t065` data directory. The builder refused unexpected database identity or pre-existing non-T065 schools, users, practices, or question items before cleaning a prior T065 fixture run.
- Each synthetic version has `status=PUBLISHED` and a non-null `publishedAt`. All 20 `PracticeItemRef.questionVersionId` values match their corresponding published version IDs. Full ID mapping and provenance are in [`fixture-manifest.json`](native-e2e/fixture-manifest.json); runtime/API/PG assertions are in [`native-proof.json`](native-e2e/native-proof.json).
- No seed helper, question-bank importer, mixed raw DOCX/ZIP, Level 4 helper/data, Docker, production business data, shared database, T005 data, or historical L4 incident data was read, run, or modified. `RAW_SOURCE_READ=NO`.

## API, PostgreSQL, and Chrome verification

- The T065 native runner applied the checkout migrations to its new PostgreSQL database, built from the supplied BASE, created fixture users with the repository's `ScryptPasswordVerifier`, and started the actual NestJS API and Web app. `SPEECH_PROVIDER=disabled`; no Worker or automatic scoring ran.
- Chrome `153.0.8010.52` E2E: **1 passed, 0 failed, 0 skipped**. The student created an attempt (`IN_PROGRESS`), saved/finalized 20 synthetic answers through the existing API, and submitted once (`PROCESSING`) with no report and 20 null scores. A teacher saw all 20 legal pending review rows. Same-school cross-class and cross-school teacher access returned `403`; a different student could not access the report (`403`).
- The teacher saved an explicit `0`; PostgreSQL retained `scoredScore=0` and `status=REVIEWED`, while the 19 remaining rows stayed `NULL` and no report existed. The teacher completed the remaining items through the review API. The final score generated one server-side `AssessmentReport`; session status became `COMPLETED`, and `report.sessionId` matched the original Attempt `fa6e6223-6dc6-44b4-9ae4-8196bf59c289`. The report ID is `b4936109-d25b-4cd9-8d15-bcacd7494353` and its synthetic raw total is 57. The same student fetched and opened that report from practice history.
- API liveness and Web health returned HTTP 200. Core readiness returned `503` because the task-local MinIO process remained in filesystem page-I/O wait and did not open its S3 port. Object-storage checks, audio recording/upload/playback, and media provenance at runtime are therefore `NOT_RUN`; the written fixture makes no storage request. The API/PG review/report flow above used real service code and PostgreSQL, not a storage stub.
- Task-owned PostgreSQL, Redis, API, Web and test processes were stopped after the run. All T065 ports were confirmed free in [`native-runtime-shutdown.txt`](native-runtime-shutdown.txt). No Docker was used.

## Decision

`QUESTION_VERSION_ID` is valid for this isolated `TEST_FIXTURE_ONLY` flow, and the teacher review/report flow is verified against the existing API and model. This does not authorize or repair the existing named practice. The current repository has no formal Question Bank author/publish API and no approved reusable published version for that practice; until an owner-approved reviewable source or authoring contract exists, real teaching acceptance remains blocked and `READY_TO_MERGE=NO`.

## Required return fields

```text
TASK_ID=YZ-RD-T065
STATUS=PASS_TEST_FIXTURE_FLOW; REAL_TEACHING_AUTHORITY_GAP_OPEN
FINAL_SHA=see task return
CONTENT_PROVENANCE=TEST_FIXTURE_ONLY synthetic written rubric content; no formal education/Tibetan source or class launch
QUESTION_VERSION_ID=20 valid published test-only versions; first 5fedeedb-8a00-44fe-93c9-a0fcae013bcd0; full list in fixture-manifest.json
PRACTICE_ITEM_REF=20 linked test-only refs; first 96330f1f-404d-4605-8d00-9e7e09e5b2e3; full mapping in fixture-manifest.json
TEACHER_REVIEW_QUEUE=PASS, 20 pending items; cross-class and cross-school access denied
API_PG_REPORT_FLOW=PASS for test fixture; explicit 0 vs NULL preserved; server report b4936109-d25b-4cd9-8d15-bcacd7494353 matches Attempt fa6e6223-6dc6-44b4-9ae4-8196bf59c289; API readiness 503 from unavailable MinIO
NEW_NATIVE_E2E=PASS, Chrome 153, 1/1; written test-only fixture; media path NOT_RUN
RAW_SOURCE_READ=NO
READY_TO_MERGE=NO
L4_OPEN=NO
```
