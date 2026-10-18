# YZ-RD-T023 Results

**STATUS: DONE** — native Chromium + NestJS API + PostgreSQL end-to-end passed.

## Branch and scope

- Baseline: `feat/yz-rd-t020-teacher-home-action-center` at `e6b8e8aa0b2f8cfe9a3bed894f264c73f64e1f3c`.
- Output branch: `feat/yz-rd-t023-teacher-class-invitation-web`.
- This evidence file is included in the T023 commit. The final commit and push SHA are reported in the task return.
- Product edits are limited to the six authorized teacher class-detail and AI-tools files. Student Profile, shared teacher shell, API client, backend, Prisma, OpenAPI, and generated types were not edited.

## Real teacher invitation and PostgreSQL binding

Teacher C signed in through Chromium, opened their own class from the teacher home class list, and selected **邀请学生加入本班**. The UI read `listMyTeacherInvitations()` and hid a real invitation belonging to Teacher C’s other class by matching `item.class.id`. Teacher C selected one use and 30 days; the UI submitted `classId`, `maxUses`, and `expiresInDays` to `createTeacherInvitation()` and displayed only the server-returned code.

The create response was deliberately dropped after the server returned HTTP 201. The browser re-read the invitation list and found the created record. Only one POST was made; no idempotency claim is made. The code is absent from this file, JSON evidence, and logs. Screenshots mask the code field.

T023 used its own PostgreSQL 17 database/user (`yuzan_t023_native` / `yz_t023`), school, classes, Teacher C, Teacher B, and students. All fixture identities are fictional and tagged `TEST_FIXTURE_ONLY`.

- School ID: `4c347c5a-00e7-4409-9def-b5cbe1469b4d`
- Teacher C user ID: `1e0939d2-41af-42c5-b20e-c5cd18b66698`
- Teacher C main class ID: `3d934c20-12a7-427a-a419-f3b74d41b19b`
- Teacher C main-class enrollment ID: `3b4b6423-e7f1-4f7a-846b-b81d50099fbe`
- Teacher C other class ID: `39a2dfb5-746c-48ab-aa8b-b4b2a8b76779`
- Teacher C other-class enrollment ID: `f0943ae4-db35-4cfd-a91f-5ad753830b33`
- Teacher B user ID: `a7f3454b-7504-4a22-8f19-e78ccf37501a`
- Teacher B class ID: `2c73d7f6-a29f-4a7f-8455-994cdd14d6d6`
- Student A user ID: `0e08d7e2-b25c-4e0e-8997-171a7561c1f9`
- Membership ID: `f81e2808-a8bf-4ce9-8767-8670278b47e7` — `ACTIVE`, role `STUDENT`.
- Enrollment ID: `681ed347-9c8b-4c05-89c7-09bed73bb03b` — `ACTIVE`, role `STUDENT`, in the exact School/Class above.
- TeacherInvitation ID: `f4a4dcf9-34c7-4f05-8a8a-a35d8a7e6f4b` — `usedCount=1`, `maxUses=1`; the server returned a real future `expiresAt`.
- AuditLog ID: `23b302f1-6e7f-4339-8731-3312170db43e` — `STUDENT_BOUND_TEACHER_INVITATION`, linked to that invitation and class.
- Repeating Student A’s bind returned `alreadyBound=true`; PostgreSQL still has one active Enrollment and `usedCount=1`.

The exact saved ID/status/count evidence is in [browser-database-evidence.json](browser-database-evidence.json). These SQL checks were run against the T023 database:

```sql
SELECT id, status, role
FROM "Membership"
WHERE id = 'f81e2808-a8bf-4ce9-8767-8670278b47e7';

SELECT id, "schoolId", "classId", "userId", role, status
FROM "Enrollment"
WHERE id = '681ed347-9c8b-4c05-89c7-09bed73bb03b';

SELECT id, "schoolId", "classId", "teacherUserId", "usedCount", "maxUses", "expiresAt"
FROM "TeacherInvitation"
WHERE id = 'f4a4dcf9-34c7-4f05-8a8a-a35d8a7e6f4b';

SELECT id, "actorUserId", "schoolId", action, "resourceType", "resourceId", "afterSummary"
FROM "AuditLog"
WHERE id = '23b302f1-6e7f-4339-8731-3312170db43e';
```

After binding, Student A opened Today in Chromium. PostgreSQL showed no open Assignment or PracticeDelivery for this class; Today showed its real empty state and no primary task.

## Status, authorization, retries, and clipboard

- UI status cards use server values `ACTIVE`, `EXPIRED`, `REVOKED`, and `EXHAUSTED`; they show the returned counts and expiry. Inactive codes are hidden. UI count in the final fixture: 0 ACTIVE, 1 EXPIRED, 1 REVOKED, 2 EXHAUSTED (the consumed invite and an exhaustion negative fixture).
- A list read interrupted in the browser showed **服务器读取失败**; the explicit retry re-read the server and kept the other-class code hidden.
- Clipboard denial in Chromium showed failure, selected the actual input for manual copy, and did not show success. A subsequent real `navigator.clipboard.writeText()` completed, the browser read back the same code, and Student A pasted it into `/student/profile/` and submitted the bind form.
- Auth/negative API evidence: unauthenticated create `401`; Student create `403`; Teacher B creating for Teacher C’s class `403`; nonexistent class `404`; invalid code `404`; expired, revoked, and exhausted bind `409`. Duplicate bind returned `201` with `alreadyBound=true` and did not consume another use.
- Account and school switching cleared the open teacher invitation before another account/school could see it.
- AI tools coworker invitation is labelled **教师工具 · 邀请同事**, fetched only from the teacher-tools endpoint, and explicitly says it cannot be used for student enrollment. Its API-failure browser check showed no fallback code and no success message. The fixed `TCH-7Q1A-B9K2` value and stale page-text copy fallback are removed.

## Responsive and accessibility evidence

No horizontal overflow was measured at 390, 768, 1280, or 1440px. The 761–900px teacher-shell minimum-width issue is overridden only in the authorized class-detail stylesheet. The dialog has an accessible name, keyboard Tab remains within it, Escape closes it and clears the in-memory code, focus returns to the opener, and Chromium tested `prefers-reduced-motion: reduce`.

- [390px screenshot](class-invitation-390.png)
- [768px screenshot](class-invitation-768.png)
- [1280px screenshot](class-invitation-1280.png)
- [1440px screenshot](class-invitation-1440.png)
- [Inactive states, top](class-invitation-inactive-states-top.png)
- [Inactive states, bottom](class-invitation-inactive-states-bottom.png)

The four active-state screenshots mask the server-issued code. No full code is in the report, browser JSON, or E2E log.

## Verification

- Native Chromium + real NestJS API + T023 PostgreSQL E2E: **PASS — 1 passed, 0 failed, 0 skipped**.
- Backend `TeacherInvitationsService` targeted tests: **PASS — 3 passed**.
- Frontend suite and runtime verification: **PASS — 32 passed; Frontend Runtime verified**.
- T023 invitation UI contract tests: **PASS — 4 passed**.
- API production build, Prisma client generation, and all 32 migrations: **PASS**.
- Node/Python syntax checks and `git diff --check`: **PASS**.
- Browser details, API statuses, dynamic SQL IDs, dimensions, and invitation usage evidence: [browser-database-evidence.json](browser-database-evidence.json).

## Resource safety and merge state

T023’s own PostgreSQL, API, web, Redis, and MinIO PIDs are recorded in [native-runtime-evidence.json](native-runtime-evidence.json); all six T023 ports (55663, 4123, 4323, 6463, 59263, 59264) are stopped. The T023 database, MinIO bucket, logs, and test evidence are retained. The Worker was not started. T022’s services remained running and were not stopped. No Docker/Compose operations were run; the L4 historical PostgreSQL volume issue remains **OPEN**.

T005, T019, T020, T021, and T022 source/worktree files were not staged or modified by T023. The main worktree’s existing T005 changes remain outside this branch. T023 is **READY_TO_MERGE** on its own pushed branch and has **not** been merged into `feat/question-bank-v1`. The only follow-up gap is that the existing backend has no revoke-invitation API, so the UI displays revoked state but intentionally offers no revoke action.
