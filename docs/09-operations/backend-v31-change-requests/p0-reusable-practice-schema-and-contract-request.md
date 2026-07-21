# P0 reusable practice schema and contract request

User-authorized integration request for `P0-REUSABLE-PRACTICE-GOLDEN-CLOSURE-001`.

- Schema: versioned `PracticeDefinition`, `PracticeVersion`, `PracticeSection`, `PracticeItemRef`, `PracticeDelivery`; nullable attempt provenance on `AssessmentSession`; immutable item snapshot metadata on `AssessmentItem`.
- API: student-scoped `GET /schools/{schoolId}/practices`, detail, create-or-resume attempt, attempt and attempt items.
- Safety: every query is constrained to the active tenant; a delivery must match the student's active enrollment/class or direct student target. Published versions are never updated by this flow; creation copies sections/items in one transaction and rejects zero-item versions.
- Compatibility: existing assessment APIs and their response fields remain unchanged. `/assessment` remains an application-level compatibility route.
