# ACC-IDN-DB-001 dependency change request

## Decision

The current Prisma schema is sufficient without modification. A logical
identity session is persisted as an access-token row and refresh-token row,
paired by deterministic UUIDs. Each row stores only a prefixed SHA-256 token
hash and its own expiry. Rotation conditionally revokes the refresh row and
creates exactly one successor pair in a serializable transaction.

## Blocking dependency change

Prisma 7.8's configured `prisma-client` generator emits a query-compiler client
that requires a driver adapter. The workspace currently has neither
`@prisma/adapter-pg` nor `pg`, and ACC-IDN-DB-001 is not permitted to modify
`apps/api/package.json` or `pnpm-lock.yaml`.

Please approve adding compatible versions of:

- `@prisma/adapter-pg`
- `pg`
- `@types/pg` as a development dependency if required by the adapter version

Until approved, `PrismaIdentityRepository` deliberately throws
`AUTH_SERVICE_UNAVAILABLE` during construction. No login or persistence success
is fabricated.

## Verification after approval

1. Regenerate and build `@yuzan/database`.
2. Run `apps/api/test/integration/identity/prisma-identity.repository.spec.ts`
   against migrated PostgreSQL.
3. Confirm concurrent refresh yields exactly one successor and replay yields no
   successor.
