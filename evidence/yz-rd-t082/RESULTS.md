# YZ-RD-T082 Results

Date: 2026-10-20
Repository: `tianxiansheng166/yuzan-workspace-main`
Workspace: `/home/tian/code/work/yuzan-workspace-t082`
Branch: `feat/yz-rd-t082-student-web-core-unified-integration`
BASE: `d6fbf670bb6997cae0e841d8f9a397f0da785a42`

## Outcome

The four student-web sources coexist in one isolated branch through four real
two-parent `--no-ff` merges, in the requested order. The verified integration
tip after the fourth merge is `48cc7587072e28e9c9e9d6f1edea71132ef21849`.
No merge conflict occurred. T081's ancestry includes T076 (`ecbd006...`); T076
was not merged separately.

`READY_TO_MERGE=NO`. Frontend verification passed, but the full frontend syntax
scan found an unchanged BASE syntax error in the teacher tree; the full API
lint gate was not run or waived; and the three API contract items below remain
open. This task makes no claim about T070's lint count.

## Preparation and safety

- The requested local branch and worktree did not exist; the target path was
  free, and the output branch was absent from `origin` before work began.
- Created the isolated worktree directly from the exact BASE above. The T082
  worktree was clean before merge; the task began without entering T005 or its
  worktree.
- The pre-existing main checkout at `/home/tian/code/yuzan-workspace-main`
  remained on `feat/question-bank-v1`, HEAD `9c77c8cd35ffd45d6a164cc7a4ec616c3345fd15`.
  Its dirty/untracked status fingerprint was
  `20988d1be4ae1ec1c2b1487a989980ebb2c297d58baf2018df3099a1a7861202` before
  and after T082 work, so its existing changes were preserved.
- Target repository `AGENTS.md` has no AA-DEV-V2.2 marker. The supplied card
  gives `POLICY_SCOPE=YZ-RD` and the task-specific ownership/runtime limits but
  no separate Lane policy file. The root `/home/tian/code/AGENTS.md` baseline
  and the explicit card rules governed this work.
- No production API, Prisma, Contracts, or teacher product source was changed.
  No Docker/Compose was used, no other service was stopped, and no shared
  branch was overwritten.
- During route discovery, a broad file-list command emitted filenames under
  `frontend/assessment/assets/question-bank/`, including Level 4 audio names.
  No question-bank file content was opened, used, or modified. The historical
  L4 incident remains `OPEN`.

## Source SHAs and real No-FF merge parents

All four requested source SHAs resolved exactly in the repository object
database. Each merge below is a real merge commit with the stated first and
second parents; the graph is preserved in Git history.

| Order | Source | Source SHA | T082 merge commit | First parent | Second parent |
|---|---|---|---|---|---|
| 1 | T074 Today | `7030e93d80a8e38f015e0a89686ab989aecb4e1d` | `05ed75328d8300c0df1a15043285f18b53c00a78` | `d6fbf670bb6997cae0e841d8f9a397f0da785a42` | `7030e93d80a8e38f015e0a89686ab989aecb4e1d` |
| 2 | T075 Course | `6d62ea23346ed7561c75528c4cfec264835608ed` | `dbdb6f7c8313c238ec1a288731aa96c958a0e417` | `05ed75328d8300c0df1a15043285f18b53c00a78` | `6d62ea23346ed7561c75528c4cfec264835608ed` |
| 3 | T081 Practice | `9b16270e359a208337235fa36fe64e1bb96685cd` | `2929edaea0c2f5148fb50b759da309fe607df564` | `dbdb6f7c8313c238ec1a288731aa96c958a0e417` | `9b16270e359a208337235fa36fe64e1bb96685cd` |
| 4 | T077 Growth | `457149b94d5c49aeaac14d2cef3495a557dea8e1` | `48cc7587072e28e9c9e9d6f1edea71132ef21849` | `2929edaea0c2f5148fb50b759da309fe607df564` | `457149b94d5c49aeaac14d2cef3495a557dea8e1` |

T081 has parent `ecbd0069642de7a15eef4102d516363bbd118208` (T076); the ancestry
check passed. T076's work is present through T081 and was not a fifth merge.

### Conflicts

`CONFLICTS=NONE`. All four requested `git merge --no-ff` operations completed
with Git's `ort` strategy and no unmerged paths. No business code was manually
overwritten or resolved.

## Student feature preservation

The unified source retains Today, Courses, Practice (including T076 through
T081), and Growth. The frontend test command was expanded to include every
existing frontend test directory: `tests/assessment`,
`student/courses/course-detail`, and `teacher-home`; the previous package
script omitted the latter two.

The unified tests cover the requested cases, including:

- Today teacher task priority, BFCache reload, and school/identity changes
  discarding stale navigation.
- Course chapter/activity restoration, server-backed next activity and
  completion, saved position/continuity, 409 reconciliation, and one-time
  submission.
- Practice empty/unavailable states, standalone Attempt selection with its
  original ID, course Attempt exclusion, 409/lost-response recovery without a
  second submit, and distinct 401/403/404 behavior.
- Growth report-isolated recovery, pending versus official results, zero versus
  null score, remediation gating on authorized question versions, and the
  recent-report limit with full-history access.

## Verification

Environment: Node `v24.20.0`; Corepack pnpm `10.13.1` (the repository requires
Node `>=24 <27` and pnpm `10.x`).

| Check | Result | Evidence |
|---|---|---|
| Complete frontend tests | **PASS — 190 passed, 0 failed, 0 skipped** | [`frontend-tests.log`](frontend-tests.log) |
| Runtime verifier (standalone) | **PASS** | [`runtime-verifier.log`](runtime-verifier.log) |
| JavaScript syntax for T082 changed JS/MJS files | **PASS** | [`js-syntax-changed.log`](js-syntax-changed.log) |
| All tracked frontend JS/MJS except protected question-bank assets | **FAIL — unchanged BASE file `frontend/teacher/assessments/create/app.js:86` has an unterminated quote before `朗读感染力`** | [`js-syntax-all-frontend.log`](js-syntax-all-frontend.log) |
| `git diff --check` | **PASS** | [`git-diff-check.log`](git-diff-check.log) |
| New desktop Chromium route/navigation smoke | **PASS — TEST_FIXTURE_ONLY** | [`chromium-navigation-proof.json`](chromium-navigation-proof.json), [`chromium-navigation-run.log`](chromium-navigation-run.log), and the new screenshots below |
| Native Chrome + NestJS + PostgreSQL E2E | **NOT_RUN** | No isolated PostgreSQL runtime was available (`127.0.0.1:5432` did not accept a connection; `pg_isready`/`psql` were unavailable). Docker/Compose use is prohibited by this task. |
| Full API lint | **NOT_RUN** | Outside this task's ownership; no T070 count is attributed to T082. The current lint gate is not waived. |

### New desktop Chromium proof

Google Chrome `153.0.8010.52` visited Today → Courses → Practice → Growth by
clicking the merged student navigation at 1280×900 and 1440×1000. All six nav
items appeared, the correct active item followed each route, and none of the
four routes overflowed the viewport. Fresh screenshots were generated from
this T082 worktree; no T074/T075/T077/T081 screenshots were used as T082 proof.

This run is deliberately `TEST_FIXTURE_ONLY`: the browser used a synthetic
local identity, the frontend API proxy targeted unreachable loopback port 1,
and the captured pages show backend-unavailable states. It validates page
entry, navigation, route markers, and desktop width only; it is not API/data
acceptance or a real E2E.

| Route | 1280×900 | 1440×1000 |
|---|---|---|
| Today | [`chromium-1280-today.png`](chromium-1280-today.png) | [`chromium-1440-today.png`](chromium-1440-today.png) |
| Course directory | [`chromium-1280-courses.png`](chromium-1280-courses.png) | [`chromium-1440-courses.png`](chromium-1440-courses.png) |
| Practice | [`chromium-1280-practice.png`](chromium-1280-practice.png) | [`chromium-1440-practice.png`](chromium-1440-practice.png) |
| Growth | [`chromium-1280-growth.png`](chromium-1280-growth.png) | [`chromium-1440-growth.png`](chromium-1440-growth.png) |

Every screenshot has a visible `TEST_FIXTURE_ONLY · API 未连接` watermark.

## Remaining API contract gaps

1. **T075 / T083:** Server `nextActivity` and required-practice completion
   state need one shared rule. The client does not infer completion or advance
   from local state.
2. **T081 / T083:** `GET Practice Attempt` OpenAPI 200 response lacks typed
   identity and course-scope fields. The client does not invent those fields.
3. **T076 / T072 question-bank Owner:** Learning eligibility for a formal
   `QuestionVersion` needs an authoritative server authorization status. The
   client does not guess approval or version authorization.

## Final SHA and remote proof

The four-merge integration checkpoint is the full SHA
`48cc7587072e28e9c9e9d6f1edea71132ef21849` (the fourth No-FF merge above).
The evidence commit was pushed without force. The post-push equality check
passed (exit 0): `git rev-parse HEAD` matched
`git ls-remote --heads origin
refs/heads/feat/yz-rd-t082-student-web-core-unified-integration`. The full final
branch SHA is returned with the task result; a Git commit cannot contain its
own object ID without changing that ID.

`HISTORICAL_L4_OPEN=OPEN`
`READY_TO_MERGE=NO`
