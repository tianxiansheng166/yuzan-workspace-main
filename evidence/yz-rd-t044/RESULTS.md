# YZ-RD-T044 — practice catalog UX and real speaking workflow

| Field | Value |
| --- | --- |
| `TASK_ID` | `YZ-RD-T044` |
| `STATUS` | `PASS / COMPLETE / NOT MERGED` |
| `BRANCH` | `feat/yz-rd-t044-practice-catalog-ux-hierarchy` |
| `START_SHA` | `ef3e5404ab43561b89b6bf863f5c7f7a250afa27` |
| `FINAL_SHA` | Branch HEAD at push; exact SHA is reported in the completion response. A Git commit cannot contain its own SHA, and repository handoff rules prohibit a SHA-only follow-up commit. |
| `READY_TO_MERGE` | `NO — inherited T033 full API lint debt (1201 errors / 1 warning) remains unresolved.` |
| `L4_OPEN` | `OPEN / untouched` |

The target checkout's `AGENTS.md` does not contain the AA-DEV-V2.2 marker. I followed this task card and the supplied `/home/tian/code/AGENTS.md` safety baseline and recorded the mismatch here. T005, other task worktrees, L4 data, and the shared branch were not changed. No Docker/Compose was used and this branch was not merged.

## Acceptance fields

| Field | Result |
| --- | --- |
| `CATALOG_VISUAL_HIERARCHY` | **PASS, with a small-screen note.** Removed repeated promotion cards; Chromium found 0 extra promotion cards and 10 real catalog cards. At 390px the full facet sidebar is hidden and the oral filter remains visible. The first card begins at y≈1018px, after the title, tabs, ability rail, and result controls, so a 390×844 viewport needs a short scroll to reach the first card. |
| `RECORDING_FILTER` | **PASS.** The visible, keyboard-operable control sent a real `GET /api/v1/schools/{schoolId}/practices?requiresRecording=true&sort=RECOMMENDED`. The request returned only items with `requiresRecording=true`. |
| `MOCK_SPECIALIZED` | **PASS.** The original tabs sent server requests with `catalogType=MOCK` and `catalogType=SPECIALIZED`; returned rows matched each category. MOCK shows the non-official-exam disclaimer. |
| `REAL_RECORDING_SUBMISSION` | **PASS.** Authorized seeded `停顿与节奏专项训练` (`70000000-0000-4000-8000-000000000003`) opened as Attempt `f886bb44-8386-4edf-bf31-ff643d7c9c8d` for isolated enrollment `e7e11be2-c273-4ee8-819c-013df16d22dd`. Prompt audio played; two `SIMULATED_MIC` recordings were previewed, uploaded, and read back from MinIO. One submit POST produced `PROCESSING`. An interrupted answer save and signed upload both recovered after retry. |
| `CHROMIUM_API_PG_MINIO` | **PASS.** Native Chrome 153.0.8010.52 + NestJS API + PostgreSQL 17.11 + Redis 7.4.10 + MinIO. Isolated database/user: `yuzan_t044_native` / `yz_t044`; bucket `yz-t044-native`; API/Web `4144/4344`, PostgreSQL `55674`, Redis `6474`, MinIO `59272–59273`. Worker stayed stopped; `SPEECH_PROVIDER=disabled`. |
| `FOUR_VIEWPORTS` | **PASS.** Actual catalog and Runner screenshots were captured at 390, 768, 1280, and 1440px. `scrollWidth` matched the viewport at all widths; screenshots were visually checked and all images loaded. |
| `PASS_FAIL_SKIP_NOTRUN` | **Recorded acceptance run PASS:** frontend 92/92; native Chromium E2E 1/1; native MinIO storage smoke passed; 0 failed and 0 skipped. **Follow-up frontend run PASS:** 92/92. **Follow-up native replay NOT RUN:** blocked before API/browser startup by the local API build's stalled file reads (details below). **NOT RUN:** physical microphone/device, calibrated speech provider, post-human-review formal report generation, school pilot, production launch, and inherited full API lint gate. |

## Real status and safety evidence

- PostgreSQL shows the submitted oral Attempt in `PROCESSING`, 0 scored items, 0 `AssessmentReport` rows, and 2 `CREATED` SpeechJobs with no provider result. The report API returned HTTP 200 with a `null` body, and the student page had no formal-report link. No teacher score, fake grade, automatic score, or formal report was generated.
- The two completed MinIO recordings are `32ceabd0-9291-4c1f-b534-e892c04a5233` (24,446 bytes) and `682236d4-571f-4d3e-8a78-714f5ac9aae4` (23,480 bytes), both `audio/webm;codecs=opus`. The browser and MinIO HeadObject checks confirmed the objects. The interruption test confirmed no object was present before retry.
- Authorization checks returned 401 (anonymous), 403 (foreign school and student review queue), and 404 (missing practice). A different same-school student received 404 for the Attempt and 403 for its report; their history did not expose it.
- Microphone denial created no Recording row. Browser page errors: 0. The only MOCK catalog row created for this test is tagged `TEST_FIXTURE_ONLY`; repeated local E2E runs retained only isolated catalog fixtures and no scores or reports.

## Screenshot review

Catalog screenshots:

- [390px](e2e/catalog-390.png)
- [768px](e2e/catalog-768.png)
- [1280px](e2e/catalog-1280.png)
- [1440px](e2e/catalog-1440.png)

Detail screenshots: [390px](e2e/detail-390.png), [1440px](e2e/detail-1440.png).

Runner screenshots: [390px](e2e/runner-390.png), [768px](e2e/runner-768.png), [1280px](e2e/runner-1280.png), [1440px](e2e/runner-1440.png).

Processing state: [1440px](e2e/processing-1440.png).

Review found a mobile CSS cascade where the shared visual stylesheet restored a tall filter panel. T044 now overrides it in `practice.css` at 680px and below: the compact recording control stays visible and the catalog gets the available width. No other task's visual stylesheet was changed.

Follow-up visual review confirmed the oral filter is visible near the top on the 390px catalog; the first practice card begins at about y=1018px, so it takes a short scroll from an 844px-tall viewport to reach. All four catalog and Runner widths have no horizontal overflow. The Runner screenshots also show low-contrast pale contextual labels under the shared header (for example, the return link and Runner title); core question and submit controls remain legible. This shared-shell presentation is recorded for follow-up without changing another task's source.

## Follow-up verification on 2026-10-19

- `node --test frontend/tests/assessment/*.test.mjs`: 92 passed, 0 failed, 0 skipped. `git diff --check` passed.
- Replaying the full native runner first hit a 10-second pnpm version probe timeout from the default fallback Node. Pinning the repository's Node 24.20.0 resolved pnpm; the MinIO/ffmpeg version probes then timed out while loading local binaries.
- A direct T044 `start --profile assessment` passed the isolated PostgreSQL identity/migration checks and started only T044 PostgreSQL. API `nest build` then waited on local file reads for more than four minutes (about 37 MiB read) and never reached API/Redis/MinIO startup or browser E2E. This replay is **NOT RUN**, not a failing application test. I terminated only the inspected T044 build process group and ran the task-aware `stop`; final status confirmed PostgreSQL, API, and Web stopped. No Docker was used.
- The earlier completed native pass remains the recorded acceptance result and is backed by the committed [native-run.log](native-run.log), [e2e-summary.json](e2e/e2e-summary.json), MinIO read-back evidence, and screenshots above. The follow-up did not create or submit another Attempt.

## Reproduction and machine-readable evidence

- Native full run: `YZ_T044_TOOLCHAIN_ROOT=/home/tian/code/yuzan-workspace-main/runtime-local/native-web tests/e2e/assessment/run-yz-rd-t044-native.sh all`
- E2E summary with query URLs, Attempt/enrollment IDs, recording IDs, MinIO hashes, authorization, status counts, and viewport widths: [e2e-summary.json](e2e/e2e-summary.json)
- Native startup, smoke, browser result, and owned-process shutdown log: [native-run.log](native-run.log)
- MinIO storage smoke: [storage-smoke.log](storage-smoke.log)
- Frontend regression: `node --test frontend/tests/assessment/*.test.mjs` — 92 passed, 0 failed, 0 skipped.

Native T044 services stopped cleanly; all task ports are free. Its isolated database and MinIO data remain available for audit. The T033 API lint debt still blocks merge readiness; no merge was performed. Physical microphone, calibrated speech processing, human review/report creation, pilot, and production remain separate gates.
