# YZ-RD-T021 Results

## Task and source

- `TASK_ID`: `YZ-RD-T021`
- `STATUS`: `DONE / WEB_ONLY / READY_TO_MERGE`
- `OUTPUT_BRANCH`: `feat/yz-rd-t021-student-profile-invitation-onboarding`
- `BASE_SOURCE`: `feat/yz-rd-t015-student-web-rollup@4475f418078e5800678a55b05d418d216962732e`
- Changes are limited to `frontend/student/profile/`, this task's E2E runner/test, and `evidence/yz-rd-t021/`.
- No shared navigation, API client, server, API, Prisma, OpenAPI, generated type, or other task files changed.

## Student onboarding and profile

- The profile reads the authenticated student's profile and the existing student-authorized `GET /schools/{schoolId}/classes?limit=100` list. The server scopes that class list to the current principal; the page does not send a client-selected role filter.
- After `POST /student/teacher-invitations/bind`, the page selects the returned school, fetches the profile and class list again, verifies the profile user ID and target class ID/name/grade, then displays the confirmed school and every authorized class. The Today and Practice links appear only after an active class is read from the authorized class API.
- The multi-school selector uses the current student's active school memberships. A switch clears the prior school's identity, classes, and statistics before requesting the new school and profile.
- A successful bind followed by a failed school switch shows `绑定状态待核实`; its retry only selects the school and re-reads the profile/class list. A bind whose response is lost can safely retry the same code: the real API returns `alreadyBound` for an existing enrollment and does not increment `usedCount` again.
- Failed invite input remains in the form. Duplicate click, existing enrollment, expired/revoked/exhausted codes, inactive teacher enrollment, network interruption, and profile refresh are covered in the E2E.
- Account changes clear the profile and invite code immediately, hide the stale shared navigation header, then reload so the shared header and profile both read the new session. Student B's view contains no Student A class or statistics.

## Learning statistics and visual design

- Explicit server counts display their returned values. A valid explicit `0` is shown as `0` with a note that the server returned zero activity-progress records. Missing fields display `—` and `暂无统计`; no-class identity shows `—`; a failed read shows a read error and never reuses cached values.
- No streak, score, rank, percentage, or recommendation is fabricated or shown.
- The profile retains the paper palette, growth image, red/green accents, and adds a hand-drawn SVG student→school→class pathway. Form, status announcements, school picker, and links are keyboard-accessible; reduced motion is honored.
- Chromium checked 390×844, 768×1024, 1280×960, and 1440×1000 with no horizontal overflow and full vertical content. Reduced-motion transition resolved to `0.00001s`.
- Screenshots: [390px](screenshots/profile-390.png), [768px](screenshots/profile-768.png), [1280px](screenshots/profile-1280.png), [1440px](screenshots/profile-1440.png).

## Real browser, API, and SQL evidence

- One real Chromium E2E passed with the NestJS API and PostgreSQL 17.11. Teacher A, Student A, and Student B were created through the real auth API; Teacher A created every invitation through the existing authorized teacher API.
- Student A joined one class in School A and two classes in School B through the real Profile page. PostgreSQL confirms two active Student memberships, three active Enrollments, and three `STUDENT_BOUND_TEACHER_INVITATION` AuditLog rows. The three successful invitations each have `usedCount=1`; an idempotent repeat and lost-response retry did not increase those counts.
- The browser verified school switching, profile refetch, all joined classes, Today navigation, logout/re-login persistence, and Student A→B account switching. Student B received `403` for Student A's school profile, class list, and school selection.
- Negative API status coverage: unauthenticated `401`; teacher attempting student bind, cross-tenant profile/classes/school switch `403`; invalid code `404`; expired, revoked, exhausted, and inactive-teacher invitations `409`. Rejected expired/revoked invitations stayed at `usedCount=0`; exhausted stayed at its preloaded limit; inactive-teacher invitation stayed at `0`.
- The partial-success case committed the real bind and SQL rows, then returned a one-time browser-side `503` for school selection. The page stayed in pending verification and performed no second bind POST before a successful real school selection/profile refetch. The lost-response case let the real API commit, dropped the browser response, then exercised the service's idempotent safe retry.
- The missing-stat check fetched a real profile response and omitted only the two optional statistic fields at the browser boundary; the UI displayed `—` and `暂无统计`. With the live response restored, SQL showed no ActivityProgress rows and the UI displayed the server's explicit `0` counts.
- Machine-readable SQL, identity, status, viewport, and invitation-use evidence is in [e2e-summary.json](e2e-summary.json); the captured run is [native-e2e.log](native-e2e.log).

## Verification

| Check | Result |
| --- | --- |
| Chromium + NestJS + PostgreSQL 17 E2E | PASS, 1 passed / 0 skipped |
| Frontend unit/runtime suite | PASS, 63 passed / 0 skipped |
| Teacher invitation API unit suite | PASS, 3 passed / 0 skipped |
| API typecheck and build | PASS |
| Prisma client generation and migrations | PASS on the isolated T021 database |
| JavaScript/Python/shell syntax and `git diff --check` | PASS |
| Physical-device/pilot/production validation | NOT_RUN; outside this WEB_ONLY task |

## Runtime ownership and safety

- T021 used `yuzan_t021_native` / `yz_t021`, fictional accounts, and ports PostgreSQL `55639`, Redis `6439`, MinIO `59204–59205`, API `4096`, and Web `4296`.
- Runtime versions: Node `24.20.0`, pnpm `10.13.1`, PostgreSQL `17.11`, Chromium `153.0.8010.52`.
- T021 stopped only its own services after the run. Final PIDs are in [native-pids.txt](native-pids.txt); [native-process-exit.txt](native-process-exit.txt) records that every T021 port is free. The isolated database and evidence are retained.
- The dirty shared `feat/question-bank-v1` checkout (T005 bilingual changes and original course resources) remained untouched. T015 remained clean. T022/T023 worktrees and all non-T021 services were not modified or stopped.
- No Docker or Compose was used. The L4 historical Docker-volume incident remains OPEN and was not accessed.
- This branch is ready to merge and is not merged. Final commit and remote SHA are reported in the task return.
