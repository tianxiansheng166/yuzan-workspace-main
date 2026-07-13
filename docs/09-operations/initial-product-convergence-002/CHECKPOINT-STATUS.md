# Checkpoint status

| Checkpoint                     | Status      | Commit                                  | Validation                                                                                                                                                              |
| ------------------------------ | ----------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CP0 recovery                   | COMPLETE    | external snapshot, no repository commit | 122 copies; source/snapshot SHA-256 recheck, 0 errors                                                                                                                   |
| CP1 auth/session/select-school | COMPLETE    | `6ad86fb`                               | web typecheck exit 0 with Volar plugin warning; 6 files / 32 tests passed                                                                                               |
| CP2 core Nuxt                  | COMPLETE    | `47aeacb`                               | teacher hub and student courses/today/player integrated; live-core scope included in 40-test pass                                                                       |
| CP3 teacher/student live APIs  | COMPLETE    | `559bdd3`                               | live gateway; 6 files / 25 targeted tests passed                                                                                                                        |
| CP4 VM A/B adoption            | COMPLETE    | `5c5cf7e`                               | 5 routes ported; 7 route rulings recorded; VM A 10/10 and VM B 91/91 hashes verified; 2 entry-live test files rerun in CP5 validation                                   |
| CP5 four entries               | COMPLETE    | `4af5ce0`                               | shared four-entry navigation implemented; contract-only membership roles restored; 4 files / 22 targeted tests passed; web typecheck exit 0 with existing Volar warning |
| CP6 recovered backend ruling   | COMPLETE    | `caca816` recovery; `f86bb0d` recovery; `f071a0a` adopted | b31-102: 18 files / 280 tests passed but typecheck failed and persistence is unavailable; b31-105: 3 files / 52 tests passed; only three evidence files adopted |
| CP7 product smoke              | PENDING     | —                                       | —                                                                                                                                                                       |

Commands actually run for CP1:

- `pnpm.cmd --filter @yuzan/contracts build` — exit 0.
- `pnpm.cmd --filter @yuzan/web typecheck` — exit 0; Volar route-block plugin load warning remains.
- `pnpm.cmd --filter @yuzan/web test tests/api/product-api-client.spec.ts tests/auth/live-gateways.spec.ts tests/auth/login-page-state.spec.ts tests/school-selection/state.spec.ts tests/school-selection/page-contract.spec.ts tests/school-selection/live-browser-gateway.spec.ts` — 6 files, 32 tests passed.

Commands actually run while completing CP4/CP5:

- `apps/web/node_modules/.bin/vitest.CMD run tests/entry-live/gateway.spec.ts tests/entry-live/pages.spec.ts tests/app-shell/layout-contract.test.ts tests/school-selection/state.spec.ts` — 4 files, 22 tests passed.
- `apps/web/node_modules/.bin/nuxi.CMD typecheck` — exit 0; the pre-existing `vue-router/volar/sfc-route-blocks` plugin warning remains.
- The first `pnpm` call was blocked by the Windows script execution policy; a later bundled-pnpm attempt aborted an implicit modules-directory refresh because no TTY was present. Neither failed invocation is reported as a project validation pass.

Commands actually run for CP6 are recorded in `RECOVERED-WORK-MAP.md`. CP6 intentionally did not integrate the b31-102 modules: the recovery branch is safe at `caca816`, but the product branch must continue to expose pending/unavailable assessment states.
