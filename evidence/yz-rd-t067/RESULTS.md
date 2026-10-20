# YZ-RD-T067 Results

| Field | Result |
|---|---|
| TASK_ID | `YZ-RD-T067` |
| STATUS | `VISUAL_VERIFICATION_PASS / RESPONSIVE_FIX_APPLIED / FRONTEND_141_PASS` |
| BASE | `9a1a8b741d0eacfc304dfd72006558848b8bf6e4` (accepted T061) |
| BRANCH | `feat/yz-rd-t067-studio-mobile-visual-verification` |
| FINAL_SHA | Reported in the task return after the evidence commit. |
| READY_TO_MERGE | `NO` — the base handoff records 1,203 inherited API test lint findings from T058; this frontend-only task did not rerun or resolve that debt. The visual blocker is closed. |
| L4_OPEN | `OPEN` — no Level 4 data or runtime was read. |

## Verification scope

The updated T061 course studio was served from this checkout and rendered by a newly launched, isolated headless Chromium process. Each final screenshot below is a new capture from the modified page at the requested viewport. No T053 screenshot was used as post-change evidence.

The first T067 capture found that 768px still scaled the 1536px editor canvas to `0.453125`; the rename target was 39px high and Add Unit was 35px high at 390px. The before-fix evidence is [`initial-768x1024-chromium.png`](initial-768x1024-chromium.png) and [`before-fix-browser-proof.json`](before-fix-browser-proof.json).

The studio now uses a real-size flow layout at every viewport. It stacks the editor panels through 960px, uses fluid columns on desktop, and keeps the three desktop panels at 1280px and 1440px. The tablet teacher shell uses a compact horizontal navigation so its header does not squeeze the school label into vertical lines. Rename, Add Unit, editor tabs, editor actions, property actions, and primary course actions have 44px touch height.

## Four new Chromium screenshots

| Viewport | Evidence | Result |
|---|---|---|
| 390×844 | [`studio-390x844-chromium.png`](studio-390x844-chromium.png) | Title 27.3px; structure text 14px; editor heading 15px; HTML/body width 390px; panels stack vertically. |
| 768×1024 | [`studio-768x1024-chromium.png`](studio-768x1024-chromium.png) | Title 30px; structure text 14px; no canvas transform or page overflow; panels stack vertically. |
| 1280×900 | [`studio-1280x900-chromium.png`](studio-1280x900-chromium.png) | Unscaled layout; three editor panels remain side by side. |
| 1440×1000 | [`studio-1440x1000-chromium.png`](studio-1440x1000-chromium.png) | Unscaled layout; three editor panels remain side by side. |

The layout measurements, screenshot dimensions and browser checks are recorded in [`browser-proof.json`](browser-proof.json). A separate focused capture, [`studio-keyboard-focus-390x844-chromium.png`](studio-keyboard-focus-390x844-chromium.png), shows the keyboard focus ring on Save Draft.

## Save and review behavior

The browser exercised the actual page controls through its existing API client and a local, isolated fixture service:

1. Rename a course; the live status changes to `未保存` and the Save Draft button becomes available.
2. Save Draft explicitly; a fixture PATCH succeeds, the status returns to `课程草稿`, and Save Draft disables again.
3. Rename again and force the next fixture PATCH to return 503. Clicking Submit for Review leaves the status at `未保存` and sends no review request.
4. Retry; the PATCH succeeds before one `submit-review` POST is sent, and the visible status becomes `审核中`.

Keyboard Tab reached Save Draft with `:focus-visible` true and a visible 3px solid outline. The status field remains `aria-live="polite"`; the existing Ctrl/Cmd+S shortcut remains present. All 19 rendered studio buttons measured at least 44px in all four viewports.

## Fixture and real service scope

All course, school and teacher data is synthetic and explicitly marked `VISUAL_FIXTURE_ONLY` in [`visual-fixture.json`](visual-fixture.json). The browser script starts a temporary local API fixture behind the frontend server proxy. The failed-save response is fixture fault injection. This is a visual and UI-flow fixture run, not a real API E2E.

`REAL_API=NOT_RUN`: no authorized API endpoint or credentials were supplied, so no real API was contacted and no real service behavior is claimed. Course-version, review, publish and assignment APIs were not changed. Teacher review policy and student Today/course flow were not changed.

The shared browser service on port 9222 was not contacted. Chromium used a separate temporary profile and an ephemeral DevTools port; the task-owned browser and local frontend/fixture servers exited after capture. No Docker, shared-branch merge, T005 path, raw question bank, or Level 4 data/runtime was accessed.

## Frontend tests

`corepack pnpm --filter @yuzan/frontend test` passed **141/141** tests, including the existing 139 frontend tests and two added responsive-studio regression tests. The command also passed the frontend runtime verifier. Logs: [`frontend-tests.log`](frontend-tests.log), [`syntax-checks.log`](syntax-checks.log), and [`diff-check.log`](diff-check.log).

The target checkout `AGENTS.md` does not contain the AA-DEV-V2.2 marker. The user-supplied `/home/tian/code` safety baseline governed this task.
