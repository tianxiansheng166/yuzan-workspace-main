# VM2 Ubuntu Evacuation Report - 20260711

## Overview

- **Evacuation date**: 2026-07-11
- **Task**: UBUNTU_VM2_FULL_EVACUATION_001
- **Repository**: git@github.com:tianxiansheng166/yuzan-workspace-main.git
- **Base path**: /home/tian/文档/yuzan-workspace-main/yuzan-next
- **Worktree root**: /home/tian/文档/yuzan-workspace-main/worktrees
- **Recovery path**: /home/tian/文档/yuzan-workspace-main/recovery/windows-evacuation-vm2-20260711
- **Handoff branch**: evacuation/vm2-handoff-20260711 (from integration/core-framework-20260710 @ 577a7442)

> **Redaction note**: This report contains no passwords, access keys, secret keys, SSH keys, or database connection strings. All credentials are redacted.

## 1. Git Inventory Summary

- **Worktree count**: 41 (1 main + 20 branch worktrees + 20 detached review/smoke snapshots)
- **Clean worktrees**: 41 (all clean, 0 dirty)
- **Dirty worktrees originally**: 0
- **Dirty worktrees preserved**: 0 (none needed)
- **Detached worktrees**: 20 (all commits confirmed on remote, no evacuation needed)
- **Stashes**: 0
- **Stashes preserved**: 0 (none existed)
- **Local-only commits**: 1 (preserved via evacuation branch)
- **fsck**: clean (no errors, no unreachable objects)

### Branches

- **Branches pushed normally (already synced)**: 20 (all task/integration/main branches)
- **Evacuation branches created**: 2
  - `evacuation/vm2/mig-003-local-20260711` @ 358d568 (preserves local-only commit from diverged task/mig-003-migration)
  - `evacuation/vm2-handoff-20260711` @ 577a744 (this handoff report branch)
- **Branches still not remote**: 0
- **Unapproved branches merged to integration**: 0

### Diverged branch: task/mig-003-migration

- **Local HEAD**: 358d568fed932d822a24abb1edb2dc0650104dc9
- **Remote HEAD**: 5afdfe0678dbe26049ecbd4def12d0b56a181aa2
- **Divergence**: ahead=1, behind=3
- **Preservation**: Local-only commit 358d568 preserved via `evacuation/vm2/mig-003-local-20260711` branch pushed to origin. No force push, no rebase, no amend used. The diverged task/mig-003-migration branch was NOT force-pushed (remote has 3 commits local does not have).

## 2. Integration Branches Status

| Branch | Commit | Synced | Eligible |
|--------|--------|--------|----------|
| integration/core-framework-20260710 | 577a7442b1f7d46b4b656a6db9143c6afbc519d8 | Yes | Integration branch |
| integration/frontend-redesign-20260710 | c906acf05a78dd54f48068021b14d1577aeeea26 | Yes | Integration branch |
| integration/vm2-competition-mvp-v2 | bf2aa65ec0eb4b90f8aaa8629d8eedc069067dde | Yes | Integration branch |
| integration/vm2-original-wave100 | 5825955cc7031414aa0ae72a3a4f01a0755dfbaf | Yes | Integration branch |

No unapproved branches were merged to any integration branch.

## 3. PostgreSQL Backup

- **Actual database**: Host PostgreSQL 14.23 on 127.0.0.1:5432 (NOT Docker container)
- **Docker postgres**: postgres:17-alpine container never started (port 5432 conflict with host)
- **Databases**: `yuzan` (main), `yuzan_db_runtime_test` (test)
- **Schema**: 31 business tables + _prisma_migrations
- **Migrations applied**: 2 (20260708174110_baseline_init, 20260709120058_gov_003_mvp) - both finished, not rolled back
- **Data**: All business tables have 0 rows (empty schema, no business data)
- **Database size**: 10 MB each
- **Extensions**: plpgsql only

### Dump files (private, NOT pushed to GitHub)

- `yuzan-postgres-20260711.dump` - custom format, 98K, verified with pg_restore --list (258 TOC entries)
- `yuzan-schema-20260711.sql` - schema only, 61K
- `yuzan-test-postgres-20260711.dump` - test db custom format, 98K, verified
- SHA256 checksums generated for all dump files
- Custom format is portable for restore to Windows Docker PostgreSQL 17

## 4. MinIO Backup

- **MinIO service**: yuzan-next_minio_1 (minio/minio:latest)
- **MinIO image digest**: sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e
- **Status**: EMPTY
- **Buckets**: 0
- **Objects**: 0
- **Total bytes**: 0
- **Verification**: Read-only volume inspection (mc client unavailable). Volume only contains .minio.sys internal metadata.
- **Note**: MinIO volume was freshly created during evacuation. No user data existed. No fake data generated.

## 5. Docker Environment

- **Docker version**: 29.1.3
- **docker-compose version**: 1.29.2 (v1 standalone)
- **Docker daemon**: Was failed (invalid /etc/docker/daemon.json with unsupported "proxies" directive). Fixed by removing invalid "proxies" key (original backed up to recovery/private/daemon.json.original.bak). Daemon started successfully.
- **Containers**: yuzan-next_minio_1 (Up), yuzan-next_postgres_1 (Created, never started), rm_vision_container (Exited, unrelated)
- **Volumes**: yuzan-next_yuzan-minio (empty), yuzan-next_yuzan-postgres (empty)
- **Networks**: yuzan-next_default, bridge, host, none

## 6. Secrets

- Secret files manifest created at recovery/private/secret-files-manifest.txt
- Records paths, sizes, SHA256, and purposes only
- NO values recorded
- Secrets NOT pushed to GitHub
- Database dumps NOT pushed to GitHub
- MinIO data NOT pushed to GitHub (was empty)
- SSH keys NOT pushed to GitHub

## 7. Git Bundle

- `yuzan-all-refs-vm2.bundle` - 6.2M, all refs
- SHA256: f8424a8934cc66505f08b8ae6ad7bcae902db35a6787daa2ae71e55a693f4e7e
- Verified with git bundle verify: OK
- NOT pushed to GitHub (private local backup)

## 8. Compliance

- main modified: No
- force push: No
- amend: No
- rebase: No
- reset --hard: No
- git clean: No
- Unapproved branches merged to integration: No
- Database dump pushed to GitHub: No
- MinIO data pushed to GitHub: No
- .env pushed to GitHub: No
- SSH key pushed to GitHub: No
- Full database connection string output: No

## 9. Remaining Blockers

None. All safe code and branches preserved on GitHub. Private backups (database dumps, MinIO, secrets manifest, git bundle) are in the local recovery directory.

## 10. Windows Recovery Notes

- On Windows, restore using the git bundle or clone from GitHub
- PostgreSQL: restore custom-format dump with `pg_restore` to Docker PostgreSQL 17 (cross-version compatible from PG14 source)
- MinIO: empty, no restore needed; create fresh on Windows Docker
- Environment variables: migrate .env values through secure channel (not via GitHub)
- Prisma migrations are in the repo at infra/database/prisma/migrations/
