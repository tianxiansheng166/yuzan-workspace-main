# Pixel V3 source runtime audit

Audit date: 2026-07-11  
Input: `source-materials/yuzan-pixel-v3-runtime` (read-only)

## Verdict

The source runtime is a zero-dependency static HTML/CSS/JavaScript prototype served by Node. It starts and returns HTTP 200. It is not Vue, Nuxt, React, Vite, Next, or a second production application. It contains 14 HTML documents, 15 CSS files, 8 JavaScript/module files, and 62 raster images.

The pages use real DOM headings, forms, links, buttons, lists, and modal/state toggles. They are not Canvas-rendered and are not implemented as one screenshot per route. However, the runtime is intentionally a fixed-canvas visual prototype: `assets/fit.js` scales desktop canvases, CSS contains at least 32 files/lines with absolute positioning, and several high-density illustrations reproduce substantial page regions. Static demo content and simulated actions must not cross the production boundary.

## Runtime checks

| Check | Result |
| --- | --- |
| Install | Not applicable; `package.json` has no dependencies |
| Syntax | `server.mjs` passes `node --check` |
| Build | Not applicable; no build script |
| Start | Pass: `node server.mjs`, port 4173 |
| Framework | Static HTML/CSS/JavaScript |
| Router | File/path server mapping, no SPA router |
| State | Local DOM state only; no store |
| API | None |
| Animation | CSS/vanilla state effects; no animation library |

## Routes and classification

| Route | Classification | Adoption decision |
| --- | --- | --- |
| `/` | CODE_REBUILT, INTERACTIVE_PROTOTYPE | structure and visual language reusable |
| `/login` | CODE_REBUILT, STATIC_MOCK | artwork reusable; auth logic rejected |
| `/select-school` | CODE_REBUILT, STATIC_MOCK | artwork reusable; school data rejected |
| `/teacher/courses/spring/studio` | PARTIAL_CODE_PARTIAL_IMAGE, STATIC_MOCK | visual reference; retain production draft state |
| `/teacher/assignments` | CODE_REBUILT, INTERACTIVE_PROTOTYPE | presentation patterns reusable |
| `/teacher/reviews/submission-1` | PARTIAL_CODE_PARTIAL_IMAGE, INTERACTIVE_PROTOTYPE | player art reusable; review logic rejected |
| `/student/today` | PARTIAL_CODE_PARTIAL_IMAGE, INTERACTIVE_PROTOTYPE | path art and layout reusable |
| `/student/learn/spring-2` | PARTIAL_CODE_PARTIAL_IMAGE, INTERACTIVE_PROTOTYPE | player fragments reusable |
| `/student/growth` | PARTIAL_CODE_PARTIAL_IMAGE, STATIC_MOCK | visual reference; report claims rejected |
| `/assessment` | PARTIAL_CODE_PARTIAL_IMAGE, INTERACTIVE_PROTOTYPE | entry art reusable |
| `/assessment/reading/2` | PARTIAL_CODE_PARTIAL_IMAGE, STATIC_MOCK | recorder art only; microphone simulation rejected |
| `/assessment/written` | PARTIAL_CODE_PARTIAL_IMAGE, INTERACTIVE_PROTOTYPE | option layout reusable |
| `/assessment/report/demo` | PARTIAL_CODE_PARTIAL_IMAGE, STATIC_MOCK | visual reference only; fixed AI result rejected |
| `/assessment/history` | PARTIAL_CODE_PARTIAL_IMAGE, INTERACTIVE_PROTOTYPE | comparison layout reusable |

No route is classified `FULL_PAGE_IMAGE`, but none is production-ready as-is.

## Image and layout findings

- 62 images; largest are 2.1-2.9 MB course covers (roughly 1086x1448 or 1122x1402).
- `home-bg.png` and `ridge-layer.png` are 1672x941 scene layers. They are artwork, not text/button screenshots, but can dominate the viewport.
- `today-mobile-body-exact.jpg` (853x1301) is a high-risk composite and was not migrated.
- No Canvas UI and no transparent click map were found.
- No bitmap button was identified. Buttons and form controls are DOM elements.
- Several images include dense visual regions; raster text must be rejected if discovered during visual QA.
- Fixed-canvas scaling and desktop-first sizing make the source runtime unsuitable as the responsive production shell.

## Interaction findings

- Navigation uses `data-nav` and real anchors/DOM handlers.
- Two `alert()` call sites and four inline `onclick` sites were detected.
- Login is a demonstration redirect, not authentication.
- Recording/player behavior is simulated and does not use microphone/upload/provider APIs.
- Report and growth data are static demonstrations and cannot be presented as real analysis.
- Teacher publish/export/print/retest operations are demonstrations.
- No durable loading/error/offline/permission/provider state model exists.

## Browser findings

The runtime server itself starts successfully. Initial Chrome Headless capture exposed an audit harness lifecycle issue: some screenshots were taken after the temporary server exited and show `ERR_CONNECTION_REFUSED`; those files are evidence of the harness failure and must not be treated as page results. Successful route screenshots exist for login, student today, reading, and review. A complete authoritative Playwright run remains required before release.

## Migration boundary

Reusable: selected clean terrain, mountain, path, and brand artwork; spacing and composition references; DOM information architecture; limited interaction affordances.

Visual reference only: fixed desktop canvases, exact mobile composite images, static report/growth claims, simulated recording, and source QA screenshots.

Must be reimplemented: routing, auth, school context, data adapters, saving/conflict behavior, microphone/upload/processing states, offline/sync, permission handling, provider availability, responsive layout, and accessibility semantics.

