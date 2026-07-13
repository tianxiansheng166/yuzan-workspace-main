# Recovered work map

| Location | Dirty files | Snapshot | Decision |
|---|---:|---|---|
| main checkout | 559 | `recovery/initial-product-recovery-002/root-status` | preserved read-only; no source copied into integration |
| `worktrees/b31-102` | 109 (107 untracked, 2 tracked deletions) | `recovery/initial-product-recovery-002/b31-102` | `RECOVER_UNCOMMITTED`; classify in CP6 |
| `worktrees/b31-105` | 3 | `recovery/initial-product-recovery-002/b31-105` | `RECOVER_UNCOMMITTED`; compare select-school in CP6 |
| V4 adoption worktree | 10 | `recovery/initial-product-recovery-002/frontend-v4-runtime/adoption` | evidence preserved; do not bulk-copy |
| V4 QA worktree | 2 | `recovery/initial-product-recovery-002/frontend-v4-runtime/qa` | evidence preserved; do not commit QA cache |

The external inventory and SHA-256 validation live at `reports/initial-product-recovery-002/RECOVERY-INVENTORY.md`. All 122 copied files were rehashed against source and snapshot with zero mismatches.