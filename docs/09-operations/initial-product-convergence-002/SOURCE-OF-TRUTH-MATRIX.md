# Source of truth matrix

Authoritative structured matrix: `SOURCE-OF-TRUTH-MATRIX.json`.

Current ruling: keep Nuxt pages that were already live-bound; preserve the selectively adopted `/select-school` and `/student/courses` implementations; use VM A/B only for the visual, state and interaction layers of the seven adjudicated routes; reject all VM/demo business data. CP4 adopted five VM-informed routes without copying either standalone runtime or replacing the current `/teacher` and `/student/courses` Nuxt implementations. No whole frontend merge was used.

Known contract drift is tracked in `orchestration/requests/CCR-INITIAL-PRODUCT-002-P1-ROUTE-DRIFT.md`. Until the owner decides, live adapters follow the executable controller paths and the UI exposes unavailable/error states rather than inventing aliases.

CP6 ruling: b31-102 is recovered at `caca816`, but its assessment, speech, recommendation and assessment-report modules remain unavailable scaffolds rather than live backend truth. The existing Nuxt assessment pages therefore stay on explicit pending/unavailable states. b31-105 did not supply a new endpoint; its missing active-school route assertion and freeze evidence were selectively adopted.
