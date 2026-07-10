# QA-003 Acceptance Summary

## Scope and verdict

QA base: `3663ad6d8ef2e87654aa498cadf7bc653ee8c1ff`.

The dependency composition merged cleanly. Static route acceptance, unit tests, type checks, production build, bundle inspection, and HTTP deep-link checks were completed. No critical or high product finding was identified. Three medium findings and one route observation are recorded in `qa-003-findings.json`.

The repository contains no Playwright, axe, or Lighthouse dependency and VM1 exposes no Chromium executable. Browser screenshots, computed contrast, keyboard event behavior, visual overflow, hydration layout shift, and browser performance scores are therefore `MANUAL_CONFIRMATION_REQUIRED`. Browser automation status is `QA003_AUTOMATED_STATIC_COMPLETE_BROWSER_BLOCKED`.

## Evidence

- Core route sources exist and expose an `h1`.
- The application sets `lang="zh-CN"`, provides a skip link, and exposes `main#main`.
- Login and demo workflows label unavailable/demo boundaries rather than claiming service success.
- No core route autoplays audio.
- Student player browser-only APIs are guarded by `import.meta.client`.
- Production build output and route HTTP checks are recorded by the executed commands in the handoff.
- Nitro production-server deep links returned HTTP 200 for all nine core routes. Each response used `lang="zh-CN"`; sampled referenced JS/CSS assets also returned 200.
- SSR HTML confirmed one main landmark on eight routes and two nested main elements on `/student/today`.

## Findings overview

| ID         | Severity    | Summary                                                                                      | Owner               |
| ---------- | ----------- | -------------------------------------------------------------------------------------------- | ------------------- |
| QA-003-001 | medium      | Student pages nest `main` inside the AppShell `main` landmark                                | LRN-002             |
| QA-003-002 | medium      | Four major routes do not set unique document titles                                          | LRN/CUR/ASN/SUB-002 |
| QA-003-003 | medium      | Shared sticky header uses blur/translucency inconsistent with the no-glassmorphism direction | WEB-001             |
| QA-003-004 | observation | Requested `/student/assessment` route maps to actual `/assessment`                           | QA documentation    |

## Manual acceptance checklist

At 390x844, 768x1024, and 1440x900, confirm horizontal overflow, sticky-header coverage, text wrapping, clipped focus rings, long-list density, image/icon fallback, and layout stability after hydration. Keyboard-check skip link, navigation sequence, Enter/Space activation, Escape behavior where applicable, and focus return. Use browser accessibility tooling for landmark trees, accessible names, labels, error associations, contrast, touch targets, and reduced-motion behavior.
