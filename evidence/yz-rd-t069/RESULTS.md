# YZ-RD-T069 Results

| Field | Result |
|---|---|
| TASK_ID | `YZ-RD-T069` |
| STATUS | `FIXED / RESPONSIVE_UX_PASS / FRONTEND_144_PASS` |
| BASE | `e4cf946b107e2fe30b57f7e6200b4ed7f45112d1` (accepted T067) |
| BRANCH | `feat/yz-rd-t069-student-speech-floating-nav-overlap-fix` |
| FINAL_SHA | Reported in the task return after the independent evidence commit. |
| READY_TO_MERGE | `NO` — the base carries 1,203 inherited API test lint findings from T058; this frontend-only task did not rerun or resolve that debt. |
| L4_OPEN | `OPEN` — no Level 4 data or runtime was read. |

## Original overlap evidence

The T053 [`student-course-speech-390.png`](../yz-rd-t053/student-course-speech-390.png) is the existing 390×844 capture from T053's native Chromium course speech journey. T053's [`RESULTS.md`](../yz-rd-t053/RESULTS.md) records the native browser/API journey and its screenshot set. In that capture, the red `导航` button sits over the recorder's `采集 / 麦克风输入` status at the top right of the recorder card.

The current T069 baseline reproduced the same collision before the edit. In [`browser-proof-baseline.json`](browser-proof-baseline.json), the global button measured 48×48 at `(320, 774)` and the `.vr-pipeline` status row began at `(288, 775)` with a 450px width; the rectangles intersect. The baseline screenshot is [`baseline-390x844-chromium.png`](baseline-390x844-chromium.png). The same baseline exposed a related mobile layout defect: the recorder action was outside its 326px recorder panel at x=460, clipped by the panel.

## Actual UX fix

- The student activity renderer adds a page-scoped class only for `SPEECH` activities. On that page, the existing global navigation button occupies the reserved top area with top and right safe-area insets; its menu opens below that area. The module links remain present, and the course back link and chapter path remain in the page flow.
- The recorder, finish/preview controls, and helper text now sit inside the `.speech-target` wrapper. This makes the page's existing mobile recorder rules apply to the actual recorder DOM. At 390px the recorder uses its one-column layout, keeping its record action inside the recorder panel. The pipeline labels flex to the available width at 768px and 1280px.
- Speech-page back, chapter, recorder, and footer controls keep at least 44px touch height. The speech navigation and recording controls have explicit visible keyboard-focus rings. The page keeps bottom padding for `safe-area-inset-bottom`.

## 390px and 768px status visibility

The post-fix proof scrolls the recorder into view and measures its controls in Chromium. At 390×844, the idle/recording state, timer, error copy/toast, microphone, start/pause action, finish control, preview control, and upload control are visible without a navigation intersection. The decorative pipeline row is hidden at this narrow width by the page's compact recorder style; the live recording state and timer remain visible.

At 768×1024, the recorder's state, timer, error copy, microphone, start action, and the full pipeline row are inside the viewport when the student scrolls the recorder into view. The navigation does not overlap them. The same checks pass at both widths in [`browser-proof-after.json`](browser-proof-after.json).

## Four viewports and interaction checks

| Viewport | Screenshot | Result |
|---|---|---|
| 390×844 | [`after-390x844-chromium.png`](after-390x844-chromium.png) | No horizontal overflow or navigation/state/control overlap; page navigation is in the reserved top area. |
| 768×1024 | [`after-768x1024-chromium.png`](after-768x1024-chromium.png) | No horizontal overflow or navigation/state/control overlap; pipeline and recorder controls fit their panel. |
| 1280×900 | [`after-1280x900-chromium.png`](after-1280x900-chromium.png) | No horizontal overflow or navigation/state/control overlap; status pipeline fits the recorder. |
| 1440×1000 | [`after-1440x1000-chromium.png`](after-1440x1000-chromium.png) | No horizontal overflow or navigation/state/control overlap; status pipeline fits the recorder. |

The browser proof measures all visible course and navigation targets at 44px or taller. The global navigation toggle is 48×48 with a visible 3px keyboard-focus outline; all 11 menu links are 44px high. The page scrolls to expose the full recorder and upload action. The existing student course top navigation still renders six links without the speech-page class, and the generic `/plans/` global navigation remains fixed at its original bottom-right position.

## Frontend tests

- `pnpm --filter @yuzan/frontend test`: **144 passed / 0 failed**, including runtime verification and three new speech navigation/layout regressions ([log](frontend-tests.log)).
- T069 Chromium fixture checks: **PASS** at all four requested viewports; idle, recording, error, and recorded control states remain clear of navigation.
- `git diff --check`: **PASS**.

## Visual fixture and real API scope

T069's new Chromium run is explicitly `VISUAL_FIXTURE_ONLY`. It uses synthetic school, assignment, course, student, submission and note responses from a local fixture server, a separate headless Chromium profile, and an ephemeral DevTools port. No real API was contacted. No real API E2E is claimed. The T053 screenshot above remains the original real Chromium/API journey evidence; its browser capture used Chromium's simulated microphone as documented by T053.

No Teacher Studio, API/database contract, T005, L4, or original course-material files were changed. No Docker, shared-branch merge, force push, or runtime service was used. The target checkout `AGENTS.md` lacks the AA-DEV-V2.2 marker; the supplied `/home/tian/code/AGENTS.md` baseline governed this task.
