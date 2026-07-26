# Integration Checkpoint: Runtime Revalidation

- Recorded: 2026-07-26
- Canonical baseline: `main` / `origin/main` at `1f12a1b`
- Integration baseline: `integration/p0-multitrack-001` at `1f12a1b`
- Scope: local runtime truth, recording upload compatibility, and P0 closure status.

## Runtime Finding and Repair

The recording upload failure was not a stale frontend. The browser received a presigned URL containing
`x-amz-sdk-checksum-algorithm=CRC32`; the local MinIO compatibility path rejects this optional AWS SDK
flexible-checksum feature and returns an error without CORS headers. Browser DevTools therefore reports a
CORS failure even when the origin allowlist is correct.

`S3CompatibleStorageAdapter` now sets `requestChecksumCalculation: "WHEN_REQUIRED"`. A generated
MinIO-compatible test URL contains neither `x-amz-sdk-checksum-algorithm` nor `x-amz-checksum-crc32`.
MinIO was recreated without deleting its named data volume. Exact browser-style OPTIONS verification for
`Origin: http://127.0.0.1:4175`, `PUT`, `content-type`, and all observed `x-amz-*` request headers returns
204 with the matching allow-origin/header/method values.

This is a runtime repair, not a claim that an entire student flow is re-accepted. The next browser recording
must obtain a newly generated URL after API restart; an old URL still carries the old unsupported query fields.

## Source/Task Truth

| Track | Source state | Current runtime evidence | Next gate |
|---|---|---|---|
| Course-linked practice | Source and prior evidence exist; course → practice → recording/written answer → course writeback implemented | Revalidation required after storage URL compatibility repair | New-browser real recording upload, completion, object readback, course progress persistence |
| Whole-course submit | Five persisted activity types and submission code integrated | Prior speech evidence is API-level for one step; current runtime needs browser retest | Dynamic teacher/student course assignment → 100% → submit → teacher sees real submission |
| Teacher assignment | `POST /assignments`, target persistence, student notification, and student task queries exist | No accepted browser proof across teacher and student; teacher review navigation contains a fixed `submission-1` route and dashboard cards are demo-only | Dedicated cross-role closure task, no fixed IDs |
| Independent practice | Backend/API integrated with prior task evidence | Not re-run in this runtime window | Real recording and explicit scoring/NEEDS_REVIEW result |
| AI lesson plan | API/worker checkpoint integrated | Flowise health/auth works; provider prediction unavailable | Configure provider then browser job → draft → review evidence |
| Tibetan translation | Persistence/security/worker checkpoint integrated | Provider and compliance unavailable | Provider/compliance decision, real BO↔ZH job, browser review closure |

## Required Next Task

`P0-TEACHER-STUDENT-ASSIGNMENT-CLOSURE-001` is the next P0 task. It must prove in one new browser-driven
chain: teacher creates an OPEN course assignment for a real development class; the targeted student logs in
in a fresh context and sees that dynamic assignment in `/student/today` and course entry; student completes
the supported minimum; teacher opens the dynamic assignment ID and sees the actual submission. All page
links must use returned IDs, not `submission-1`, and the test must record API/DB/browser evidence and negative
cross-student/cross-school checks.

## Do Not Claim Yet

- Do not claim teacher-to-student delivery complete from backend routes alone.
- Do not call demo dashboard counts, iframe/static student pages, or fixed review links live product behavior.
- Do not call AI generation or Tibetan translation available while their providers are unavailable.
