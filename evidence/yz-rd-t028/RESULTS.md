# YZ-RD-T028 Results

**STATUS: DONE / WEB_ONLY / READY_TO_MERGE_NOT_SHARED_MERGED**

## Source and branch

- Exact base: `feat/yz-rd-t023-teacher-class-invitation-web@34af873837c9cfb74a7be33e94617b94668b4f4d`
- Output branch: `feat/yz-rd-t028-teacher-invitation-revocation`
- Implementation commit: `6801bf7a33a9c8b5f59a7aa92a3a7b50dc6cda0e`
- The T023 worktree remains clean. This branch is not merged into `feat/question-bank-v1` or T026.
- The target checkout's `AGENTS.md` does not contain the V2.2 marker. I read the supplied V5.12 Blueprint and followed the current T028 Owner/runtime contract; this mismatch did not affect offline implementation.

## API_REQUEST_RESULT

- Method/path: `POST /schools/{schoolId}/teacher-invitations/{invitationId}/revoke` (browser URL includes `/api/v1`).
- Request: no body; `schoolId` and UUID `invitationId` are path parameters.
- Authorization: authenticated `TEACHER`, current tenant matches `schoolId`, invitation belongs to the teacher, and an ACTIVE teacher Enrollment exists in the invitation's exact school/class.
- Statuses: `200` server-confirmed `REVOKED`; `401` unauthenticated; `403` student, tenant, owner, or class mismatch; `404` unknown invitation; `409` expired, exhausted, or concurrently invalidated invitation.
- Repeated revoke returns `200` with the same redacted `REVOKED` state and no second audit. Expired/exhausted invitations return `409` and are not changed.
- Response: existing `TeacherInvitationResponse` with `id`, `class`, `usedCount`, `expiresAt`, `createdAt`, `status`; `code` is `null` for every non-ACTIVE state. The response contains no secret code.
- Transaction: conditional `updateMany` requires `revokedAt: null`, unexpired status, remaining uses, matching school and owner. It serializes with the existing bind claim; audit creation is in the same transaction.
- Audit: `TEACHER_INVITATION_REVOKED`, `resourceType=TeacherInvitation`, exact `resourceId`, class in `afterSummary`, UTC ISO timestamp in `afterSummary.revokedAt`, and the request's actual request ID.
- Contract/client: OpenAPI and generated types add `revokeTeacherInvitation`; `frontend/assets/api-client.js` adds the POST client. The Class Detail UI is its only new consumer. Student Profile bind remains on its existing endpoint and behavior. T026 did not receive shared APIClient/OpenAPI edits.

## Real browser and PostgreSQL evidence

- Runtime: Node 24.20.0, pnpm 10.13.1, PostgreSQL 17.11, Redis 7, MinIO, real Chromium. Fictional Teacher C opened their authorized Class Detail and created the active invitation; Student A joined through the existing Profile form before revocation.
- Teacher clicked **撤销邀请码**, reviewed the required retained-student warning, and confirmed. The server committed `200` while the browser response was dropped. The UI made one POST, then GET `mine` confirmed `REVOKED`; it did not retry POST. Repeated server revoke returned `200` without another audit.
- Invitation `2eaebaf8-97b4-40a2-9f4a-2052d21a8115`: PostgreSQL `revokedAt=2026-10-19 00:44:14.395`; usage stayed `1`; exactly one `TEACHER_INVITATION_REVOKED` AuditLog row `7dfd7a13-a874-4cea-ae4b-db1283046458`; `afterSummary.classId=0d1dcd6d-8269-44d2-8d0a-42a692d64034`; UTC audit time `2026-10-19T00:44:14.395Z`; request ID `71426907-f99d-4fac-b9ee-dc72e207bb33`.
- Student A `4918030b-d24e-4667-af3a-f2f1ab937dac` retained ACTIVE Membership `3a32ca6a-a543-412e-9b75-f590cdfccea2` and ACTIVE Enrollment `ea633a8a-d6de-4574-ab5f-11335bf3401b` after revoke.
- Student B `39d4d754-a737-4d30-a400-6553c8b12811` received Profile `409` for the old code. Their pre-existing ACTIVE Membership remained the same row `f5e5ef01-71f0-48a8-ba17-4c226f167239`; no Enrollment was created and the old invitation's `usedCount` stayed `1`. Teacher created a replacement through Class Detail; Student B joined it through Profile (`201`), creating ACTIVE Enrollment `b562439c-9755-45e8-8402-0d38976392af`, `usedCount=1`, and one bind audit. The replacement code is masked in evidence.
- Deterministic PostgreSQL row-lock races: bind-first invitation `0f67c198-b7ac-4098-8387-bc76b017d38a` returned bind `201`, revoke `200`, and Student C retained ACTIVE Enrollment `7173549f-1e85-487d-8bbe-91364ddbbfe9`; revoke-first invitation `5aebfd38-5616-4492-898e-c40ad362ceee` returned revoke `200`, later bind `409`, Student D enrollment count `0`, `usedCount=0`, and one revoke audit.
- A pre-commit network abort reconciled through GET to ACTIVE, kept the code visible only as the currently server-confirmed active credential, and showed no success. The committed-response-drop path reconciled through GET to REVOKED and hid the code.
- The first list GET failure had an independent GET retry. School and account switches cleared invitation state. Clipboard denial selected the actual code for manual copy without success; a real Clipboard write/read round trip succeeded. Teacher coworker-code remains unchanged and separate.
- Screenshots: `revoke-class-detail-{390,768,1280,1440}.png`. All four had zero horizontal overflow; the revoked card had zero code inputs, copy controls, and revoke controls. Keyboard focus loop, Escape cancel, confirmation wording, focus restoration, and reduced-motion preference were checked. No full token appears in screenshots, text evidence, or logs.
- Detailed IDs/statuses and sanitized API event data: `t028-browser-database-evidence.json`. Native process/PID and port stop evidence: `native-runtime-evidence.json`.

## Verification

| Check | Result |
|---|---|
| Native Chromium + Nest API + PostgreSQL E2E | PASS 1 / SKIPPED 0 |
| Invitation service suite | PASS 11 / SKIPPED 0 |
| Whole API suite | PASS 1,106 / SKIPPED 64 (73 files passed; 10 integration/environment files skipped) |
| Frontend suite, including T028 | PASS 37 / SKIPPED 0 |
| T023 invitation UI regression contract | PASS 4 / SKIPPED 0 |
| OpenAPI Redocly + generated contract tests | PASS 6 / SKIPPED 0 |
| API typecheck and build | PASS |
| Prisma validate | PASS; existing required-relation `SetNull` warning only |
| Python E2E/runner compile | PASS |
| `git diff --check` | PASS |

The harness had intermediate fixture/config failures while options, refresh flow, and a transient port collision were corrected. No unresolved test failure remains; the final native E2E above passed. The T028 database retained fictional fixtures from these attempts and was not deleted or reset.

## Isolation and exit

- T028 owns database/user `yuzan_t028_native` / `yz_t028`, bucket `yz-t028-native`, API 4128, Web 4328, PostgreSQL 55828, Redis 6468, MinIO 59268–59269, and `runtime-local/native-web-t028`.
- PostgreSQL port 55668 failed to bind during startup. T028 alone was moved to verified-free 55828; the existing T028 database directory and credentials were preserved. T025/T026/T027 port configurations were inspected read-only and left running/untouched.
- Final T028 PIDs: PostgreSQL 1974101, API 1974984, Web 1975126, Redis 1974132, MinIO 1974143, Chromium pytest 1975551. Owner-aware stop passed; all six T028 ports are closed. Worker was not started. DB, bucket, screenshots, and logs are retained.
- No Docker, Compose, P1-SIM, physical school, production deployment, or speech scoring was used. Historical shared Docker PostgreSQL volume incident L4 remains OPEN and untouched.
- T005's dirty `feat/question-bank-v1` checkout, T025 Growth, T026 integration, and T027 student worktrees were not edited or staged. T023 stayed clean. The current branch is ready for separate Owner review/merge; it has not been merged into shared work.

## Remaining work

No T028 web/API implementation gap remains. The branch is ready for separate Owner review and integration into T026 after that line is ready; it has not been merged into shared work.
