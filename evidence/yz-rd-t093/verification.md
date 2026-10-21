# YZ-RD-T093 verification receipt

## Scope and ownership

- `TASK_ID`: YZ-RD-T093
- `BASE`: `abf95ca78cfac816b0af7148a4c86c296c4870ff`
- `BRANCH`: `feat/yz-rd-t093-truthful-web-login-no-demo-token`
- `ACTUAL_WORKTREE`: `/home/tian/.devspace/worktrees/yuzan-workspace-t093`
- `REPO_AGENTS_READ`: `/home/tian/code/AGENTS.md` and the repository `AGENTS.md` at BASE; also read `README-FIRST.md` and the unrelated `CURRENT_TASK.md` for startup context. Searched `CURRENT_HANDOFF.md` for T093/FC-TRUTHFUL-LOGIN references; none were present.
- `NOTION_POLICY_READ`: `READ_OK` — POLICY_REF, LANE_REF, and ROUTING_REF fetched during this task.
- `LEGACY_CONTROL_PLANE`: `NOT_REQUIRED_PER_AGENTS` — ordinary feature development; no PowerShell, lease, fencing epoch, or control-plane lock was used.
- `FILE_OWNER_GUARD`: the main checkout was left untouched. Its pre-existing T005 changes were not diffed or staged. This worktree was clean at BASE before edits; changes are limited to the three login files, this focused test, and this evidence directory.

## Authentication contract read from BASE

- `frontend/assets/api-client.js` exposes `login(identifier, password)` and `register(identifier, password, role)`. It unwraps the API `data` object, stores only API-returned token/user/school values, and exposes `getHomeUrlByRole(user)` based on the returned user's memberships.
- `backend/api/src/modules/identity/identity.controller.ts` sets the server session cookies and returns `accessToken`, `activeSchoolId`, `expiresIn`, and the server-produced `user`. `CurrentUser.memberships` contains the server's school IDs/names and membership roles. Login and registration DTOs require an identifier and password; registration role is the existing `MembershipRole` enum.
- The existing API client clears its stored session on HTTP 401. This task did not add any session clearing or storage writes.

## Verification commands

Commands ran from `/home/tian/.devspace/worktrees/yuzan-workspace-t093`.

| Command                                                     | Exit | Result                                                                                                                   |
| ----------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------ |
| `node --check frontend/login/app.js`                        |    0 | PASS                                                                                                                     |
| `node --check frontend/login/login.js`                      |    0 | PASS                                                                                                                     |
| `node --check frontend/login/auth-fail-closed.test.mjs`     |    0 | PASS                                                                                                                     |
| `node --test frontend/login/auth-fail-closed.test.mjs`      |    0 | PASS — 12 tests, 0 failures                                                                                              |
| `node frontend/scripts/check-business-js-syntax.mjs`        |    0 | PASS — 100 JS/MJS files checked                                                                                          |
| `node frontend/scripts/verify-runtime.mjs`                  |    0 | PASS                                                                                                                     |
| `git diff --check`                                          |    0 | PASS                                                                                                                     |
| `pnpm --filter @yuzan/frontend test` (first attempt)        |    1 | FAIL before tests started: fresh-worktree auto-install hit pnpm `ERR_PNPM_IGNORED_BUILDS`; no package downloads occurred |
| `pnpm install --frozen-lockfile --offline --ignore-scripts` |    0 | PASS — local cached packages only, no network and no install scripts                                                     |
| `pnpm --filter @yuzan/frontend test` (retry)                |    0 | PASS — full frontend suite, 190 tests, 0 failures; includes the business JS syntax gate and runtime verifier             |

## Claim boundary

- The focused tests execute both login scripts against mocked API responses. They cover HTTP 401, offline, missing API Client, demo-shaped credentials, transport failure, HTTP 403/429/503, server-user-based redirect, registration failure, and accessible error feedback.
- `VALID_LOGIN_REDIRECT`: `PASS` in a fixture test using the server-returned user shape; this is not a live API test.
- `401_OFFLINE_API_DOWN_NEGATIVE`: `PASS` in fixture tests; no fake auth storage or navigation was observed.
- `BROWSER_L3`: `NOT_RUN`.
- `FRESH_CONTEXT_L5`: `NOT_RUN`.
- No browser, live API, database, Docker/Compose, or MinIO runtime was started. Fixture tests are not represented as browser/API E2E evidence.
- `READY_TO_MERGE`: `NO` until integration and required native acceptance pass.
- `HISTORICAL_L4_INCIDENT_OPEN`: `YES`.
