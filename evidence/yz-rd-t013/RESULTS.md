# YZ-RD-T013 Results

**Status: DONE**
**Branch:** `feat/yz-rd-t013-student-today-growth`
**Baseline:** `feat/yz-rd-t010-native-web-integration` at `9b4340081e7d330007368062a898f4c11d29a14f`

## Delivered

- Today reads `getStudentProfile()` and `getStudentToday()` for the authenticated account. `StudentToday.primaryAction` remains the sole source for the main recommendation, reason, and destination. Primary Attempt links keep the service returned ID; the practice list distinguishes `ASSIGNMENT`, `SELF_PRACTICE`, and specialized practices from `listPractices()`.
- Today reads `listAssessmentSessions()` across its cursor pages to locate active and processing Attempt IDs. Practice Attempt details and answered-item counts come from `getPracticeAttempt()` and `getPracticeAttemptItems()`. Processing links use the exact Attempt ID; the teacher review summary remains separate from individual processing records.
- Growth replaces the compressed page bundle at `/student/growth/` with maintainable `growth-live.js` and `growth-live.css`. It reads profile, history, history events, current Attempt pages, open practices, Question Bank progress, and report details through the existing APIs.
- Growth displays an official report score only when `getAssessmentReport()` returns a report with `dataCompleteness >= 100` and no `requiresTeacherReview` or `NEEDS_REVIEW` status. Incomplete, unreviewed, and missing reports show explicit states without exposing a score. A trend chart requires at least three dated, numeric formal attempts for the same practice definition. No data produces an empty state.
- The profile page no longer shows the server placeholder `learningStreakDays: 0` and uses a neutral silhouette instead of a static student photo. Today, Growth, and Profile discard old visible data and re-read after account or school changes.
- No OpenAPI, generated type, API Client, backend, teacher, shared, assessment, Prisma, or build-script source was changed. No `API_REQUEST: YZ-RD-T013` is needed.

## Real browser and database proof

The final browser run used Google Chrome 153.0.8010.52, NestJS API, PostgreSQL 17.11, Redis 7.4.10, and the T009 Playwright environment. It used no Docker containers and no mocked API responses.

| Service | T013 resource |
| --- | --- |
| PostgreSQL | `127.0.0.1:55631`, database `yuzan_t013_native`, role `yz_t013` |
| NestJS API | `127.0.0.1:4091` |
| Web | `127.0.0.1:4291` |
| Redis | `127.0.0.1:6431` |
| MinIO | `127.0.0.1:59186–59187`, bucket `yz-t013-native` |

The final Chromium E2E result was **1 passed / 0 skipped**. Student A logged in, saw the teacher-opened practice and server-selected primary Attempt, focused the primary link and pressed Enter to open the dynamic `/assessment/sessions/{attemptId}/` route, returned to Today, opened Growth, and viewed the student's own history. Growth also showed an actual completed record without a report and an API-visible report marked `NEEDS_REVIEW`; it showed neither record as an official score. A's `getStudentToday.primaryAction` destination matched the API response.

The test created A's primary Attempt and transitioned it to `IN_PROGRESS` through real APIs. Processing, completed-without-report, and unreviewed-report states were persisted as isolated PostgreSQL edge-case fixtures, then read through the real API. Those fixture transitions are not claimed as completed business workflows. The provisional score returned by the `NEEDS_REVIEW` report API was not rendered in Today or Growth.

Student A and Student B used different schools, classes, users, and enrollments:

| Fixture | User ID | School ID | Class ID | Enrollment ID |
| --- | --- | --- | --- | --- |
| A | `ba69999f-7c09-4996-b653-1c8a66635f70` | `11111111-1111-4111-8111-111111111111` | `eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee` | `7685571a-d1c6-4dcd-8f59-726d631fc830` |
| B | `34ce78e3-0599-4be1-b2ca-bcb60ace1b69` | `9dac7afd-0139-4439-9f47-26e86f40e639` | `54e52a6f-6ae3-4fc9-a2c8-29931dfcb84f` | `e6eb1c4e-bcf7-4794-8ebb-e7c66b1e8b21` |

Final Attempt fixtures were `IN_PROGRESS` `d342c6d6-9c9a-4236-bfe2-b27f650670d9`, `PROCESSING` `4abd4eb1-6a66-474f-8b08-31c3fc003d8d`, completed without a report `677f1977-eeab-4585-9ea6-2704c50f6dd2`, and `NEEDS_REVIEW` report `1d390bb4-dc2c-4bcb-88ec-bdb5c41eec9a`.

The E2E verified B's empty Today and Growth pages, refresh, cross-tab identity switching, school mismatch rejection, A's Attempt denial, missing Attempt behavior, and network-loss retry. Negative API results were unauthenticated `401`, cross-school `403`, cross-student `404`, and missing Attempt `404`. During identity switching, Today, Growth, and Profile removed A's data and reloaded B's data.

## Browser evidence

| Page | Viewport | Evidence |
| --- | ---: | --- |
| Today, Student A | 1440×1000 | [today-a-1440.png](today-a-1440.png) |
| Today, Student A | 1280×900 | [today-a-1280.png](today-a-1280.png) |
| Today, Student A | 390×844 | [today-a-390.png](today-a-390.png) |
| Growth, Student A | 1440×1000 | [growth-a-1440.png](growth-a-1440.png) |
| Growth, Student A | 1280×900 | [growth-a-1280.png](growth-a-1280.png) |
| Growth, Student A | 390×844 | [growth-a-390.png](growth-a-390.png) |
| Profile, Student A | 1280×900 | [profile-a-1280.png](profile-a-1280.png) |
| Today, Student B | 1440×1000 | [today-b-1440.png](today-b-1440.png) |
| Today, Student B | 390×844 | [today-b-390.png](today-b-390.png) |
| Growth, Student B | 390×844 | [growth-b-390.png](growth-b-390.png) |

Chromium asserted no horizontal overflow at 1440, 1280, and 390 pixels. Interactive focus styles, ARIA live/loading/error states, retry actions, and `prefers-reduced-motion` support are implemented. The Growth curve has an accessible SVG title/description when real data qualifies; empty-state stage artwork is botanical and does not resemble a score curve.

## Verification

- Frontend suite: `node --test frontend/tests/assessment/*.test.mjs` — **48 passed / 0 failed / 0 skipped**.
- T013 Today and Growth unit coverage includes real primary-action navigation, all-page Attempt state lookup, processing, empty data, 401/403/404, network retry, identity switching, formal report gating, and the three-point chart threshold.
- `node frontend/scripts/verify-runtime.mjs` — PASS.
- Direct TypeScript builds for `packages/domain`, `packages/contracts`, `infra/database`, and `backend/api` — PASS.
- JavaScript checks, E2E Python compilation, and `git diff --check` — PASS.
- The package command `pnpm --filter @yuzan/frontend test` was blocked by the repository's pnpm dependency guard (`ERR_PNPM_IGNORED_BUILDS` for Prisma/esbuild-related scripts). No build scripts were approved. The package's Node test and runtime verification steps were run directly and passed.
- Read-only endpoint, Controller, DTO, OpenAPI, and generated-type comparison found no shared interface gap.

## Isolation and cleanup

- T013 used the independent runtime directory `runtime-local/native-web-t013`. Its fictional A/B fixtures and T013 MinIO data remain in that task-local runtime; the database and bucket were not deleted.
- All T013 services are stopped after evidence capture. No T009, T010, T011, T012, or unrelated process was stopped. The L4 default-volume incident remains OPEN and untouched.
- The main `feat/question-bank-v1` worktree's pre-existing T005 bilingual changes remain unchanged. T011 and T012 worktrees were not edited. The pnpm 11 install's temporary `pnpm-workspace.yaml` mutation in this isolated worktree was restored before staging.
