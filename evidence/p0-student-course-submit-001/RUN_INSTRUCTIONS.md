# Run Instructions: P0-STUDENT-COURSE-SUBMIT-001 Evidence Scripts

## Directory

All scripts and output files reside in:
```
D:/program/test_program/yuzanxinsheng/three/worktrees/P0-STUDENT-COURSE-SUBMIT-001/evidence/p0-student-course-submit-001/
```

---

## Prerequisites

1. **Node.js** >= 24 < 27 (tested with 24.18.0)
2. **Python** >= 3.10 with `playwright` package installed (`pip install playwright && playwright install chromium`)
3. **PostgreSQL** container running on port 55432 (`yuzan-four-port-postgres-55432`)
4. **Prisma Client** generated: `pnpm --filter @yuzan/database generate`
5. **Database migrations** deployed: `pnpm --filter @yuzan/database migrate:deploy`
6. **API server** running on port 4000: `pnpm --filter @yuzan/api start`
7. **Web server** running on port 4175: `pnpm --filter @yuzan/web start`
8. **MinIO** running on port 59000 (for SPEECH recording upload)
9. Seed data loaded (5-activity-type course with TEXT/AUDIO/SPEECH/CHOICE/FILL_BLANK)

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `YUZAN_E2E_STUDENT_IDENTIFIER` | Yes | — | Login identifier for the test student (e.g. `student.test`) |
| `YUZAN_E2E_STUDENT_PASSWORD` | Yes | — | Password for the test student |
| `YUZAN_E2E_BASE_URL` | No | `http://127.0.0.1:4175` | Web frontend base URL |
| `YUZAN_E2E_API_URL` | No | `http://127.0.0.1:4000/api/v1` | API base URL |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (see `.env` in worktree root) |

The `DATABASE_URL` from the worktree `.env`:
```
postgresql://yuzan_dev:1e389bf6a02f02c827dbb8e973b7d0a8ec5aeb0ce239ce5fe55607a9efb35eb7@127.0.0.1:55432/yuzan_dev?schema=public
```

---

## Script 1: course_submit_e2e.py (Playwright Browser E2E)

### What It Tests

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Login as student via browser UI | Access token in localStorage, redirected away from `/login` |
| 2 | Dynamically discover a TEACHER_ASSIGNED course with >= 4 required non-practice activities | assignmentId, activityTypes discovered from API |
| 3 | Navigate to course detail page | CoursePlayerState loaded, submissionId present |
| 4 | Complete each activity type (TEXT, AUDIO, CHOICE, FILL_BLANK, SPEECH) | Feedback/confirmation visible in DOM |
| 5 | Verify 100% progress | `course.progress.percent === 100` |
| 6 | Submit course via `CoursePlayerState.submitCourse()` | `submissionStatus === 'SUBMITTED'` |
| 7 | Verify read-only after submit | `.cp-exercise-readonly` visible |
| 8 | SPEECH recording API verification | Recording has bytes, objectKey, durationMs |
| 9 | Fault: old revision 409 conflict | Submit with old revision → 409, re-read, retry succeeds |
| 10 | Fault: bad activity type save | `kind: 'WRONG_TYPE'` rejected, activity not falsely completed |
| 11 | Fault: idempotent re-submit | Same submit call returns same result, no error |
| 12 | Fault: cross-school isolation | Unauthenticated context redirected to `/login` or denied |
| 13 | New browser context persistence | Re-login, 100% progress and SUBMITTED status persist |

### How to Run

```powershell
# From the worktree root
cd D:\program\test_program\yuzanxinsheng\three\worktrees\P0-STUDENT-COURSE-SUBMIT-001

# Set environment variables
$env:YUZAN_E2E_STUDENT_IDENTIFIER = "student.test"
$env:YUZAN_E2E_STUDENT_PASSWORD = "<password>"
$env:YUZAN_E2E_BASE_URL = "http://127.0.0.1:4175"

# Run the E2E script
python evidence/p0-student-course-submit-001/course_submit_e2e.py
```

### Expected Output Files

| File | Description |
|------|-------------|
| `browser-result.json` | Full JSON result with all 13 steps, dynamic IDs, audit data |
| `01-after-login-{viewport}.png` | Screenshots at 1440x900, 1024x768, 390x844 |
| `02-course-loaded-{viewport}.png` | Course detail page screenshots |
| `03-activities-completed-{viewport}.png` | After all activities completed |
| `04-progress-100-{viewport}.png` | 100% progress state |
| `05-course-submitted-{viewport}.png` | After submission |
| `failure.png` | (only if test fails) Full-page failure screenshot |

### Success Criteria

- `browser-result.json` contains `"status": "PASSED"`
- `step5_progress.is100 === true`
- `step6_submit.submitted === true`
- `step9_fault_409.gotConflict === true`
- `step11_fault_idempotent.idempotent === true`
- `step12_fault_isolation.isIsolated === true`
- `step13_new_context.progressPercent === 100`
- No `pageErrors`, `consoleErrors`, or `failedRequests` in audit section

---

## Script 2: verify_database.mjs (Database/API Cross-Verification)

### What It Verifies

| Check | Database Query | API Cross-Check |
|-------|----------------|-----------------|
| Student exists | `User.findUnique({ loginIdentifier })` | Login API |
| Enrollment exists | `Enrollment.findFirst({ userId, role: STUDENT })` | — |
| Assignment exists | `Assignment.findFirst({ source: TEACHER_ASSIGNED })` | `/student/courses` |
| ActivityProgress | 5 records with `completed=true` | `courseDetail.studentProgress.completedActivityIds` |
| ActivityAttempt | 5 records with non-empty `value` | — |
| Submission status | `status === SUBMITTED`, `revision >= 1` | `/submissions/:id` |
| Recording for SPEECH | `bytes > 0`, `objectKey` present, `durationMs > 0`, linked to ActivityAttempt | — |
| CourseCompletion | `progressPercent === 100` | `courseDetail.studentProgress.progressPercent` |

### How to Run

```powershell
# From the worktree root
cd D:\program\test_program\yuzanxinsheng\three\worktrees\P0-STUDENT-COURSE-SUBMIT-001

# Set environment variables
$env:YUZAN_E2E_STUDENT_IDENTIFIER = "student.test"
$env:YUZAN_E2E_STUDENT_PASSWORD = "<password>"
$env:DATABASE_URL = "postgresql://yuzan_dev:1e389bf6a02f02c827dbb8e973b7d0a8ec5aeb0ce239ce5fe55607a9efb35eb7@127.0.0.1:55432/yuzan_dev?schema=public"
$env:YUZAN_E2E_API_URL = "http://127.0.0.1:4000/api/v1"

# Ensure Prisma client is generated
pnpm --filter @yuzan/database generate

# Run the verification script
node evidence/p0-student-course-submit-001/verify_database.mjs
```

### Expected Output Files

| File | Description |
|------|-------------|
| `database-result.json` | Full JSON result with dynamic IDs, verification checks, API cross-checks |

### Success Criteria

- `database-result.json` contains `"status": "PASSED"`
- `verification.activityProgressAllCompleted === true`
- `verification.activityAttemptAllNonEmpty === true`
- `verification.submissionStatusValid === true`
- `recording.hasNonZeroBytes === true`
- `recording.hasObjectKey === true`
- `recording.hasDuration === true`
- `recording.linkedToCorrectAttempt === true`
- `courseCompletion.progressPercent === 100`
- `errors` array is empty or undefined

---

## Recommended Execution Order

1. Start PostgreSQL, MinIO, Redis services
2. Run `pnpm --filter @yuzan/database generate` and `migrate:deploy`
3. Seed the database (5-activity-type course data)
4. Start API server (`pnpm --filter @yuzan/api start`)
5. Start web server (`pnpm --filter @yuzan/web start`)
6. Wait for both servers to report successful startup
7. Set environment variables
8. Run `course_submit_e2e.py` first (creates progress, attempts, submission, recording)
9. Run `verify_database.mjs` second (cross-checks the data created by E2E)
10. Inspect `browser-result.json` and `database-result.json` for `PASSED` status

---

## Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| `Missing YUZAN_E2E_STUDENT_IDENTIFIER` | Env var not set | Set `$env:YUZAN_E2E_STUDENT_IDENTIFIER` and `$env:YUZAN_E2E_STUDENT_PASSWORD` in PowerShell |
| `no teacher-assigned course with >=4 required non-practice activities` | Seed data not loaded | Run database seed script |
| `E2E student was not found by loginIdentifier` | Student user not in database | Create the student user via seed or admin |
| `PrismaClient initialization error` | Prisma client not generated or `DATABASE_URL` wrong | Run `pnpm --filter @yuzan/database generate` and check `.env` |
| `SPEECH recording timeout` | MinIO not running or upload endpoint unavailable | Start MinIO on port 59000 |
| `page errors` or `console errors` in browser audit | Frontend bug | Check browser console, fix frontend issue |
| `409 conflict on first activity save` | Activity progress already exists from prior run | Reset student progress or use a fresh student account |
