# Development status

| Stage   | Status           | Result                                                                                                                                                                                                                                      |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0      | DONE             | New-machine baseline: root pnpm workspace and local services.                                                                                                                                                                               |
| QB-001  | DONE             | Versioned independent question bank; delivery/scoring separation. Commits `917e4c5`–`896c565`; runtime and security tests added.                                                                                                            |
| QB-002  | DONE             | Unified student runner. Commit `7e52d30`, followed by asset fix `caa9111`; runner E2E covers stimuli, responses, persistence, and restoration.                                                                                              |
| QB-003  | DONE             | QB-003A-F strict source importer finalization. Generic block grammar, answer/rubric binding, media fail-closed matching, and behavioral importer tests are complete.                                                                        |
| QB-003B | DONE             | Level 1 canonical manifest now imports idempotently into global Resource/MinIO, immutable Question Bank versions, a published SYSTEM practice/delivery, and the real student runner.                                                        |
| QB-004  | DONE via QB-003B | The Level 1 real 20-item assessment, media playback, refresh restoration, and submit journey were proved as part of QB-003B.                                                                                                                |
| QB-005  | DONE             | `qb-deterministic-v1` scores finalized Level 1 `EXACT_CHOICE`, `DICTATION_ALIGNMENT`, and `ACCEPTED_TEXT` answers; 14/20 items and 58/100 points are deterministically covered, while rubric/speech items keep the session in `PROCESSING`. |
| QB-006  | DONE             | Level 1 read-aloud diagnostic route: three local-provider jobs, bounded safe diagnostics, `NEEDS_REVIEW`, no formal `scoredScore`, and picture-speaking exclusion.                                                                          |
| QB-007  | TODO             | Picture-speaking scoring.                                                                                                                                                                                                                   |
| QB-008  | TODO             | Levels 2–6 bulk import.                                                                                                                                                                                                                     |

## Architecture checkpoints

Question identities are stable and versions immutable. Practices compose versioned
items; assessment items snapshot execution. Browser delivery excludes answers and
rubrics. The unified runner uses stimulus + response combinations. Question Bank
automatic results are persisted on `AssessmentItem` only after submit, use
point-based aggregation when complete, and do not create an incomplete final
report. Read-aloud provider results cross a server-side policy boundary: local
metrics are validated as 0–100, converted to bounded learning-only
`candidatePoints`, exposed to students only through a safe diagnostic, and never
finalize a formal score while the provider remains experimental and uncalibrated.

## Known content blockers

Level 2 read-aloud claims three questions but currently supplies two. Future import
must fail loudly until the source is corrected; it must not synthesize content. The
QB-006 local scorer also does not yet reproduce the authored Level 1 four-point
rubric and deduction rules as a formal scoring policy.

## Technical debt for later

Historical migration-checksum governance and the existing `@eslint/js` configuration
issue remain non-blocking. They must not delay the current question-bank roadmap.
