# ACC-UI-001 visual review

Reviewed on 2026-07-10 from the production build at `/`.

## Evidence

- `home-390.png`: 390 CSS px, full page. Mobile header, 44 px navigation control, hero, path list and voice band reflow without horizontal clipping.
- `home-768.png`: 768 CSS px, full page. Tablet hierarchy and terrain crop remain legible.
- `home-1440.png`: 1440 CSS px, full page. Full primary navigation and two-column hero are visible.

## Findings

- One `main` landmark and one page `h1`.
- Warm paper, forest, ochre and brick palette; no purple-blue gradient or glass layer.
- Homepage sections form a continuous route rather than a card wall or nested cards.
- `demo`, `pending`, `unavailable` and preview truth language are visible text, not color-only states.
- Keyboard skip target is `#main`; focus uses a 3 px ochre outline with forced-colors fallback.
- Motion is disabled under `prefers-reduced-motion: reduce`.
- The 390 px reflow also covers the effective narrow layout expected when a wider viewport is enlarged toward 200% zoom. Text and actions remain in normal flow.

## Asset review

The terrain SVG is original task-local geometry. It contains no portrait, student data, logo, external brand, third-party reference or licensed material.
