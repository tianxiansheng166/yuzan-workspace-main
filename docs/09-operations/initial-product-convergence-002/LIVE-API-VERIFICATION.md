# Live API verification

## Result

CP7 produced a startable Nuxt/API product and exercised real HTTP calls, but it did not produce an uninterrupted all-live acceptance chain. Browser evidence is at `C:\Users\Administrator\.codex\visualizations\2026\07\13\019f5beb-339d-7ca1-9934-0a21ef08c9df\initial-product-browser-smoke.json`; test fixtures and databases were removed after the run.

## Browser evidence

- 10 routes returned HTTP 200: `/`, `/plans`, `/login`, `/volunteer`, `/research`, `/student/courses`, `/student/today`, a dynamic learning route, `/teacher/review`, and `/admin`.
- 61 browser API calls and 10 direct verification calls were observed. Combined statuses were 51 x 200, 6 x 201, 7 x 401, 1 x 403 and 6 x 503.
- `/plans` returned a real empty collection. `/admin` and `/research` rendered real 503 gap states. `/volunteer` rendered real 503 because its repositories are unavailable.
- No page exceptions, resource 404s or horizontal overflow were found. Ten checks covered 1440 x 900, 1024 x 768 and 390 x 844. The 11 console errors were browser failed-resource messages corresponding only to deliberately exercised 401 and 503 responses.
- Real browser login and school selection passed. Teacher course/assignment reads and writes, student course/today reads, progress update, submission, teacher submission read, feedback API write and student feedback reread were exercised.

## Test-only transitions used

These actions were isolated to the disposable smoke fixture and are not product capabilities:

- curriculum was promoted in the fixture after real publish returned provider 503;
- assignment was moved from DRAFT to SCHEDULED because no scheduling endpoint exists;
- initial progress was seeded because the page lacks enrollment context before a progress record exists;
- submission was moved to NEEDS_REVIEW because no worker/public transition was available;
- feedback was posted through the real API after the teacher page form failed to dispatch.

Because these transitions were required, the teacher-student loop is partial rather than passed.

## Commands actually run

- `pnpm.cmd --filter @yuzan/web test` — 56 files, 323 tests passed.
- `pnpm.cmd --filter @yuzan/web typecheck` — exit 0; existing Volar route-block plugin warning.
- `pnpm.cmd --filter @yuzan/web build` — exit 0; existing Volar, sourcemap and deprecation warnings.
- `pnpm.cmd --filter @yuzan/api typecheck` — exit 0.
- API targeted curriculum, assignment, reporting and feedback tests — all selected files passed; the final affected set was 3 files, 31 tests.
- `node vitest.mjs run --maxWorkers=1 --minWorkers=1 --no-file-parallelism` against a fresh migrated isolated database — 39 files, 780 tests passed.
- `pnpm.cmd --filter @yuzan/contracts validate` — exit 0; OpenAPI valid with two pre-existing advisory warnings.

The first parallel full API run is not counted as a pass: database suites shared and cleaned the same test database. The recorded full pass used a fresh database and serial file execution.

## Blocking backend truth

- Volunteer, training and support-pairing modules bind unavailable repositories; the Prisma schema has no corresponding persistence models.
- Curriculum publish is reachable but resource lookup is unavailable.
- Assignment state requires SCHEDULED before OPEN, but no scheduling API is exposed.
- Class-targeted assignments are not expanded to student enrollments.
- First activity-progress creation cannot be initiated from the current page contract.
- Teacher feedback API is live, but the reviewed page form did not dispatch during smoke.
