# Contract Change Request: GOV-ROOT-001

- Status: accepted for local canonical-root migration
- Requestor: repository owner
- Owner: Integration Lead
- Task: `GOV-ROOT-001`
- Scope: root development environment and local runtime ownership

## Requested change

Make `three/yuzan-next` the canonical repository and consolidate the backend
runtime contract there. The root `.env.example`, `docker-compose.yml`, lockfile,
Flowise documentation/scripts and speech-scoring service become the maintained
local-development sources. Machine secrets remain only in ignored `.env` files.

## Shared facts

- PostgreSQL host port: `55432`; existing named volume:
  `yuzan-four-port-postgres-55432`.
- Redis host port: `6380`.
- MinIO API/console ports: `59000` / `59001`.
- API, Flowise and speech defaults: `4000`, `4300`, `8100`.
- Machine-specific FFmpeg location is supplied through `FFMPEG_DIR`.
- PostgreSQL bootstrap is opt-in through the Compose `bootstrap-db` profile so
  normal Compose commands do not accidentally replace the existing database.

## Compatibility and security

- Existing environment key names are retained; aliases required by SDKs are
  documented in `.env.example`.
- No real credential or production data is included.
- Existing Docker volumes are not deleted or recreated by this migration.
- Historical reports may retain old paths as evidence; active scripts must use
  repository-relative path resolution.

## Rollback

Stop only services launched from the new root, restore the prior root files from
`../legacy-archive/root-before-p0-20260722`, and restore the previous Git remote.
Back up PostgreSQL before any later volume ownership change.
