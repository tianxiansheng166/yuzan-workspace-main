# Windows Product Function Convergence 001

## Outcome

The first production vertical slice is implemented: persistent login and session rotation, current-user memberships, authorized school selection, teacher course-draft list/read/create/update, and atomic optimistic concurrency on PostgreSQL.

## Multimodal gate

- Source commit: `f86961d2cb4e2db7cb243d175eb2b8e54ad17a74`
- Images discovered/opened/failed: 18/18/0
- Gate: `MULTIMODAL_FUNCTION_GATE_PASSED`
- Functional conclusion: the teacher studio requires school-scoped draft structure editing, resource association, explicit saved/sync state, permission denial, offline handling, and concurrency feedback. Login and school selection are required entry capabilities even though this intake does not include dedicated screens for them.
- Raw images remain read-only and were not copied into product directories.

## Historical implementation audit

| Capability | Source | Decision |
| --- | --- | --- |
| Shared database runtime | `bb64e5107ac2084f6d9b37e09b826b2d3e3714b1` | Reused; one pool and one Prisma client. |
| Identity persistence | `0667e7e0d9034ad4200c7259cd8194f66a105101` | Rotation and pairing ported; independent dynamic Prisma client rejected and replaced with shared injection. |
| Organization persistence | `cbc9b8ef87c3f635ded48c48d03451934f711354` | Domain/API reused; generated client and private Prisma service rejected. Active/deleted school filters added to every membership path. |
| Curriculum persistence | `e9a8025b32d07356323fc0e4569b9c499e1908c9` | Mapping logic referenced; lost-update flow, global course upsert, raw DB error, missing URI, and unvalidated school/author/resource paths rewritten. |
| Web auth adapter | `0355b1b63f040d05a01e79d67fc57a66dd17a742` | Calling convention reused only in allowed functional adapter paths; pages/components rejected as out of scope. |
| UI foundation | `5736fd4b4fb4f2a84e0ebf9b5c4f4e15450b3ac8` | Inspected only; rejected because this task must not modify visuals. |
| API root wiring | `01d2440228c8cc8de31d957dcf52749fe8e9af27` | Boot/environment wiring ported and extended with database, organization, classes, and session auth. |

## Product and data behavior

- Auth: opaque access/refresh tokens are stored only as hashes. Refresh atomically claims and revokes its predecessor pair; replay fails. Logout revokes the pair and clears cookies. Disabled users, expired/revoked sessions, inactive memberships, and inactive/deleted schools fail closed.
- School selection: `POST /api/v1/auth/select-school` validates an opaque access session and an active membership in an active, undeleted school, creates the selected session, and revokes the predecessor.
- Accessible schools: `/api/v1/me` returns only active memberships joined to active, undeleted schools.
- Course drafts: list, read, create, and patch routes are school scoped. Creation validates school, author, teacher/admin membership, and referenced resource ownership.
- Concurrency: patch requires `expectedUpdatedAt`. The atomic `updateMany` predicate contains version id, school id, expected timestamp, editable status, undeleted course, author, and active/undeleted school. A zero-row claim returns a sanitized conflict without disclosing another tenant's resource.
- Resource references preserve `uri` in the persisted snapshot.
- Database errors are mapped to stable safe errors; SQL, host, port, schema, stack, and driver messages are not returned to clients.

## Contracts and schema

- OpenAPI and generated TypeScript contracts now include school selection and course version GET/PATCH.
- Functional web adapters live only under `apps/web/app/lib/api` and `apps/web/app/composables`.
- Migrations added:
  - `20260710180000_identity_session_pairing`: atomic session-pair lifecycle constraints.
  - `20260710180000_curriculum_bilingual_resource_meta`: bilingual/activity/resource snapshot fields needed for safe draft persistence.
- Rollback: deploy rollback code before manually reverting these additive migrations; preserve session/audit data before dropping columns or tables.

## Verification

- Windows runtime: Node 24.14.0, pnpm 10.13.1.
- Docker: PostgreSQL `127.0.0.1:55432`; MinIO `127.0.0.1:59000` and console `59001`.
- Prisma generate: passed.
- Prisma validate: passed.
- Prisma migrate deploy: four migrations passed on development and dedicated test databases.
- API typecheck: passed.
- Web typecheck: exited successfully; retained known Vue/Volar plugin warning.
- API tests: 17 files, 214 tests passed against dedicated PostgreSQL database.
- Startup smoke tests: live, ready, protected-route rejection, and graceful database shutdown passed.
- Known Windows issue retained: contract wrapper script `spawnSync pnpm.cmd EINVAL`; the same official generator executable succeeded directly under Node 24.
- Unrelated full-repository Vitest discovery failures were not fixed; they concern root module resolution, Vue plugin configuration, and existing UI fixtures outside this task.

## Scope and next task

No visual page, layout, style, icon, image, `MIG-003`, assignment, Student Today, assessment, `main`, or integration branch was modified. The next task can bind the independently developed visual pages to the stable adapters and contracts, followed later by Assignment create/publish and Student Today.
