# ACC-IDN-DB-001 dependency change request

## Decision

The approved dependencies have been added and the schema has been extended with
an explicit `SessionPair` model to enforce database-level session pairing and
rotation invariants. A logical identity session is now represented as:

- one `SessionPair` row carrying user, family, predecessor, refresh expiry,
  revocation and last-used metadata;
- two `Session` rows (type `ACCESS` and `REFRESH`) referencing the pair via
  foreign key, each storing a single irreversible token hash and its own expiry.

The previous client-side deterministic-UUID pairing has been replaced by
foreign-key and unique constraints:

- `Session.PairId -> SessionPair.Id` with `ON DELETE CASCADE`;
- `UNIQUE(SessionPair.familyId, predecessorPairId)` preventing multiple
  successors for the same predecessor within a family;
- `UNIQUE(Session.pairId, type)` enforcing exactly one access and one refresh
  row per pair;
- `UNIQUE(Session.tokenHash)` preventing hash reuse.

Refresh-token rotation uses an atomic `UPDATE` claim on `SessionPair` filtered
by the refresh token hash, expiry and `revokedAt IS NULL`. Only the request that
successfully updates the predecessor row may create the successor pair.

## Approved dependency change

Added to `apps/api/package.json` and `pnpm-lock.yaml`:

- `@prisma/adapter-pg@^7.8.0`
- `pg@^8.15.6`

`@types/pg` was not required because the adapter's own types are sufficient.

## Verification performed

1. Regenerated and built `@yuzan/database`.
2. Created migration `20260710180000_identity_session_pairing` and applied it
   with `prisma migrate deploy`.
3. Ran `apps/api/test/integration/identity/prisma-identity.repository.spec.ts`
   against PostgreSQL: 21 integration tests covering construction, credential
   lookup, membership filtering, pair creation, atomic rotation, replay
   rejection, revocation, expiry, cleanup and transaction rollback.
4. Ran the full `@yuzan/api` test suite: 125 tests pass.
5. Confirmed concurrent refresh yields exactly one successor and replay yields
   no successor.
6. Confirmed `pnpm install --frozen-lockfile` succeeds.
