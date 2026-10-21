# YZ-RD-T109 — 2026-09-08 原版学生端原生验收

## 结果

- `TASK_ID=YZ-RD-T109`
- `STATUS=PASS_NATIVE`
- `BASE_SHA=8974c2a7d5842bb20dbfcd091b63cac5674dcc32`
- `SOURCE_BRANCH=feat/yz-rd-t108-sep08-recovery-quality-integration`
- `OUTPUT_BRANCH=test/yz-rd-t109-sep08-integrated-native-uat`
- `WORKTREE=/home/tian/.devspace/worktrees/yuzan-workspace-t109`
- `RUNTIME_PROJECT=yz-rd-t109`
- `RUNTIME_DIR=/home/tian/.devspace/runtime/yz-rd-t109`
- `READY_TO_MERGE=NO`; no shared merge or deployment was performed.
- `HISTORICAL_L4_INCIDENT_OPEN=YES`; no L4 source or protected question content was read or used.
- No application or product source was changed. Task changes are under `evidence/yz-rd-t109/**` plus this factual handoff.

The remote T108 branch still points to the exact required BASE. T109 was a new worktree and branch. T106's prior E2E was not used as T109 evidence.

## Host admission and isolation

The latest pre-Browser gate is [`resource-pre-e2e-19.json`](resource-pre-e2e-19.json). It passed at `2026-10-21T19:24:10Z` (2026-10-22 03:24 China time): 16 logical CPUs, 13.70 GiB MemAvailable, 6.52 GiB SwapFree, load `0.58 / 0.63 / 0.71`, I/O PSI `some/full avg10=0.54%`, 7.5 CPU headroom after all active caps, 7.67 GiB projected memory margin, and 3.67 GiB projected swap margin. The active non-T109 set was the five finite T106 containers (4.5 CPU cap total); no T106 service was changed. The earlier transient unbounded external-container observation remains preserved in [`resource-blocker.json`](resource-blocker.json); it was not touched. Fresh later admission passed after that container was no longer present.

T109's five services had finite Compose limits; the separate Browser plan was finite as well. Docker HostConfig and cgroup values matched for all six roles:

| Service | CPU | RAM | Additional swap | PIDs |
| --- | ---: | ---: | ---: | ---: |
| Frontend | 0.50 | 384 MiB | 0 | 128 |
| API | 1.00 | 768 MiB | 0 | 192 |
| PostgreSQL | 1.00 | 768 MiB | 0 | 256 |
| Redis | 0.25 | 128 MiB | 0 | 64 |
| MinIO | 0.50 | 384 MiB | 0 | 128 |
| Playwright Chromium | 0.75 | 1,120 MiB | 0 | 256 |

The five services total 3.25 CPU / 2.375 GiB RAM / 768 PIDs; the Browser adds 0.75 CPU / 1.094 GiB / 256 PIDs. `resource-browser-active-snapshot.json` records Browser cgroup values while it was running. The final resource sample reports all five app services healthy, zero restarts and zero OOM events; Browser exited 0 with zero restarts and `OOMKilled=false`. The network was `internal=true` with no host ports. The PostgreSQL and MinIO volumes remain T109-owned; cleanup does not use `down -v` or prune.

The resource watch is [`resource-watch.jsonl`](resource-watch.jsonl), summarized in [`resource-watch-summary.json`](resource-watch-summary.json): 1,274 of 1,275 samples passed. One cgroup read between 18:41Z and 18:43Z raced a normal container exit and reported `FileNotFoundError`; the guard stopped only the T109 stack at that time. The guard was hardened for that exit race, and all later samples passed. This was not an OOM or a T106 action. Latest admission after the Browser run is [`resource-post-native-acceptance.json`](resource-post-native-acceptance.json).

## Isolated data and media

T109 used its own `yz_rd_t109` PostgreSQL database, `yz-rd-t109-media` MinIO bucket, internal network, one authorized test student, T109 courses and assignments, and T109-created practice data. The active media is MDN's CC0-1.0 `flower.webm`; [`media-license.json`](media-license.json) records the source, codec, hash, object key, and that it was not copied from another runtime. Direct MinIO GET returned 554,058 bytes with SHA-256 `c6f8a348…e76dda`. No recording rows or audio were created.

The blank-submit fixture has 20 T109-owned published synthetic single-choice versions, each with valid `maxScore=5`; [`practice-fixture-verification.json`](practice-fixture-verification.json) records the fixture. It does not require recording. The Browser did not create or attach audio evidence.

## Native acceptance

The authoritative successful Browser journey is [`native-e2e-summary.json`](native-e2e-summary.json) / [`native-e2e-attempt-19.json`](native-e2e-attempt-19.json); network statuses are in [`browser-network-summary.json`](browser-network-summary.json). Browser version was Chromium 140.0.7339.16.

| Acceptance | Result | Evidence |
| --- | --- | --- |
| Real student login | `PASS` | Student UI login response HTTP 200. |
| Today, Courses, Course Detail, Growth | `PASS` | Live T109 APIs returned data; dynamic assignment and activity IDs opened the course detail. |
| Course recommendation | `PASS` | Live recommendation opened the returned T109 recommendation course. |
| Actual video playback | `PASS` | Signed playback URL API 200; MinIO returned HTTP 206 ranges; WebM decoded at 960×540, duration 5.059 s, 72 video frames observed. The active-player screenshot shows the native controls and advancing time. |
| Progress save and failure handling | `PASS` | Partial progress PUT 200; controlled T109-only failure returned 503 and remained visible; safe retry returned 200. Refresh restored the saved position at about 2.733 s. Ended progress PUT returned 200 and the API confirmed only the video activity complete. |
| Activity-switch isolation | `PASS` | No progress write was sent to the practice activity while switching from video; the other required activity remained incomplete after video completion. |
| Course practice entry | `PASS_NAVIGATION` | The course activity opened its dynamic `/prepare/` route. The preparation screen reported `getUserMedia` unsupported in this Browser, and its start button was disabled. No simulated microphone or recording was used. The separate Practice Center route opened the real Runner and was used for the allowed isolated blank-submit session. |
| T099 all-blank submit | `PASS` | Normal submit HTTP 201; session reached `COMPLETED`; report total 20, answered 0, unanswered 20, overall score 0. All 20 items had `maxScore=5` and score 0 / `UNANSWERED`; no answer, written-answer row, or recording evidence was attached. |
| Independent PostgreSQL and MinIO proof | `PASS` | [`independent-persistence-proof-final.json`](independent-persistence-proof-final.json): PostgreSQL video position 1/completed true, completed blank report, zero recording rows; independent MinIO HEAD/list/GET matched the licensed object's length and SHA-256. |

The course preparation page's disabled start control is recorded as `NOT_RUN` for starting a linked course attempt because this isolated Chromium environment had no microphone. The course entry's navigation itself passed, and the separate Practice Center session completed the required no-recording blank submission. No audio capability was faked.

## Owner screenshots

All screenshots are captured from the running T109 site under the authenticated test student, not from fixtures. The warm red/green/brown 2026-09-08 student structure is visible; it is not the older blue-purple themed page.

| Page | 1280×900 | 1440×900 | 390px |
| --- | --- | --- | --- |
| Today | [`today-1280x900.png`](screenshots/today-1280x900.png) | [`today-1440x900.png`](screenshots/today-1440x900.png) | [`today-390x844.png`](screenshots/today-390x844.png) |
| Courses | [`courses-1280x900.png`](screenshots/courses-1280x900.png) | [`courses-1440x900.png`](screenshots/courses-1440x900.png) | [`courses-390x844.png`](screenshots/courses-390x844.png) |
| Course Detail | [`course-detail-1280x900.png`](screenshots/course-detail-1280x900.png) | [`course-detail-1440x900.png`](screenshots/course-detail-1440x900.png) | [`course-detail-390x844.png`](screenshots/course-detail-390x844.png) |
| Live video playing | — | [`course-detail-video-playing-1440x900.png`](screenshots/course-detail-video-playing-1440x900.png) | — |
| Growth | [`growth-1280x900.png`](screenshots/growth-1280x900.png) | [`growth-1440x900.png`](screenshots/growth-1440x900.png) | [`growth-390x844.png`](screenshots/growth-390x844.png) |
| Runner | [`runner-1280x900.png`](screenshots/runner-1280x900.png) | [`runner-1440x900.png`](screenshots/runner-1440x900.png) | [`runner-390x844.png`](screenshots/runner-390x844.png) |
| Unanswered confirmation / result | — | [`runner-unanswered-confirm-1440x900.png`](screenshots/runner-unanswered-confirm-1440x900.png), [`runner-result-1440x900.png`](screenshots/runner-result-1440x900.png) | — |
| Practice routes | — | [`course-practice-prepare-1440x900.png`](screenshots/course-practice-prepare-1440x900.png), [`practice-detail-1440x900.png`](screenshots/practice-detail-1440x900.png) | — |

Visual observations: no 390px page had horizontal overflow. Course Detail measured an 8px horizontal overflow at 1280px (`bodyWidth=1288`); all other tested desktop widths were within the viewport. Runner at 390px had `documentHeight=922` for an 844px viewport and the document-bottom scroll probe did not reach its threshold, although the question and submit controls are visible in the screenshot. Owner should review these two layout measurements. No CSS, colors, or page structure were changed in this task.

## Offline verification on exact T108 BASE

These checks were replayed in the T109 worktree with source at the exact T108 BASE. They describe the baseline and do not claim the existing debt is green.

| Check | Result |
| --- | --- |
| Frontend suite | `PASS`, 70/70 |
| Course-focused suite | `PASS`, 34/34 |
| Media/player suite | `PASS`, 22/22 |
| T099 blank-submit suite | `PASS`, 10/10 |
| API suite without database URLs | `PASS`, 1,072 passed / 64 database-gated skipped / 0 failed |
| API source typecheck, frontend package typecheck, API build | `PASS` |
| ESLint | `BASELINE_DEBT`, 2,649 errors / 1 warning |
| Format check | `BASELINE_DEBT`, 745 warning paths / 12 parser errors |
| API test-project TypeScript probe | `BASELINE_DEBT`, 234 diagnostics |
| `git diff --check` | `PASS`; no product-source diff |

The failed earlier Browser attempts were harness iteration, not T109 product failures: one run expected the submit button before selecting the last question; another exercised retry against already server-completed progress. The final run reset only the T109 video progress, navigated to question 20, and used a finite-duration guard. Attempt 17 is explicitly supplemental because its duration diagnostic was non-finite; the final acceptance verdict is from attempt 19.

## Handoff and containment

After verification, all five T109 service containers were stopped, all 20 stopped T109 Browser containers were removed, and the internal network plus PostgreSQL/MinIO volumes were preserved; [`runtime-cleanup.json`](runtime-cleanup.json) records this. No T106, AutoAim, shared UAT, `main`, protected T005, or other task-owned data was modified. The final task commit is pushed on the independent output branch; this work is not merged or deployed. The task remains `READY_TO_MERGE=NO` pending Owner review of the screenshots, the 1280px overflow, the 390px Runner scroll probe, and the microphone-limited preparation route.
