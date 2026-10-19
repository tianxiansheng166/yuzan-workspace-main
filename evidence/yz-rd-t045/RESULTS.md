# YZ-RD-T045｜练习中心移动端视觉与交互验收

| Field | Result |
| --- | --- |
| `TASK_ID` | `YZ-RD-T045` |
| `STATUS` | `COMPLETE / NATIVE_CHROMIUM_API_POSTGRESQL17_REDIS_MINIO_VERIFIED / NOT_MERGED` |
| `BRANCH` | `feat/yz-rd-t045-mobile-practice-first-card` |
| `START_SHA` | `c1402145b132306adcc077555d641b2c0c4eaf83` |
| `FINAL_SHA` | Git HEAD at checkpoint; reported in the task return (no SHA-only follow-up commit) |
| `READY_TO_MERGE` | `NO — inherited full API lint debt remains: 1201 errors / 1 warning (not rerun; no backend changes)` |
| `L4_OPEN` | `OPEN / untouched` |

The target checkout's `AGENTS.md` does not contain the `AA-DEV-V2.2` marker. I followed the supplied task card and `/home/tian/code/AGENTS.md` safety baseline. Work stayed on the exact T045 branch/worktree. No Docker/Compose, T005 source/resources, other task worktree, shared merge, or L4 data was touched.

## Acceptance

- **`MOBILE_FIRST_CARD_POSITION`: PASS.** In authenticated Chromium at 390×844, the first card from the real `requiresRecording=true` API response is `古诗文朗读与理解训练` (`70000000-0000-4000-8000-000000000001`). Its document top is **y=623px**; its title occupies y=813–838 and is fully visible before the viewport ends. The first card itself is confirmed by the real API response to require recording.
- **`VISUAL_HIERARCHY`: PASS.** Search field and its 44px-high Search action share a row. The real oral filter and category controls remain available; mobile ability facets use a native collapsed disclosure. Header and result spacing were reflowed, and the mobile cover is 150px high to bring the exercise title into view. No practice text was reduced in size. The 390px screenshot shows no horizontal overflow and no promotional button wall.
- **`RECORDING_FILTER`: PASS.** Chromium sent `requiresRecording=true`; every returned item, including the first visible card, had `requiresRecording: true`. The active chip reads `需要录音`. The authorized seeded oral practice `停顿与节奏专项训练` opened from the filtered results.
- **`SEARCH_AND_CATEGORIES`: PASS.** Searching `停顿与节奏专项训练` returned the matching real item. MOCK and SPECIALIZED tabs sent their server-owned `catalogType` requests and returned matching item types. Ability filtering by keyboard and touch sent the real `abilityCategory=发音基础` request; the disclosure expanded/collapsed by keyboard and touch, and its summary reflected the selected category.
- **`TEACHER_TASK`: PASS.** A `TEST_FIXTURE_ONLY` teacher-assigned remediation row in the isolated PostgreSQL database was read through the real student API and rendered before category tabs with its dynamic attempt link. This verifies preservation of the task display path; the test did not re-verify teacher-side task creation.
- **`FOUR_VIEWPORTS`: PASS.** Real API-backed catalog viewport screenshots were reviewed at 390×844, 768×1024, 1280×900, and 1440×1000. `scrollWidth` equaled viewport width at all four sizes. Detail and Runner layouts were also checked at their configured responsive widths.

| Viewport | Catalog viewport screenshot | First card document y | Horizontal overflow |
| --- | --- | ---: | ---: |
| 390×844 | [catalog-390.png](e2e/catalog-390.png) | 623px | 0px |
| 768×1024 | [catalog-768.png](e2e/catalog-768.png) | 833px | 0px |
| 1280×900 | [catalog-1280.png](e2e/catalog-1280.png) | 835px | 0px |
| 1440×1000 | [catalog-1440.png](e2e/catalog-1440.png) | 835px | 0px |

Other browser evidence: [expanded abilities at 390px](e2e/ability-expanded-390.png) and [all browser/API assertions, including detail and Runner responsive checks](e2e/e2e-summary.json).

## Chromium / API / PostgreSQL / MinIO

Native Google Chrome 153.0.8010.52 exercised the real frontend and NestJS API against isolated PostgreSQL 17.11, Redis 7.4.10, and MinIO. The runtime used ports 4145/4345/55675/6475/59274–59275 and database/user `yuzan_t045_native` / `yz_t045`. MinIO upload, read-back, and signed GET smoke passed. Browser E2E passed **1/1, 0 failed, 0 skipped**.

The real oral Runner played its prompt, saved and auditioned two `SIMULATED_MIC` recordings, recovered an interrupted answer save and MinIO upload, and submitted once. MinIO read-back confirmed two 24,446-byte `audio/webm;codecs=opus` objects. PostgreSQL and API confirmed `PROCESSING`, two `CREATED` SpeechJobs, zero scores, and zero reports; report GET returned `null`. No automatic score was generated. This is browser/API QA with simulated microphone input, not physical-device evidence.

Authorization checks returned 401 anonymous, 403 foreign-school and student review-queue, and 404 missing practice. Denied microphone permission created no Recording row. No page errors occurred. The API-backed student task card was independently checked on a second fictional student identity.

## PASS / FAIL / SKIP / NOT_RUN

- **PASS:** frontend assessment tests 96/96; JS/Python/shell syntax and `git diff --check`; MinIO storage smoke; native browser/API/PG/MinIO E2E 1/1; four catalog viewport screenshots; detail and Runner responsive checks at four widths; touch/keyboard interactions; API authorization and MinIO read-back.
- **FAIL:** 0 in the final run. Earlier diagnostic attempts and their causes are recorded below and in the named logs; each was corrected before the final 1/1 pass.
- **SKIP:** 0 in the final native E2E.
- **NOT_RUN:** physical microphone/device, calibrated speech scoring, teacher human review/formal report generation, school pilot, production launch, and inherited full API lint gate. `READY_TO_MERGE=NO` reflects the known inherited API lint debt above.

## Resource use and run failures

- Before the final run, host load averages were 10.33 / 11.30 / 10.94 with about 12 GiB available. The final run took 38.97 seconds; `/usr/bin/time -v` reported 987,788 KiB maximum resident set. Resource sampling recorded 20 samples, peak 1-minute load 11.16, and minimum available memory about 11.19 GiB. The global Chrome process count includes existing host browser sessions; no unrelated process was stopped.
- The first native startup found the checkout lacked `infra/database/node_modules`, so `prisma generate` failed with `spawn ENOENT` / `prisma: not found`. `pnpm install --offline --frozen-lockfile` reused all 783 packages from the local store with zero downloads; the lockfile and workspace config remained unchanged. The isolated T045 startup then succeeded.
- Early browser-test iterations exposed test timing/API issues: assertions read the ability summary and search results before asynchronous rerender; one Playwright `wait_for_function` call passed its `arg` positionally. The test now waits for the rendered state and API response. A temporary stricter title-in-viewport check also showed the title needed a small additional layout reduction; the final measurement is y=813–838 and passes.
- Final resource and runner evidence: [native-run.log](native-run.log), [resource-preflight-final.txt](resource-preflight-final.txt), [resource-samples.tsv](resource-samples.tsv), and [resource-time.txt](resource-time.txt). Failure-attempt logs are retained beside them.

The final T045-owned API, Web, PostgreSQL, Redis, and MinIO services were stopped by the ownership-aware runner; status confirmed no T045 services remain active. Its isolated database and MinIO test objects are retained for audit. L4 remains OPEN and untouched.
