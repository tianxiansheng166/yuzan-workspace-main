# Pilot runbook

QB-016 provides a small, derived operations view for a controlled pilot. It
does not add a telemetry event table or a metrics snapshot table.

## Readiness

- `GET /api/v1/health/live` is process liveness only. PostgreSQL, Redis, and
  object storage failures must not make it fail.
- `GET /api/v1/health/ready` runs `SELECT 1`, Redis `PING`, and a read-only
  configured-bucket `HEAD`. It returns `200 { status: "ok" }` only when all
  three checks are up, otherwise `503 { status: "unavailable" }`.
- Readiness never creates a bucket. The Question Bank bootstrap may still use
  its separate `ensureBucket()` path.

## Pilot overview definitions

- `window` is only `24h` or `7d`; the default is `24h`.
- Formal funnel metrics include only Question Bank `STANDARD` sessions whose
  snapshot contains a question-bank version. `created` is the denominator;
  `started` is every created session no longer in `CREATED`; `completionRate`
  is `completed / created`. Remediation is never included.
- `STALE_PROCESSING` means a `STANDARD` or `REMEDIATION` session has status
  `PROCESSING` and `updatedAt` is older than 30 minutes. The overview never
  changes that session.
- Teacher review backlog uses the same reviewable strategies as the existing
  review queue (`RUBRIC_TEXT`, `SPEECH_READING`, `SPEECH_OPEN_RESPONSE`) and
  only currently submitted/processing, unscored, published Question Bank
  items. `REVIEW_BACKLOG` is shown when the oldest pending item is at least
  24 hours old.
- Remediation metrics remain separate for `SELF_INITIATED` and
  `TEACHER_ASSIGNED`; their scores are not formal scores.
- Speech counts use the persisted `SpeechJobStatus` and `RecordingStatus`
  enums. Any `FAILED` speech job adds `SPEECH_JOB_FAILURES`; it never creates
  a formal zero.
- A fresh worker Redis heartbeat is `UP`. The worker writes every 15 seconds
  with a 60-second TTL by default (`WORKER_HEARTBEAT_KEY`,
  `WORKER_HEARTBEAT_INTERVAL_MS`, and `WORKER_HEARTBEAT_TTL_SECONDS` may be
  configured consistently across API and Worker). A missing or expired value
  is `UNKNOWN`/`STALE` and adds `WORKER_HEARTBEAT_STALE`.
- Overall state is deterministic: `DEGRADED` when any core readiness check is
  down; `ATTENTION` when core checks are up but any warning exists; otherwise
  `HEALTHY`.

## Incident actions

| Warning | First action |
| --- | --- |
| `CORE_DEPENDENCY_DOWN` | Check PostgreSQL, Redis, and MinIO/S3 endpoint and bucket permission. |
| `WORKER_HEARTBEAT_STALE` | Check the Worker process and its Redis configuration. |
| `STALE_PROCESSING` | Inspect the affected session, review queue, and speech jobs; do not edit it from the overview. |
| `REVIEW_BACKLOG` | Arrange teacher review for the existing review queue. |
| `SPEECH_JOB_FAILURES` | Keep formal speech scoring fail-closed and use teacher review; do not assign zero automatically. |
| `OPEN_FEEDBACK_BACKLOG` | Admin acknowledges the report, records a short resolution note, and resolves it when handled. |

## Feedback triage

Students, teachers, and school admins can submit plain-text `PilotFeedback`
records. The server derives reporter, school, and question-version context from
authorization and validated assessment IDs. Answers, rubrics, transcripts,
recording bytes, provider responses, IPs, and device fingerprints are not
stored. Admins use the School Admin **试点运行** page to acknowledge and resolve
reports; reporters use the Runner **反馈问题** entry and **我的反馈** history to
see the resulting status and resolution note.

`PilotFeedback` is deliberately separate from course-submission `Feedback`.
