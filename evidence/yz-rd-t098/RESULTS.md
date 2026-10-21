# YZ-RD-T098 — student learning visual redesign

STATUS: DONE (implementation and fixture verification scope)

- RETURN_TO: 语赞心声｜研发施工与上线 Commander 线
- REPO: tianxiansheng166/yuzan-workspace-main
- BASE: `03371f7287433dac7f09c99ff95729fb4c071652`
- BRANCH: `feat/yz-rd-t098-student-learning-visual-redesign`
- ACTUAL_WORKTREE: `/home/tian/.devspace/worktrees/yuzan-workspace-t098`
- FINAL_SHA: the containing branch commit, returned in the Executor final receipt. No self-referential SHA is written into its own commit.
- READY_TO_MERGE=NO — Owner must review and approve the visual result; no UAT/main integration was performed.
- HISTORICAL_L4_INCIDENT_OPEN=YES.

## Visual result

- **Today**: asymmetric indigo/ink learning hero with CSS sound contours, one existing primary action, vertical learning state rail, lilac formal-result treatment, amber pending review, jade course continuity, and quieter history/secondary tasks. Existing server-selected learning action and state wording remain authoritative.
- **Courses**: original desktop hero measured 274px; final masthead is 164px at 768/1280/1440 and 172px at 390. CSS contour motion and a compact heading replace the previous background treatment. Existing checked-in covers remain selected by unchanged code. The first returned course spans the grid with a larger cover; following courses vary accents/radii, retain readable progress, and keep an explicit action. List mode, every returned course and existing controls remain reachable.
- **Growth**: existing real-data SVG chart appears first in the main column. Summary numbers have varied hierarchy; formal results use blue/indigo, learning progress teal, teacher feedback lilac and remediation coral/amber. The existing stage, attempts, reports, feedback, remediation actions and chronological timeline remain present. Mobile SVG labels and the final date anchor were adjusted for legibility.
- Body and heading type, layer depth, geometry, focus rings and mobile wrapping were adjusted without a new dependency, CDN, icon library or generated image. The main Courses document now follows natural document scrolling, which also allows complete page capture.

## Scope and safety

REPO_AGENTS_ACTUALLY_READ=YES. Exact-BASE AGENTS, README-FIRST, CURRENT_TASK and current handoff/T082 recovery context were read; blob IDs and startup facts are in [startup.md](startup.md). NOTION_POLICY_READ=READ_OK for current applicable Policy 17, 17A and YZ-RD minimum execution rules; see [policy-read.md](policy-read.md). POLICY_SCOPE=YZ-RD; AA-DEV-V2.2=NOT_APPLICABLE; POLICY_GAP=NONE for this task.

FILE_OWNER_GUARD=PASS: [raw guard log](file-owner-guard.log). Product changes are exactly:

1. `frontend/student/today/index.html`
2. `frontend/student/today/style.css`
3. `frontend/student/courses/index.html`
4. `frontend/student/courses/style.css`
5. `frontend/student/growth/index.html`
6. `frontend/student/growth/assets/growth-live.css`

Additional writes: this task's `evidence/yz-rd-t098/**` and one factual append-only `CURRENT_HANDOFF.md` checkpoint. No other source path changed. Main checkout's dirty diff was never opened. No merge/cherry-pick to shared UAT/main, destructive Git operation, dependency install, Docker, database/MinIO/Redis startup, importer, raw mixed source or process killing was used. Task-owned Chrome exited through CDP Browser.close; its profile was removed after exit. The static fixture server closes normally.

L4_SOURCE_READ=NO_FOR_THIS_TASK; L4_IMPORT_APPLIED=NO; L4_RUNTIME_OPENED=NO; HISTORICAL_L4_INCIDENT_OPEN=YES. These are task-scoped action facts and do not close or reinterpret the historical incident.

## Behavior and course/video preservation

- Today `today.js` / `today-showcase.js`, Courses `courses.js`, Growth `growth-live.js` and shared navigation are byte-identical to BASE.
- The entire course-detail implementation, media controller, player state, exercise controller, VIDEO/AUDIO sources, checked-in covers and other asset files are unchanged.
- Generated course destinations still include `/student/courses/course-detail/?id=<assignmentId>&activityId=<nextActivityId>`. Before/after rendered destination arrays and cover selections match at every viewport. Fixture load-more retains all 13 synthetic server-returned destinations. This is rendered-route preservation evidence, not authenticated playback E2E.
- Search, grade/category filtering, sort, favorites, grid/list switching, clear filters and 12→13 load-more were exercised in the real unchanged catalog code at every viewport. Existing unit tests cover additional request/error/pagination and player persistence behavior.
- Formal zero remains `0 分`; missing score remains `暂无正式得分`. No score, streak, course or metric was hardcoded into product HTML/CSS. Synthetic records exist only in the explicitly labeled evidence fixture.

## Verification

| Gate | PASS | FAIL | SKIP | Evidence |
| --- | ---: | ---: | ---: | --- |
| Full existing frontend test suite | 199 | 0 | 0 | [frontend-full.log](frontend-full.log) |
| Focused course adapter/player/media tests (overlap full suite) | 19 | 0 | 0 | [focused-media.log](focused-media.log) |
| Business JS/MJS syntax gate | 100 files | 0 | 0 | [frontend-full.log](frontend-full.log) |
| Runtime verifier | PASS | 0 | 0 | [frontend-full.log](frontend-full.log) |
| Explicit syntax checks, evidence scripts and unchanged page JS | 8 files | 0 | 0 | [syntax-diff.log](syntax-diff.log) |
| `git diff --check` | PASS | 0 | 0 | [syntax-diff.log](syntax-diff.log) |
| File ownership / unchanged behavior sources / handoff append | PASS | 0 | 0 | [file-owner-guard.log](file-owner-guard.log) |
| Chromium fixture | 24 before/after page/viewport captures; 15 additional check groups | 0 exceptions | 0 | [visual.log](visual.log), [browser-proof.json](browser-proof.json) |

Full existing command from repository root, using the existing Node 24.20.0 installation on PATH:

```sh
pnpm --filter @yuzan/frontend test
```

This executes the exact package command:

```sh
node scripts/check-business-js-syntax.mjs && node --test tests/assessment/*.test.mjs student/courses/course-detail/*.test.mjs teacher-home/*.test.mjs teacher/submissions/detail/playback.test.mjs && node scripts/verify-runtime.mjs
```

Focused command from repository root:

```sh
node --test frontend/student/courses/course-detail/course-api-adapter.test.mjs frontend/student/courses/course-detail/course-player-state.test.mjs frontend/student/courses/course-detail/media-controller.test.mjs
```

Fixture and guard reproduction, with no backend or external services:

```sh
node evidence/yz-rd-t098/capture.mjs
node evidence/yz-rd-t098/guard.mjs
node evidence/yz-rd-t098/verify.mjs
```

## Responsive visual evidence

Open the [before/after review gallery](review.html). All screenshots carry `VISUAL_FIXTURE_ONLY`. The local static server injects synthetic API responses only for evidence; unmodified product renderers generate the DOM. The before phase loads the six product files from exact BASE through `git show`; the after phase loads the current task worktree. No shared or live API proxy exists in the fixture server.

| Viewport | Today before → after | Courses before → after | Growth before → after |
| --- | --- | --- | --- |
| 390×844 | [before](screenshots/before-today-390x844.png) → [after](screenshots/after-today-390x844.png) | [before](screenshots/before-courses-390x844.png) → [after](screenshots/after-courses-390x844.png) | [before](screenshots/before-growth-390x844.png) → [after](screenshots/after-growth-390x844.png) |
| 768×1024 | [before](screenshots/before-today-768x1024.png) → [after](screenshots/after-today-768x1024.png) | [before](screenshots/before-courses-768x1024.png) → [after](screenshots/after-courses-768x1024.png) | [before](screenshots/before-growth-768x1024.png) → [after](screenshots/after-growth-768x1024.png) |
| 1280×900 | [before](screenshots/before-today-1280x900.png) → [after](screenshots/after-today-1280x900.png) | [before](screenshots/before-courses-1280x900.png) → [after](screenshots/after-courses-1280x900.png) | [before](screenshots/before-growth-1280x900.png) → [after](screenshots/after-growth-1280x900.png) |
| 1440×1000 | [before](screenshots/before-today-1440x1000.png) → [after](screenshots/after-today-1440x1000.png) | [before](screenshots/before-courses-1440x1000.png) → [after](screenshots/after-courses-1440x1000.png) | [before](screenshots/before-growth-1440x1000.png) → [after](screenshots/after-growth-1440x1000.png) |

Matching `*-full.png` files show final natural page height. BASE Courses used a fixed-height body scrolling container, so its before `*-full.png` retains the actual visible window rather than pretending to show a natural document flow. Fixture capture explicitly preloads lazy cover images to make offscreen full-page evidence complete; product lazy loading is unchanged.

All 12 after page/viewport combinations were checked for zero horizontal overflow, no clipped heading boxes, reduced-motion suppression, identical destination lists and identical cover selections. Screenshots were visually inspected across the four sizes. Additional full list-mode screenshots at all widths, phone empty/error states, keyboard focus screenshots, and normal-motion desktop frames are in `screenshots/`. Normal motion remains decorative and does not intercept pointer events. The browser proof records keyboard `:focus-visible` and solid outlines, reduced-motion animation state, course counts, viewport dimensions, route arrays, image load status, chart existence, catalog interactions and zero uncaught browser exceptions.

During development, capture initially encountered unrequested offscreen lazy images; the fixture now preloads them. Visual inspection also found the inherited oversized formal-result arrow, inverted Growth stage columns, and chart date clipping. These were fixed in the owned page CSS before the final captures. No business JS was changed to resolve them.

## Limitations and review gate

NATIVE_AUTHENTICATED_BROWSER_API_PG_MINIO_E2E=NOT_RUN. No already-authorized T098 isolated authenticated runtime was used. These screenshots, DOM interactions, unit tests and route comparisons do not establish real API authorization, live VIDEO/AUDIO playback, physical-device behavior, network persistence or production acceptance. Existing player/media tests are the task's offline regression evidence.

READY_TO_MERGE=NO. Owner screenshot approval and the project's remaining integration/native acceptance gates are separate. Historical L4 incident remains OPEN; inherited quality or Owner-path decisions are not waived.
