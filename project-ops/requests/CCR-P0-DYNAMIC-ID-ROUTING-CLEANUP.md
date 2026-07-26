# CCR-P0-DYNAMIC-ID-ROUTING-CLEANUP

- Task: `P0-DYNAMIC-ID-ROUTING-CLEANUP`
- Goal: `MVP-LEARNING-EVIDENCE-001` revision 1
- Owner: API contract owner
- Requested by: `codex-account-c-dynamic-builder`
- Status: `IMPLEMENTED_PENDING_REVIEW`

## Contract change

`Submission` gains optional fields for evidence already persisted against the
dynamic submission:

- `writtenAnswer`
- `recordingId`
- `recordingUrl`
- `recordingDuration`
- `feedback`

The fields are omitted when no real linked evidence exists. `recordingUrl` is a
short-lived URL generated from the persisted recording object key. `feedback`
is the latest persisted feedback record.

## Compatibility and ownership

- This is an additive response change; existing consumers remain compatible.
- No Prisma schema, status enum, request shape, or route changes.
- Product authorization maps `decision=RETURN` to the existing public/server
  status `RETURNED`; no `REDO_REQUIRED` enum is introduced.
- Provider: `backend/api/src/modules/submissions`.
- Existing consumer: `frontend/teacher/submissions/detail/app.js`.

## Generated artifacts and evidence

- Source: `packages/contracts/openapi/openapi.yaml`
- Generated: `packages/contracts/src/generated.ts`
- Generation: `pnpm --filter @yuzan/contracts generate`
- Validation: `pnpm --filter @yuzan/contracts test` — `PASS` (OpenAPI valid,
  generator tests 6/6)

Rollback removes the optional schema properties and regenerates
`packages/contracts/src/generated.ts` together with reverting the provider
change.
