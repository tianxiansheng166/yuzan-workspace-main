# YZ-RD-T033 Results

## Result contract

| Field | Result |
|---|---|
| TASK_ID | YZ-RD-T033 |
| STATUS | ACCEPTANCE_VERIFIED / MERGE_BLOCKED_BY_UNCHANGED_API_LINT_BASELINE |
| FINAL_SHA | Reported in the final task return; this evidence commit does not contain its own SHA. |
| PUSH | Current independent branch only; no shared development branch merge. |
| MERGE_GRAPH | PASS: three T033 no-fast-forward integrations preserve T029 → T030 → T031 → T032. |
| API_CONTRACTS | PASS after aligning two OpenAPI/generated-type responses with the observed API: session submit 201 and class student summaries raw array. |
| CHROME_API_PG_MINIO | PASS: one task-owned native runtime with Chromium 153, NestJS API, PostgreSQL 17.11, Redis 7.4.10 and MinIO. No Docker/Compose. |
| E2E_PASS_FAIL_SKIP | 4 / 0 / 0 in the same T033 runtime; 271.29 seconds. |
| FULL_API_LINT | FAIL: 1201 errors / 1 warning, matching the T029 recorded baseline. Invitation controller/service targeted lint passes. |
| KNOWN_BLOCKERS | Full API lint remains at its T029 baseline. Same-school access to another teacher's class returns the existing resource-concealing 404, although the older T032 card said 403. |
| READY_TO_MERGE | NO until the API lint baseline is resolved or explicitly waived by its owner. Functional, contract, typecheck and build acceptance in this card passed. |
| L4_OPEN | OPEN / UNTOUCHED. |

## Git integration graph

The starting accepted source was 38d36c7255568a5bcc7af3200ce2b23b9de758bc on feat/yz-rd-t033-multirole-web-rolling-integration.

| Integration | Merge commit | First parent | Second parent |
|---|---|---|---|
| T030 into T029 | 83cd26452d72d842567dde682773e96142b1fa71 | T029 b49271805899f267354d03e3f6cb8f7d416bbf53 | T030 d7b99c889c949110b2a29e3ca75535e81b5bbcca |
| T031 into T030 | 07a9ee1e05a0d843772a1b5bee8e1d437b53988d | 83cd26452d72d842567dde682773e96142b1fa71 | T031 17108f24f6f525275c53ef600e51075669eb5e7c |
| T032 into T031 | 38d36c7255568a5bcc7af3200ce2b23b9de758bc | 07a9ee1e05a0d843772a1b5bee8e1d437b53988d | T032 67bbfda3f13b3dbcbb3e9a5e256ac3c6a7ab32ec |

The merge bases against T029, T030, T031 and T032 are respectively b492718…, d7b99c8…, 17108f2… and 67bbfda…. No cherry-picks were used. T029's retained T026/T028 merge is f292c6bfa5d753ecab9e3dc316c1459fbe97e2dc with parents 2416577aeddcca7ebd45ff9c64ff702adb69c79d and bfae13ab315bee532842cffe4fdd6c142cb8a488. The three T033 integrations are on the first-parent line.

## API Client and OpenAPI contract audit

The shared ApiClient already uses the active school for teacher invitation creation/revocation, class summaries, reports/remediation and course completion. Contract tests and the native run found and corrected two stale OpenAPI shapes:

| Operation | ApiClient method | Live / documented contract |
|---|---|---|
| POST /schools/{schoolId}/teacher-invitations | createTeacherInvitation | 201; class-scoped invitation response. |
| POST /student/teacher-invitations/bind | bindTeacherInvitation | 201; real membership/enrollment bind. |
| POST /schools/{schoolId}/teacher-invitations/{invitationId}/revoke | revokeTeacherInvitation | 200; code redacted, existing enrollment retained. |
| GET /schools/{schoolId}/classes/{classId}/student-summaries | getClassStudentSummaries | 200 raw unpaginated array. OpenAPI had described an envelope; ClassStudentSummaryListResponse and generated type now use an array. |
| GET /schools/{schoolId}/assessments/sessions/{sessionId}/report | getAssessmentReport | 200; the formal report is server-generated after required teacher reviews. |
| POST /schools/{schoolId}/assessments/sessions/{sourceSessionId}/remediation | createAssessmentRemediation | 201; linked server-selected retry session. |
| POST /schools/{schoolId}/assessments/sessions/{sessionId}/submit | submitAssessmentSession | Browser/API returned 201; NestJS uses the default POST status. OpenAPI had said 200; corrected to 201, preserving the 202 processing response. |
| POST /schools/{schoolId}/student/courses/{assignmentId}/submissions/{submissionId}/activities/{activityId}/practice-attempts/{attemptId}/complete | completeCoursePractice | 201; activity completion is tied to the submitted Attempt. |

Generated types were regenerated from the corrected OpenAPI. Redocly validation and contract generation tests pass 6/6. The CSV API is unpaginated; the live roster is verified against active Enrollment and related progress/submission/report rows.

## Native Chromium/API/PostgreSQL/MinIO acceptance

All four E2Es ran against one isolated T033 environment:

| Service/resource | T033 identity |
|---|---|
| Database / role | yuzan_t033_native / yz_t033 |
| PostgreSQL | 17.11, port 55673, 32 migrations |
| Redis | 7.4.10, port 6473 |
| MinIO | bucket yz-t033-native, ports 59473–59474 |
| NestJS API / Web | ports 4173 / 4373 |
| Browser | Google Chrome 153.0.8010.52 |
| Toolchain | Node 24.20.0, pnpm 10.13.1 |

The Question Bank importer dry-run reported 120 items, 600 points, 120/120 bound answers, 126 media files and zero errors/warnings. Apply targeted only the T033 database and bucket. A repeated apply reused all 120 question versions and 126 media objects. The source at /home/tian/code/yuzan-workspace-main/习题课程资源 was read-only; importer temporary output stayed under the T033 runtime directory.

Final browser result: 4 passed, 0 failed, 0 skipped. Screenshots, SQL/API evidence and native logs are under this directory:

1. Teacher invite → student join → revoke → live roster. The integrated T026/T028 flows use a teacher-created class invitation, student Profile binding, real Membership/Enrollment writes, revocation and a refreshed roster. Revocation retained both active student enrollments. The teacher roster showed the students. Invitation dialog screenshots: [390](invitation/screenshots/teacher-invitation-dialog-390.png), [768](invitation/screenshots/teacher-invitation-dialog-768.png), [1280](invitation/screenshots/teacher-invitation-dialog-1280.png), [1440](invitation/screenshots/teacher-invitation-dialog-1440.png). Summary: [invitation/native-e2e-summary.json](invitation/native-e2e-summary.json), [SQL parity](invitation/t033-roster-join-parity.json).
2. Live roster CSV. Chromium downloaded six fresh CSVs. Three authorized active-student rows matched PostgreSQL; the empty class produced a header-only CSV. Formula-like Unicode names, quoting, keyboard activation, unauthorized/404/500/network/timeout failures, stale identity and retry were exercised. Screenshots: [390](csv/roster-export-390.png), [768](csv/roster-export-768.png), [1280](csv/roster-export-1280.png), [1440](csv/roster-export-1440.png). API statuses: anonymous 401, cross-school 403, missing class 404; another same-school teacher's class is 404 under the existing resource-concealment contract. Evidence: [CSV/API/SQL summary](csv/t032-browser-database-evidence.json), [redacted CSV sample](csv/csv-sample-redacted.csv).
3. Growth → formal report → Remediation Runner. Student Growth displayed the real completed formal report (score 55/100, report 012aaec1-2fb7-4cfb-b8b1-e6c38f3f1bd1). The retry action created linked Remediation session 00b84e91-7dbc-4db5-9454-9f39ca8f5714 with 15 server-selected items (201). One lost browser response was reconciled with GETs; the browser submitted once, completed the retry Runner, and MinIO read-back confirmed four simulated microphone recordings. The remediation remained PROCESSING with six manual review items and no formal remediation report. Growth screenshots: [390](growth/growth-formal-390.png), [768](growth/growth-formal-768.png), [1280](growth/growth-formal-1280.png), [1440](growth/growth-formal-1440.png). Evidence: [native-evidence.json](growth/native-evidence.json).
4. Course activity → Runner → submit → complete → course return. The 20-item Runner submitted once with 201; course completion returned 201, including a deliberately dropped response followed by safe server reconciliation. The browser returned to the exact CourseDetail route once with matching Assignment, Submission, Activity and Attempt IDs; refresh issued no duplicate business POST. Course activity screenshots: [390](course/screenshots/activity-text-390.png), [768](course/screenshots/activity-text-768.png), [1280](course/screenshots/activity-text-1280.png), [1440](course/screenshots/activity-text-1440.png). Evidence: [browser-proof.json](course/browser-proof.json).

The combined run log is [native-e2e.log](native-e2e.log). All fixture accounts and business records are synthetic TEST_FIXTURE_ONLY data. Audio uses Chromium's fake microphone; no physical device or calibrated automatic scoring is claimed.

Captured text logs have only trailing line whitespace and extra terminal blank lines normalized to satisfy git diff --check; test output and diagnostic counts are unchanged.

## Verification

| Check | Result |
|---|---|
| Native integrated Chromium + NestJS API + PostgreSQL 17 + MinIO | 4 PASS / 0 FAIL / 0 SKIP |
| Frontend full test/runtime verification | 115 PASS / 0 FAIL / 0 SKIP ([log](frontend-test.log)) |
| API full test suite | 1109 PASS / 64 environment-gated SKIP / 0 FAIL ([log](api-test.log)) |
| Contracts Redocly lint + generator tests | 6 PASS / 0 FAIL / 0 SKIP ([log](contracts-test-after-contract-fix.log)) |
| Contracts generation | PASS; generated types match corrected OpenAPI ([log](contracts-generate-after-runtime-contract-fix.log)) |
| Workspace TypeScript checks | PASS across frontend, database, contracts, domain, API and worker ([log](workspace-typecheck-after-contract-fix.log)) |
| Workspace builds | PASS across frontend, database, contracts, domain, API and worker ([log](workspace-build-after-contract-fix.log)) |
| Prisma schema validation | PASS with one existing referential-action warning; validated with a non-connecting placeholder DATABASE_URL ([log](database-validate.log)) |
| Targeted API invitation source lint | PASS for src/modules/teacher-invitations ([log](api-invitation-lint.log)) |
| Full API lint | FAIL: 1201 errors / 1 warning ([full log](full-api-lint.log)); same count as the T029 report. T033 introduces no backend/api diff after T029. Most errors are existing unused/unsafe-type diagnostics; API test files also fail TypeScript project-service membership. |
| git diff --check | PASS |
| Docker / Compose / Worker / L4 access | NOT_RUN; L4 remains OPEN and untouched. |

The API lint command initially could not load undeclared @eslint/js from this fresh task worktree. The package was already present in the frozen lock/store; a temporary API-local symlink was used to run full and targeted lint, then removed. No API manifest or lockfile change was made. Full lint findings match the prior T029 report's 1201 errors / 1 warning; API files are unchanged since T029.

## Runtime exit and boundaries

The final owner-aware runtime record is [native-runtime-evidence.json](native-runtime-evidence.json): start/E2E/stop exit codes are all zero, all five T033 services stopped and all six T033 ports are free. T033 PostgreSQL data and MinIO objects remain retained for audit. No worker, Docker or Compose was used.

The target checkout's AGENTS.md has no V2.2 marker; this task followed the user-supplied development safety baseline and T033 card. The protected T005 main worktree, other task worktrees and their databases were not modified or stopped. No historical L4 path, process or data was accessed. No shared development branch was merged.
