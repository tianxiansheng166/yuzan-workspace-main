# Source of truth matrix

Authoritative structured matrix: `SOURCE-OF-TRUTH-MATRIX.json`.

Current ruling: keep any Nuxt page already live-bound; selectively port `/select-school` and later `/student/courses`; use VM A/B only for visual, state and interaction references; reject all VM/demo business data. No whole frontend merge is allowed.

Known contract drift is tracked in `orchestration/requests/CCR-INITIAL-PRODUCT-002-P1-ROUTE-DRIFT.md`. Until the owner decides, live adapters follow the executable controller paths and the UI exposes unavailable/error states rather than inventing aliases.