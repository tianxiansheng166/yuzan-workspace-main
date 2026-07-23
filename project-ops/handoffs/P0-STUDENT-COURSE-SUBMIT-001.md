# Handoff: P0-STUDENT-COURSE-SUBMIT-001

## Task Summary

**Task ID**: P0-STUDENT-COURSE-SUBMIT-001
**Branch**: task/p0-student-course-submit-001
**Base Commit**: ca14c57f0534e4e8ddf3e273128668b6c12e685e
**Depends On**: P0-STUDENT-COURSE-PRACTICE-001
**Status**: READY_FOR_REVIEW

## What the Student Can Now Do

A real logged-in student can:
1. Complete five types of required activities (TEXT, AUDIO, CHOICE, FILL_BLANK, SPEECH) in a real persisted course
2. See course progress go from 0% to 100% as activities are completed
3. Submit the entire course using server-side revision
4. See all progress, answers, audio playback position, recording evidence, and submission status persist after page refresh
5. Re-login in a new browser context and see the same 100% progress and submitted state

## How Five Activity Types Are Real-Persisted

| Activity | Frontend Action | Backend Endpoint | Persistence |
|----------|----------------|------------------|-------------|
| TEXT | Click "确认阅读" | POST saveActivityAttempt (kind=TEXT, completed=true) | ActivityAttempt + ActivityProgress |
| AUDIO | Click "标记完成" | POST saveActivityAttempt (kind=AUDIO, videoPosition, completed=true) | ActivityAttempt + ActivityProgress with videoPosition |
| CHOICE | Select option + submit | POST saveActivityAttempt (kind=CHOICE, value={answerIndex}) | ActivityAttempt with answer + ActivityProgress |
| FILL_BLANK | Fill blanks + submit | POST saveActivityAttempt (kind=FILL_BLANK, value={answers[]}) | ActivityAttempt with answers + ActivityProgress |
| SPEECH | Record → upload → link | POST linkRecording | Recording linked to ActivityAttempt → ActivityProgress completed |

## Course Progress → 100% → Submit Flow

1. Each activity completion calls `saveActivityAttempt` which atomically upserts ActivityAttempt + ActivityProgress in a transaction
2. Server recalculates `courseCompletion.progressPercent` after each activity save
3. When all 5 required activities are completed, `progressPercent` reaches 100
4. Frontend reads current `submission.revision` from `getStudentCourse`
5. Frontend calls `submitStudentCourse(assignmentId, submissionId, revision)`
6. Backend validates 100% completion, increments revision, sets status to SUBMITTED
7. After submission, all activity writes are rejected (readonly state)

## Revision, Concurrency, and Idempotency

- **expectedProgressRevision**: Client sends the revision it observed; server checks for atomic conflict
- **409 Conflict**: If two clients use the same revision, only one succeeds; the other gets 409 and must re-read
- **Revision 0**: Means client believes no progress row exists; server creates only if truly absent
- **Submit revision**: `SubmitCourseDto.revision` must match current submission revision; post-submit increments it
- **Idempotent re-submit**: Same submit request after network retry returns the same submitted result, not 409

## Commits on This Branch (base...HEAD)

| Commit | Description |
|--------|-------------|
| c050738 | chore(ops): define student course submit task |
| 4b73598 | fix(student-courses): add 8 validation rules to saveActivityAttempt |
| 9ffc1d7 | test(student-courses): add 17 focused tests for saveActivityAttempt validation rules |
| c49bdd7 | fix(course-adapter): saveActivityAttempt returns full server result + 409 handling |
| 8bbcfe3 | fix(course-state): server-driven progress, 409 handling, saveActivityAttempt, submitCourse, enrollmentId tracking |
| 577a319 | fix(web): five activity renderers + SPEECH context + video position persist |
| bfe1711 | chore(ops): add E2E bootstrap data for 5-activity-type course |
| 189367e | fix(api): Prisma 7.x driver adapter compatibility + ActivityType enum fix |
| 1b5ac57 | feat(seed): course 1 has 5 non-practice activities for all type verification |
| 1fe5e94 | fix(ops): update e2e-bootstrap-data CHOICE title and 5-activity structure |

## Test Results

| Test | Command | Result | Count |
|------|---------|--------|-------|
| Service unit tests | `pnpm --filter @yuzan/api test -- test/student-courses/student-courses.service.spec.ts` | PASS | 26 tests |
| API verification | `python _tmp_api_verify.py` | PASS | 5/5 activities, 100%, submit, readonly, idempotent |
| E2E Playwright | `python _tmp_e2e_playwright.py` | PASS | 15/15 steps |
| Database evidence | `psql -f _tmp_e2e_verify2.sql` | PASS | 5 Progress, 5 Attempt, 1 Submission, 1 Recording |

## Browser/API/Database Evidence

### E2E Steps (15/15 passed)
1. Login as student.test → redirected to /student/today
2. Navigate to course detail → course loaded
3. Complete TEXT activity → feedback visible
4. Complete AUDIO activity → feedback visible
5. Complete CHOICE activity → feedback visible
6. Complete FILL_BLANK activity → feedback visible
7. Complete SPEECH activity → recording linked
8. Verify 100% progress
9. Submit course → SUBMITTED status
10. Verify readonly after submit
11. Idempotent re-submit → same result
12. New browser context → re-login
13. Persistence: 100% still visible
14. Persistence: activities still completed
15. Persistence: submission still SUBMITTED

### Database Evidence
- 5 ActivityProgress records with `completed=true`
- 5 ActivityAttempt records with non-null `value`
- Submission status=SUBMITTED, revision=1
- Recording linked to ActivityAttempt (activityAttemptId IS NOT NULL)

## Real Limitations and Lint Baseline

- **SPEECH E2E**: Uses API-level `linkRecording` call instead of real browser MediaRecorder (headless chromium has no microphone)
- **Lint**: Repository has pre-existing ESLint baseline issues (missing @eslint/js declaration, existing lint errors). This task did not add new lint issues.
- **Node.js**: Requires >=24 <27 (tested with 24.18.0)
- **Prisma 7.x driver adapter**: `$queryRaw` and `$disconnect` not available on PrismaClient type

## Branch, Commit, Remote State

- **Branch**: task/p0-student-course-submit-001
- **HEAD**: 1fe5e94
- **Remote**: origin/task/p0-student-course-submit-001 (pushed)
- **Local HEAD matches remote HEAD**: Yes

## Self-Audit Checklist

- [x] All commits within allowed_paths
- [x] No shared owner violations (no changes to files owned by other tasks without contract change request)
- [x] No hardcoded business IDs in frontend or E2E main flow (bootstrap data uses dynamic UUIDs in seed)
- [x] No fake success: all completions go through real API, SPEECH requires real Recording link
- [x] No secrets or credentials in code or evidence
- [x] No Prisma schema changes
- [x] No production data modifications
- [x] Submit-gated: course must be 100% before submit
- [x] Post-submit readonly: activity writes rejected after submission
- [x] Idempotent: re-submit returns same result
- [x] Revision-based concurrency: 409 on conflict
- [x] Rollback: revert this branch commits; no migration to undo

## Next Candidate

P0-STUDENT-INDEPENDENT-PRACTICE-001 (not started in this task)
