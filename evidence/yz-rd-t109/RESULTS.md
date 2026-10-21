# YZ-RD-T109 — Sep 8 native student acceptance

## Final task status

- `TASK_ID=YZ-RD-T109`
- `STATUS=NEEDS_OWNER_DECISION`
- `BLOCKER=BLOCKED_RESOURCE_DRIFT`
- `BASE_SHA=8974c2a7d5842bb20dbfcd091b63cac5674dcc32`
- `SOURCE_BRANCH=feat/yz-rd-t108-sep08-recovery-quality-integration`
- `OUTPUT_BRANCH=test/yz-rd-t109-sep08-integrated-native-uat`
- `WORKTREE=/home/tian/.devspace/worktrees/yuzan-workspace-t109`
- `RUNTIME_PROJECT=yz-rd-t109`
- `READY_TO_MERGE=NO`; no shared merge or deployment was performed.
- `HISTORICAL_L4_INCIDENT_OPEN=YES`; no L4 material was read, imported, or opened.

The initial host admission passed, then the active Docker set changed during the staged T109 startup. A non-T109 `aa-int-t107-build:opencv` container appeared without Compose owner labels or a hard memory/swap limit; it disappeared and reappeared under a new ID. Because the non-T109 worst-case RAM total could not be bounded, I stopped the T109 services and did not launch the browser, student account, course data, or native E2E. The external container and the T106 stack were not changed.

The blocker details and latest host snapshot are in [`resource-blocker.json`](resource-blocker.json). The earlier pre-start admission and subsequent invalidation are recorded in [`resource-admission.json`](resource-admission.json).

## Source and worktree

- The T108 remote source branch was read-only verified at the required BASE before creating T109.
- A new worktree and branch were created at the exact BASE. No product source was changed.
- The only tracked paths added by this task are `evidence/yz-rd-t109/**` and this factual handoff update.
- T109 Compose configuration is outside the repository at `/home/tian/.devspace/runtime/yz-rd-t109/compose.yaml`; its environment files are mode `0600` and contain T109-only values.
- Final delivery SHA and remote comparison are reported in the Codex return rather than copied into this report.

## Resource admission and containment

The first live admission snapshot at `2026-10-21T18:10:26Z` showed 16 CPUs, `MemAvailable=14.93 GiB`, `SwapFree=6.68 GiB`, load `1.60 / 1.98 / 3.59`, I/O PSI `some 1.39% / 2.81% / 2.00%` and `full 1.34% / 2.63% / 1.82%` (10/60/300 second averages), and 77 GiB disk free. T106's five exact IDs still had finite Docker HostConfig and cgroup CPU/RAM/swap/PID limits, matching T107, zero OOM events/restarts, and live readiness results of HTTP 200 or healthy.

At that admission point, the five T109 Compose services were capped at `3.25 CPU / 2.375 GiB RAM / 768 PIDs`; the separate Playwright container was planned at `0.75 CPU / 1.094 GiB RAM / 256 PIDs`, with no T109 swap allowance. Including the transient T028 cap seen during preflight as a contingency, the projected sum was `10.5 CPU / 10.469 GiB RAM / 2,112 PIDs`, leaving about `5.5 CPU` and `4.47 GiB` against the then-current host memory availability. The final Compose config has an internal-only network and no host-published ports.

The later unbounded external container invalidated that calculation. Its `HostConfig.Memory=0`, `MemorySwap=0`, and `PidsLimit=null`; the live cgroup showed `memory.max=max` and `memory.swap.max=max`. It used about 2.36 GiB at the latest blocker snapshot. Its Compose project and service labels were absent. Earlier transient non-T109 containers also appeared and disappeared between reads. I did not inspect their application data, logs, environment, databases, or volumes.

Four of the five T109 application services were started and their Docker limits matched cgroup CPU/RAM/swap/PID limits. T109 PostgreSQL and Redis were healthy; MinIO readiness returned HTTP 200 inside the T109 network; API readiness returned HTTP 200 after the empty T109 bucket was initialized. The frontend and bounded browser were not started, so `EFFECTIVE_CPU_MEM_PIDS_5_OF_5=NOT_VERIFIED`.

The four T109 containers were stopped after the external resource drift. The PostgreSQL and MinIO volumes and private T109 network remain. No `down -v`, prune, or action on another project was used. The API exited with code 137 during the explicit stop; Docker reports `OOMKilled=false` and restart count 0.

The resource table and observed four-container cgroup values are in [`effective-resources.json`](effective-resources.json). The final media source record is [`media-license.json`](media-license.json), and the image digests are in [`image-receipt.json`](image-receipt.json).

## T109-only database and storage preparation

- Compose project: `yz-rd-t109`.
- Network: `yz-rd-t109-isolated` (`internal=true`).
- PostgreSQL volume: `yz-rd-t109-postgres-data`.
- MinIO volume: `yz-rd-t109-minio-data`.
- MinIO bucket: `yz-rd-t109-media`.
- The configured host-port mappings were not active on Docker's internal network. I removed host publication and recreated only the three new T109 infrastructure containers; the T109 volumes were preserved.
- All 32 repository migrations were applied to the new T109 database. The first bounded Alpine migration attempt exited before applying changes because its Prisma CLI lacked the musl schema engine. The matching host Prisma engine then applied all 32 migrations through the T109 private bridge address only. Details are in [`migration-results.json`](migration-results.json).
- The empty bucket was created and verified with `HeadBucket`; no media object was uploaded. [`bucket-init.json`](bucket-init.json) records the result.
- The licensed CC0 clip was downloaded into T109 runtime storage and hashed. It was not uploaded because resource admission blocked Native E2E.
- No student registration, course/assignment rows, assessment attempts, recordings, progress rows, or browser storage objects were created.
- The task-only synthetic course/question bootstrap script is present for review, but it was not run: [`bootstrap_t109.mjs`](bootstrap_t109.mjs). The student-registration and browser scripts were also not run.

## Native acceptance results

| Acceptance item | Result | Reason |
| --- | --- | --- |
| Real student login | `NOT_RUN` | No T109 student account was registered because resource admission was blocked. |
| Today / Courses / Course Detail / Growth / Runner screenshots | `NOT_RUN` | No bounded browser was started. No screenshots were captured. |
| Dynamic assignment/activity navigation | `NOT_RUN` | Browser journey was not started. |
| Signed MinIO playback, HTTP 206, decoded frames | `NOT_RUN` | The licensed clip was not uploaded to T109 MinIO. |
| Progress save, restore, activity isolation, ended completion | `NOT_RUN` | Browser/API acceptance was stopped at the resource blocker. |
| Course recommendations and practice entry | `NOT_RUN` | Browser journey was not started. |
| T099 blank submit, `UNANSWERED=0`, completed report | `NOT_RUN` | No test account or practice attempt was created. |
| Independent PostgreSQL | `PARTIAL` | Fresh T109 volume and 32 migrations verified; no application rows seeded. |
| Independent MinIO and licensed media | `PARTIAL` | Fresh T109 volume and empty bucket verified; object upload/read and playback not run. |
| Historical T106 native E2E evidence | `NOT_USED` | It proves T106 only and is not projected to T109. |

`OWNER_SCREENSHOT_PATHS=NONE`. The scripts for the planned authenticated run remain in `evidence/yz-rd-t109/`; they do not supply a fixture page or synthetic success.

## Offline verification on exact T108 source

All commands below ran in the new T109 worktree before adding the evidence files, with `HEAD=8974c2a7d5842bb20dbfcd091b63cac5674dcc32`.

| Check | Result |
| --- | --- |
| Frozen offline pnpm install | `PASS`; 783 packages reused, no downloads. |
| Prisma client generation and database package build | `PASS`. |
| Frontend suite and runtime verifier | `PASS`, 70/70. |
| Course-focused frontend suite | `PASS`, 34/34. |
| Player state and media suite | `PASS`, 22/22. |
| T099 partial/all-empty submit suite | `PASS`, 10/10. |
| API suite with database URLs unset | `PASS`, 1,072 passed / 64 database-gated skipped / 0 failed. The 64 skips are not passes. |
| API source typecheck | `PASS`. |
| Frontend package typecheck script | `PASS` (its script is Node syntax checks). |
| API build | `PASS`, `nest build`. |
| API ESLint | `BASELINE_DEBT`, 2,649 errors / 1 warning, matching T108. Not green. |
| Repository format check | `BASELINE_DEBT`, 745 warning paths / 12 unchanged parser-error files, matching T108. Not green. |
| API test-project TypeScript probe | `BASELINE_DEBT`, 234 diagnostics, matching T108. Not green. |
| `git diff --check` | `PASS`; no product-source diff. |

These offline checks do not substitute for Browser/API/PostgreSQL/Redis/MinIO acceptance.

## Cross-owner and security notes

- T106 container IDs, configuration, data, volumes, and services were not changed. No T106 database or MinIO bucket was contacted for application data.
- An earlier resolved-Compose inspection accidentally included a T106 Redis test credential in tool output. It was not saved or reused; the T106 owner was notified to rotate it. No T106 service was modified.
- A failed Docker Hub TLS pull printed a temporary signed CDN layer URL in tool output. It was not reused or copied into evidence; that image was not downloaded.
- No credentials, cookies, tokens, personal data, protected question-bank content, recordings, or L4 material are in the evidence branch.
- `NO_SHARED_MERGE_OR_DEPLOY=YES`; `READY_TO_MERGE=NO`.
