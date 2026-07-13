# Recovered work map

| Location | Dirty files | Snapshot | Decision |
|---|---:|---|---|
| main checkout | 559 | `recovery/initial-product-recovery-002/root-status` | preserved read-only; no source copied into integration |
| `worktrees/b31-102` | 109 (107 untracked, 2 tracked deletions) | `recovery/initial-product-recovery-002/b31-102` | recovered at `caca816`; do not integrate until persistence, root wiring and type errors are resolved |
| `worktrees/b31-105` | 3 | `recovery/initial-product-recovery-002/b31-105` | recovered at `f86bb0d`; exact three-file checkpoint selectively adopted as `f071a0a` |
| V4 adoption worktree | 10 | `recovery/initial-product-recovery-002/frontend-v4-runtime/adoption` | evidence preserved; do not bulk-copy |
| V4 QA worktree | 2 | `recovery/initial-product-recovery-002/frontend-v4-runtime/qa` | evidence preserved; do not commit QA cache |

The external inventory and SHA-256 validation live at `reports/initial-product-recovery-002/RECOVERY-INVENTORY.md`. All 122 copied files were rehashed against source and snapshot with zero mismatches.

## CP6 classification

| Recovered area | Classification | Evidence and integration ruling |
|---|---|---|
| assessment domain, DTOs, policies and repository ports | `DOMAIN_REUSABLE`, `DTO_REUSABLE`, `POLICY_REUSABLE`, `PORT_REUSABLE` | preserve for a persistence follow-up; no copy into the integration branch |
| assessment/recommendation/speech/report fake repositories and unit tests | `TEST_REUSABLE` | direct scoped run passed 18 files / 280 tests |
| assessment, recommendation, speech and assessment-report modules | `UNAVAILABLE_SCAFFOLD`, `BROKEN` | eight unavailable repositories; no API-root wiring; scoped API typecheck failed |
| assessment persistence | no `REAL_PERSISTENCE` | no PostgreSQL repository or schema/contract checkpoint was recovered |
| `AssessmentAccessController` | compile breakpoint repaired in recovery branch | missing import fixed before `caca816`; module remains unintegrated |
| b31-105 active-school evidence | `TEST_REUSABLE`, `DOCUMENTATION` | endpoint already existed; only service comment, controller route assertion and freeze record adopted |

Commands actually run in CP6:

- b31-102 direct Vitest scope: 18 files / 280 tests passed.
- b31-102 API typecheck: failed on recovered exact-optional/type-model errors plus the worktree database package baseline; it is not reported as passed.
- b31-105 auth scope: 3 files / 52 tests passed.
- b31-105 API typecheck: failed on the worktree's missing generated database package and pre-existing curriculum/offline/reporting errors; it is not reported as passed.
