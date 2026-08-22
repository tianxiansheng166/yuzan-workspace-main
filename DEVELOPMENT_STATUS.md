# Development status

| Stage | Status | Result |
| --- | --- | --- |
| M0 | DONE | New-machine baseline: root pnpm workspace and local services. |
| QB-001 | DONE | Versioned independent question bank; delivery/scoring separation. Commits `917e4c5`–`896c565`; runtime and security tests added. |
| QB-002 | DONE | Unified student runner. Commit `7e52d30`, followed by asset fix `caa9111`; runner E2E covers stimuli, responses, persistence, and restoration. |
| QB-003 | DONE | QB-003A-F strict source importer finalization. Generic block grammar, answer/rubric binding, media fail-closed matching, and behavioral importer tests are complete. |
| QB-003B | TODO | Next source-to-manifest checkpoint; not started. |
| QB-004 | TODO | Level 1 real assessment. |
| QB-005 | TODO | Deterministic scoring. |
| QB-006 | TODO | Read-aloud speech scoring. |
| QB-007 | TODO | Picture-speaking scoring. |
| QB-008 | TODO | Levels 2–6 bulk import. |

## Architecture checkpoints

Question identities are stable and versions immutable. Practices compose versioned
items; assessment items snapshot execution. Browser delivery excludes answers and
rubrics. The unified runner uses stimulus + response combinations.

## Known content blockers

Level 2 read-aloud claims three questions but currently supplies two. Future import
must fail loudly until the source is corrected; it must not synthesize content.

## Technical debt for later

Historical migration-checksum governance and the existing `@eslint/js` configuration
issue remain non-blocking. They must not delay the current question-bank roadmap.
