# YZ-RD-T061 Results

| Field | Result |
|---|---|
| TASK_ID | `YZ-RD-T061` |
| STATUS | `UX_POLISH_IMPLEMENTED / FRONTEND_REGRESSION_PASS / NO_NEW_BROWSER_RUN` |
| BASE | `736cb9bdc98866f15be586a7410749182ace0d29` (accepted T058) |
| BRANCH | `feat/yz-rd-t061-teacher-studio-student-course-ux-polish` |
| FINAL_SHA | Reported in the task return after the evidence commit; no self-referential SHA in this file. |
| READY_TO_MERGE | `NO` — inherited 1,203 API test lint errors remain unresolved, and no post-change Chromium capture was made under the T060 browser resource boundary. |
| L4_OPEN | `OPEN` — no Level 4 data or runtime was read. |

## UX_TOP3_FINDINGS — evidence reviewed before selecting changes

1. **The teacher studio is unreadable on a phone.** The actual 390px Chromium capture shows the full 1536px editor canvas reduced to a tiny strip, with large empty areas. `fitDesign` scales the fixed-width canvas to the host width; its 15px editor text is therefore about 4px at a 390px viewport. Evidence: [actual T053 Chromium screenshot, 390px](../yz-rd-t053/teacher-course-studio-390.png), [studio fit logic](../../frontend/shared/teacher-shell.js), [`fit.js`](../../frontend/assets/fit.js).
2. **Save, review, publish and assignment steps are hard to discover, and review could submit dirty edits.** The studio exposed save only through Ctrl/Cmd+S; its review handler did not save dirty edits, while the publish handler did. The 1280px screenshot places the long course title and absolute-positioned actions on the same row. After publishing, assignment is created in the separate Tasks area with no next-step cue. Evidence: [actual T053 Chromium screenshot, 1280px](../yz-rd-t053/teacher-course-studio-1280.png), `studio.js` before this task (`.submit` review handler vs. `publish-course-version` handler), and the real T053 order recorded in [T053 results](../yz-rd-t053/RESULTS.md#teacher-authoring-and-publication): save course → bind the published practice → publish course → create/open assignment.
3. **The student activity page’s floating global-nav button covers part of the recording panel’s right-side status area on mobile.** It does not cover the microphone start control or upload action, so it ranked below the two studio issues and was left unchanged. Evidence: [actual T053 Chromium screenshot, 390px](../yz-rd-t053/student-course-speech-390.png) and the fixed bottom-right rule in [global-nav.js](../../frontend/global-nav.js).

## ACTUAL_UX_CHANGES

Changes address findings 1 and 2 only:

- At widths up to 760px, the teacher studio now opts out of the fixed desktop canvas transform and lays out the course title/actions, lifecycle steps, course structure, editor and properties as a vertically scrollable page. The activity tabs and lifecycle steps scroll horizontally when needed. The desktop three-panel editor remains intact.
- Added a visible, state-aware **保存草稿** action. It is available for editable drafts with unsaved changes, uses the existing course-version PATCH, and advertises the Ctrl/Cmd+S shortcut.
- Review submission now saves dirty course content first; a save failure leaves the draft dirty and stops the review request. Publish keeps its existing save-before-publish behavior and API route.
- Added a short next-step cue: save the draft, then submit for review or publish; after publication, continue to Tasks to assign it to a class.
- Kept the current review and publish choices, assignment API, score semantics, teacher review requirements, Tibetan-Han visual assets, and personalized Today primary task. No four-card feature strip was added. No API contract or database changed.

## TEACHER_STUDIO_HIERARCHY

On mobile, content now follows the work sequence: course name and status → course actions → lifecycle progress → course structure → selected activity editor → activity properties. The primary editing actions have 44px control height and a visible save status. On desktop, title/status and action groups use separate columns, preventing the long course title from sitting underneath the action group.

## STUDENT_COURSE_FLOW

No student player or assessment state-machine changes were needed in this slice. The existing course flow continues to show the activity path, task instruction/target text, recorder, local preview before upload, and upload/complete action. Existing `PROCESSING` stays distinct from a formal result; teacher feedback is still produced by the authorized manual review flow. The T053 run proves one upload, then `PROCESSING` with no report before six manual reviews, followed by the official report. The mobile floating navigation overlap remains a lower-priority follow-up noted above.

## MOBILE_ACCESSIBILITY

- Studio buttons use native button semantics; the new save control exposes its keyboard shortcut with `aria-keyshortcuts` and title text.
- Draft state is announced through `aria-live="polite"`; the action set is a named group.
- Mobile action targets are at least 44px high. The lifecycle and tab strips remain horizontally scrollable rather than shrinking their text.
- Reduced-motion behavior and existing focus handling were not changed. This audit did not include a new screen-reader or physical-device session.

## SCREENSHOT_AND_FIXTURE_PROVENANCE

- **Real Chromium captures:** T053 ran native Chromium against its isolated, live API/database runtime and captured these screens at a 390×844 viewport. The PNGs are full-page captures (`teacher-course-studio-390.png` is 390×941; `student-course-speech-390.png` is 390×1889). They contain explicitly labeled `TEST_FIXTURE_ONLY` course data; the microphone source in the test was simulated, not a physical device. The 1280px studio image is [teacher-course-studio-1280.png](../yz-rd-t053/teacher-course-studio-1280.png). T053’s execution and fixture scope are documented in [T053 results](../yz-rd-t053/RESULTS.md).
- **Visual fixtures:** T043’s `visual-fixture-*.png` images are design-only visual fixtures. Their [proof file](../yz-rd-t043/visual-fixture-proof.json) says `VISUAL_FIXTURE_ONLY, NO BACKEND E2E`; they are not live runtime screenshots and were not used as evidence that an API-backed flow works.
- **T061 captures:** none. No browser was started and no new screenshots were generated, to avoid competing with T060. The screenshots above establish the before state only; post-change visual review remains open.

## FRONTEND_TESTS

| Check | Result |
|---|---:|
| `corepack pnpm --filter @yuzan/frontend test` | 139 passed / 0 failed; includes runtime verification |
| T061 focused UX contract tests | 2 passed / 0 failed (included in the suite total) |
| `node --check` for changed frontend JavaScript | PASS |
| `git diff --check` | PASS |
| Chromium / cross-role E2E | NOT RUN by instruction; no browser resource was used |
| API / Contracts tests | NOT RUN; API and contracts are unchanged |

## Scope and readiness

- Changed only teacher-shell layout handling, teacher studio markup/CSS/interaction, the focused frontend regression, this evidence and the handoff.
- Personalized Today and the existing single-primary-action hierarchy remain untouched. No promotional four-card layout was restored.
- The target checkout `AGENTS.md` has no `AA-DEV-V2.2` marker. The Task Card supplied no Lane policy reference; `/home/tian/code/AGENTS.md` supplied the applicable local safety rules.
- `READY_TO_MERGE=NO` pending post-change Chromium visual review when T060 releases the browser resource and resolution or explicit waiver of the inherited T058 API test lint debt (1,203 errors). `L4_OPEN=OPEN`.
