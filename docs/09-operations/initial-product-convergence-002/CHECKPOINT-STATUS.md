# Checkpoint status

| Checkpoint | Status | Commit | Validation |
|---|---|---|---|
| CP0 recovery | COMPLETE | external snapshot, no repository commit | 122 copies; source/snapshot SHA-256 recheck, 0 errors |
| CP1 auth/session/select-school | IN_PROGRESS | pending local WIP commit | web typecheck exit 0 with Volar plugin warning; 6 files / 32 tests passed |
| CP2 core Nuxt | PENDING | — | — |
| CP3 teacher/student live APIs | PENDING | — | — |
| CP4 VM A/B adoption | PENDING | — | — |
| CP5 four entries | PENDING | — | — |
| CP6 recovered backend ruling | PENDING | — | — |
| CP7 product smoke | PENDING | — | — |

Commands actually run for CP1:

- `pnpm.cmd --filter @yuzan/contracts build` — exit 0.
- `pnpm.cmd --filter @yuzan/web typecheck` — exit 0; Volar route-block plugin load warning remains.
- `pnpm.cmd --filter @yuzan/web test tests/api/product-api-client.spec.ts tests/auth/live-gateways.spec.ts tests/auth/login-page-state.spec.ts tests/school-selection/state.spec.ts tests/school-selection/page-contract.spec.ts tests/school-selection/live-browser-gateway.spec.ts` — 6 files, 32 tests passed.