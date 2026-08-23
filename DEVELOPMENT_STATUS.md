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
| QB-007  | DONE             | Picture-speaking diagnostic is a separate open-response route; generic teacher review resolves all six pending Level 1 items and the 20/20 point-based finalization gate creates one 100-point report. |
| QB-007S | DONE / RECOVERED | Authorized structural recovery restored the missing Level 1 A label and revalidated all nine `EXACT_CHOICE` items; no browser fallback or scoring-config penalty remains. |
| QB-008R | DONE / RUNTIME VERIFIED | Authorized content recovery is canonical and provenance-preserving: Level 1 has one structural repair, Level 2 has one reproducible `AI_AUTHORED_GAP_FILL` READ_ALOUD item, and an isolated Level 4 A/B label omission was structurally recovered. |
| QB-008  | DONE / BROWSER VERIFIED | Levels 1–6 are published through the immutable runtime pipeline: 120 canonical items, six 20-item/100-point practices, 90 images, 36 audio resources, student-safe delivery, idempotent re-apply, and six passing parameterized browser journeys. |
| QB-009A | DONE / HARNESS READY | Provider-neutral `disabled`/`local`/`iflytek`/`tencent` boundary, iFlytek ISE streaming and Tencent new SOE adapters, immutable audio normalization, fixture contracts, and DB-free benchmark harness are complete. All provider evidence remains `UNCALIBRATED`, review-required, and non-finalizable; no formal automatic score is enabled. |
| QB-009B | TODO / EXTERNAL_INPUT | Requires approved 30–50 consented/de-identified recordings, teacher labels, provider credentials if live smoke is approved, and an explicit calibration/product decision. |

## Architecture checkpoints

Question identities are stable and versions immutable. Practices compose versioned
items; assessment items snapshot execution. Browser delivery excludes answers and
rubrics. The unified runner uses stimulus + response combinations. Question Bank
automatic results are persisted on `AssessmentItem` only after submit, use
point-based aggregation when complete, and do not create an incomplete final
report. Read-aloud and picture-speaking provider results cross a server-side
policy boundary: local diagnostics are validated and exposed only as bounded
learning evidence, while formal scores remain null until an authorized teacher
reviews `RUBRIC_TEXT`, `SPEECH_READING`, or `SPEECH_OPEN_RESPONSE`. Finalization
requires every required item and creates one point-based report.

## Content recovery policy

Raw authoring sources remain read-only. The canonical pipeline is
`raw source → parser → structural recovery → explicit repair ledger → validator
→ immutable runtime apply`. Non-source-authored content is tagged
`STRUCTURAL_RECOVERY`, `AI_INFERRED`, or `AI_AUTHORED_GAP_FILL` with evidence and
user authorization in server-side provenance; student delivery never exposes it.

## Known limitations

Local and cloud speech diagnostics remain experimental and do not reproduce the
authored rubrics as formal automatic scoring. Production provider benchmarking
and calibration are intentionally deferred to QB-009B. The QB-009A synthetic
harness is not evidence for formal activation.

## Technical debt for later

Historical migration-checksum governance and the existing `@eslint/js` configuration
issue remain non-blocking. They must not delay the current question-bank roadmap.
