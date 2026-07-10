# QA-003 Accessibility Review

## Automated/static result

The static audit confirms document language, skip-link target, primary headings on all nine core routes, explicit demo/unavailable copy, SSR guarding for the learning-player confirmation, reduced-motion CSS in the player, icon-page title metadata, and absence of autoplay audio.

Global UI primitives provide visible focus and reduced-motion rules. Core task pages include live regions for loading/error feedback and text labels alongside status color.

## Findings

`QA-003-001`: `/student/today` and `/student/learning/[activityId]` render `<main>` inside `AppShell`'s existing `<main id="main">`. Replace page-level main elements with sections or remove the shell landmark in the owning task, then verify the browser landmark tree.

`QA-003-002`: `/student/today`, `/studio`, `/teacher/assignments`, and `/teacher/review` do not define route-specific title metadata. Add unique titles in the owning tasks.

Production SSR evidence confirms the first issue: `/student/today` contains two main elements while the other eight core routes contain one. It also confirms the title issue: the four affected routes emit the default `语赞心声` title rather than route-specific titles.

## Manual confirmations required

- `MANUAL_CONFIRMATION_REQUIRED`: computed color contrast and non-color state comprehension.
- `MANUAL_CONFIRMATION_REQUIRED`: complete Tab order, Enter/Space operation, Escape behavior, focus trap/return for any dialogs, and focus visibility under the sticky header.
- `MANUAL_CONFIRMATION_REQUIRED`: form label/description/error relationships in the rendered accessibility tree.
- `MANUAL_CONFIRMATION_REQUIRED`: icon accessible names and decorative image alt handling.
- `MANUAL_CONFIRMATION_REQUIRED`: 200% zoom/reflow and touch target measurement at 390px.
- `MANUAL_CONFIRMATION_REQUIRED`: reduced-motion computed styles and absence of audio autoplay after hydration.

No dialog was identified in the core route source set; dialog focus-trap and focus-return checks are not applicable until a dialog is present, but must be rechecked in-browser if route state creates one dynamically.
