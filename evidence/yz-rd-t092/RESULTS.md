# YZ-RD-T092 playback contract review

## Result

`STATUS=BLOCKED_API_PLAYBACK_URL_CONTRACT`

The submission detail API does not expose a recording identifier or an authorized playback URL. The frontend cannot safely derive either from an object key, and the related recording evidence API is keyed by a different model's `recordingId`. No implementation or backend change was made.

## Sources inspected at BASE `abf95ca78cfac816b0af7148a4c86c296c4870ff`

- `frontend/teacher/submissions/detail/app.js:46,96-103,231-239` requests the dynamic `submissionId`, reads `recordingUrl`/`recording`, and currently fakes play state.
- `backend/api/src/modules/submissions/submissions.controller.ts:67-83` exposes `GET /schools/:schoolId/submissions/:submissionId` with student/teacher/admin role checks.
- `backend/api/src/modules/submissions/submissions.service.ts:250-327` checks the requested school, teacher's active enrollment in the submission's class, and returns `toSubmissionDetailResponse`.
- `backend/api/src/modules/submissions/dto/submission.response.ts:46-75` and `packages/contracts/openapi/openapi.yaml:4940-4957` define only submission metadata, assignment title, and student name; there is no `recordingId` or `playbackUrl`.
- `backend/api/src/modules/recordings/recordings.controller.ts:146-158` exposes a separate evidence endpoint keyed by `recordingId`. `recordings.service.ts:569-601` validates school, recording status, active enrollment, and teacher class membership before generating a signed URL, but does not bind that recording to the requested submission.
- `backend/api/src/modules/assessment/assessment-review.controller.ts` and `assessment-review.service.ts:282-323` serve signed playback URLs for assessment review items through a separate `itemId` route/model.

## Missing API contract

The API needs to bind the dynamic `submissionId` to its persisted recording and return a server-authorized playback URL (or expose a submission-scoped playback endpoint). That contract must enforce the current school and teacher's permission for the specific submission before issuing the URL. Until then, the page cannot attach a legitimate source to an audio player.

## File owner and safety guard

- Only this file under `evidence/yz-rd-t092/` is changed. The three frontend implementation files and playback test remain untouched.
- No backend, control-plane, database, storage, T005, Level 4, or raw source files were modified. Control-plane and API contract sources were inspected read-only at BASE; no T005 uncommitted diff or Level 4 raw file was opened.
- `DYNAMIC_SUBMISSION_ID=BASE source uses the URL submissionId for detail and feedback requests; unchanged`
- `REAL_AUDIO_ELEMENT=NOT_ADDED`
- `MISSING_URL_FAIL_CLOSED=NOT_IMPLEMENTED; implementation stopped at the missing authorized API contract`
- `MEDIA_ERROR_HANDLING=NOT_IMPLEMENTED; no player was added`
- `LEGACY_CONTROL_PLANE=NOT_REQUIRED_PER_AGENTS`
- `NOTION_POLICY_READ=READ_OK` (Policy, Lane, Routing pages fetched)

## Verification record

| Check | Command/result | Status |
|---|---|---|
| BASE commit and frontend source paths | `git cat-file -e <BASE>^{commit}` / `git ls-tree -r --name-only <BASE> -- frontend/teacher/submissions/detail` (exit 0) | PASS |
| Submission/controller/DTO/service and feature-chain read | BASE `git show` / `git grep` on the named files (exit 0) | PASS; no playback contract found |
| Recording evidence authorization review | BASE `git show` on `recordings.controller.ts`, `recordings.service.ts`, and `recordings.policy.ts` (exit 0) | PASS; endpoint is not submission-bound |
| Focused playback tests | NOT_RUN; contract blocker prevents an authorized player implementation | NOT_RUN |
| `node --check` for modified JS/MJS | NOT_RUN; no JS/MJS files were modified | NOT_RUN |
| Business JS/MJS gate | NOT_RUN; no JS/MJS files were modified | NOT_RUN |
| Frontend regression suite | NOT_RUN; no frontend implementation was changed | NOT_RUN |
| Browser/API/PostgreSQL/MinIO E2E | NOT_RUN; no runtime was started | NOT_RUN |
| Staged evidence whitespace check | `git diff --cached --check` (exit 0) | PASS |

`READY_TO_MERGE=NO`
`HISTORICAL_L4_INCIDENT_OPEN=YES`
