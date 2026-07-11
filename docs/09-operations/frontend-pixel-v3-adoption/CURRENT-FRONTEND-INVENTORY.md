# Current frontend inventory

Baseline: `origin/integration/frontend-redesign-20260710` at `c906acf05a78dd54f48068021b14d1577aeeea26`.

The official frontend is Nuxt 4 / Vue 3 and builds as an SSR Nitro node server. It already contains 34 page files covering public, auth, teacher, student, assessment, reports, training, and tools. The source runtime has only 14 routes and therefore cannot be used as a completeness source.

## Protected production boundaries inspected

- Auth: `features/auth` gateway, session gateway, login page state, redirect and role utilities.
- Middleware: login/session and protected-route middleware retained.
- School context: existing session/school selection boundaries retained; no source static school data imported.
- API: `app/lib/api` unchanged.
- Offline: service worker, global status, IndexedDB storage, outbox safety boundaries retained.
- Domain ports/adapters: assignment, classes, reports, learning player, review, speech, today, and translation retained.
- SSR/hydration: Nuxt production build succeeds; runtime browser verification remains required.

## Route coverage summary

Present: `/`, `/login`, `/products`, assessment five-page flow, reports, student today/player, teacher dashboard/classes/assignments/review/assessment/student report, curriculum studio, teacher tools, Tibetan translation, training, volunteer training.

Missing as explicit routes at this baseline: school selection, course center/recommendations/tasks as separate student routes, most administration routes, volunteer service-task/help routes, and some product/cooperation detail routes. Missing routes are not marked complete and were not invented.

## Baseline tool findings

- `pnpm install --frozen-lockfile` resolves all 1223 packages, but the bundled pnpm runtime treats ignored dependency build scripts as an error. System pnpm completes with `--ignore-scripts`.
- `nuxt build` succeeds.
- `nuxt typecheck` reports a `vue-router/volar/sfc-route-blocks` plugin loading error while returning success; it is not accepted as a clean typecheck.
- Package manifest and lockfile were not changed by the adoption work.

