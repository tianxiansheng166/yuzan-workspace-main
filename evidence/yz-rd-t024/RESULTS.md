# YZ-RD-T024 results

**Status: DONE / WEB_ONLY / READY_TO_MERGE.** The T024 branch is pushed and remains separate from `feat/question-bank-v1`; it has not been merged into the shared T005 worktree.

Task source was the published Notion YZ-RD-T024 card and its lane blueprint; the V5.9 history plus current V5.10 T024 rules were read before changes. The dedicated worktree is `/home/tian/code/yuzan-workspace-t024`.

## Git integration

- T019 accepted source: `feat/yz-rd-t019-web-rolling-integrated@1ebc1923d44dcf238f3441552b7eda946b6c0b44`.
- T020 accepted source: `feat/yz-rd-t020-teacher-home-action-center@e6b8e8aa0b2f8cfe9a3bed894f264c73f64e1f3c`.
- T018 accepted source already in T020: `73bb949b22f38b66f92edaa741aa042e504d2d7f`.
- Merge base: `0596a9b8256c1d674b93eb2afd4de7306c768129` (T014 final).
- T019 changes from the merge base: 201 files. T020 changes: 45 files. Actual path intersection: 0.
- Merge commit: `ce709b4539ae0502e4f1a7de216a8d7ba66adb0f`, created with `git merge --no-ff`; parents are the exact T019 and T020 source SHAs. Git used the `ort` strategy with no conflicts. T018 and T014 were not replayed or cherry-picked.
- The source checkouts of T019 and T020 remained at their accepted SHAs and clean. T021/T022/T023 commits are not ancestors of T024. Final branch and remote SHA equality was verified; the exact final push SHA is returned in the task result.

```text
*   T024 merge ce709b4
|\
| * e6b8e8a T020 (contains T018 73bb949 and T014 history)
* | 1ebc192 T019 (contains T014/T015/T016/T017 and T010–T013 through T015)
|/
* 0596a9b merge base (T014 final)
```

T024-only integration changes after the merge are the native runner and evidence, test-harness adaptations for T024 database/runtime names and the current Review navigation, removal of a synthetic T014 score/report fixture, and the 390px teacher-home action reflow described below. T019/T020 product source and the sibling task worktrees were not modified.

## Native environment

- Runtime: Node 24.20.0, pnpm 10.13.1, PostgreSQL 17.11, Redis 7.4.10, MinIO `RELEASE.2025-10-15T17-29-55Z`, Chrome 153.0.8010.52, shared Playwright 1.64.0.
- Isolated PostgreSQL database/role: `yuzan_t024_native` / `yz_t024`.
- Isolated MinIO bucket: `yz-t024-native`.
- T024 ports: API 4134, Web 4334, PostgreSQL 55674, Redis 6474, MinIO 59274/59275.
- The new PostgreSQL cluster and empty database received all 32 existing migrations once. Bootstrap seed created fictional identities and reusable practices only; no completed attempts, scores, or reports. The read-only Question Bank source import validated 120/120 items and 126 media files (90 images, 36 audio), then created the corresponding rows/objects in this database and bucket. The repeat verification reused all 120 items and 126 objects.
- Worker stayed stopped, `SPEECH_PROVIDER=disabled`, and every browser recording is marked `SIMULATED_MIC`. No physical microphone, automated speech scoring, school pilot, or production launch is claimed.
- Native stack smoke passed MinIO upload, read-back and signed GET (38 bytes). Question Bank and recording tests performed MinIO HeadObject/read-back checks; object keys, bytes and content types are in the E2E JSON proofs.

## Cross-role E2E

Final command: `python3 tests/e2e/assessment/run_yz_rd_t024_native.py`.

**PASS — 9 passed, 0 failed, 0 skipped (214.39s)** on one T024 database, API, Web, Redis and MinIO instance. Full log: [`browser-logs/cross-role-native-playwright.log`](browser-logs/cross-role-native-playwright.log). Runtime summary: [`native-runtime-summary.json`](native-runtime-summary.json).

### Teacher home, Assignment and separate review queue

The Chromium click log follows the real teacher homepage actions through an Assignment, class, student enrollment, Submission and Review Item. IDs came from authenticated responses and were verified against PostgreSQL:

- Assignment `4381e4bc-4ba3-4227-85f6-7488272da94e` — `OPEN`.
- Submission `3f3685ec-8bb4-4a77-9479-95a96d2bdef0` — `NEEDS_REVIEW` and still present after the separate Review Item was scored.
- Review Item `1ec7cdec-0750-4e4d-aa25-2a6ecf5ee974` — score 2, reviewer `961d16fe-d837-48fa-a615-bd16e140b64a`, revision 2, `REVIEWED`.
- The server returned six Assessment Review Items before scoring and five afterward. PostgreSQL shows those six rows as three `PENDING`, two `ANSWERED`, and one `REVIEWED`; the teaching Submission pending count remained 1. The Review Item save did not decrement the Submission count. Assignment and Submission IDs are separate in click/API logs and SQL.
- Cross-school identity switch cleared the old teacher data, including when an earlier teacher response arrived late. Queue retry, partial request failure, and keyboard focus were exercised.

See [`t020/click-log.json`](t020/click-log.json), [`t020/api-responses.json`](t020/api-responses.json), [`t020/proof.json`](t020/proof.json), and the corresponding queries in [`sql/dynamic-flow-id-parity.txt`](sql/dynamic-flow-id-parity.txt).

### Teacher-directed OPEN course task for A/B, not C

- Assignment `6ed5f8fb-f0c9-4ad7-a230-434b064e38c0` is `OPEN`.
- Only enrollments A `d94748d0-604b-4036-9317-9a6dc52efff4` and B `dfe17d2e-3dec-474e-ac7a-6c2b465eebb9` have target rows. C `1f8ea5da-a8d0-44e8-8415-ab03e0243d84` has zero target rows.
- A/B Submissions `b48ba538-3480-43da-8828-892bae711869` and `a5fe8dc0-44fb-44a3-b8ec-ce9f5fe67dcd` are associated with that Assignment. The browser opened the actual course activity, saved completed ActivityProgress for A/B, and recovered it after refresh. A MinIO-backed Recording `f99ca718-7eb4-4906-8c94-f2a206626e97` played successfully.
- The T014 test setup now uses a PROCESSING AssessmentSession and does not seed a score or AssessmentReport. Three score-83 rows from earlier T024 test iterations were captured, then removed from this isolated test database; final SQL count for that exact `TEST_FIXTURE_ONLY T014 正式测评` fixture is 0. See [`sql/t014-synthetic-report-retirement.txt`](sql/t014-synthetic-report-retirement.txt).

### 20-item practice, recording, human review, report and Growth

- T012 Attempt `6cc0deeb-3d61-4098-aba7-953433d4e70a` has 20 items and remains `PROCESSING`: four recording-bound items, four SpeechJobs, zero scored speech items, and zero AssessmentReports. The browser played six audios, recorded four `SIMULATED_MIC` files, retried uploads, dismissed confirmation with cancel and Escape, then submitted once. A/B isolation, 401/403/404, expired signature, network retry and duplicate-submit idempotency were checked.
- T018 AssessmentSession `fb48fca4-1d86-4934-97c6-90d3f163609a` started in `PROCESSING` with no report. The teacher opened actual audio/image evidence, retried an image load, and completed six dynamic Review Item IDs. Empty and all-space scores produced no save request or database score; explicitly entered 0 saved as numeric zero at revision 2. Network failure retained the input, identical retry was idempotent, changed duplicate returned 409, and the next item was selected from a fresh server queue. The server generated report `c0787b4e-958a-4f3c-8dda-404d0b104e5c` only after the final review; it contains all 20 scored rows and a data-derived score of 57 for this fixture. The student saw all six teacher comments; student B received 403 for the report/history. Four recording objects were read from MinIO.
- T011 full Student A flow Attempt `434c876b-ac80-4fa6-b3b5-c62d7f0842be` played six audios, uploaded four recordings, dismissed the dialog twice and issued one submit. It stayed `PROCESSING` with no report before review. The teacher saved all six necessary reviews; report `773d3f1e-c9f8-47fd-9908-d73eb1902eb0` was generated by the server after the final save. The returned score was derived from saved item rows (55 in this run), not hard-coded. After re-login, History opened the report and Growth showed the same score and six saved teacher comments. Student B was denied access.

The T018/T011 Review Item IDs, PostgreSQL rows, report IDs, feedback, Recording IDs, MinIO byte lengths and API negative statuses are in [`t018/proof.json`](t018/proof.json) and [`t011/proof.json`](t011/proof.json). Cross-entity dynamic ID-to-SQL evidence is in [`sql/dynamic-flow-id-parity.txt`](sql/dynamic-flow-id-parity.txt).

### Course center, identity and failures

T017 Chromium/API/PostgreSQL coverage passed server-side course filters, sort, cursor pagination, progress, favorite `PUT`/`DELETE` idempotency and failure handling. T016 verified the “我的成长” navigation opens `/student/growth/`, keyboard/focus behavior, identity replacement and reduced motion. T013 exercised Today/Growth processing versus completed states and 401/403/404 isolation. T020 exercised independent task and Assessment Review failures and re-reads.

## Responsive and visual evidence

- Native checks cover 390, 768, 1280 and 1440 pixels with no horizontal overflow on the tested Teacher Home, Review, course catalog/detail, Today and Growth routes.
- Visual inspection found that the 390px Teacher Home primary action could sit over a long greeting. T024 changed its mobile layout to flow below the greeting and added a Chromium bounding-box assertion. The rerun passed; screenshot: [`t020/teacher-home-390.png`](t020/teacher-home-390.png). The original highland background and student course artwork remain.
- Review queue/detail screenshots at all four widths: [`t018/`](t018/). Teacher Home desktop/mobile, error/identity switch and clicked destinations: [`t020/`](t020/). Course center screenshots: [`t017/`](t017/). Growth with the generated report and feedback: [`t011/growth-reviewed-390.png`](t011/growth-reviewed-390.png) and desktop screenshots in the same directory. Total T024 screenshots: 88.
- Keyboard focus and reduced-motion checks passed. Review controls remain reachable; Home and course views retain their existing visual assets and icon system.

## Automated checks

| Check | Result |
|---|---|
| Frontend full suite (includes Teacher Home model and Review validation) | PASS, 67; 0 skipped |
| API full suite | PASS, 1,101; 64 environment-gated skips (1,165 total) |
| Contracts/OpenAPI tests | PASS, 6; 0 skipped |
| Contracts generation, typecheck and OpenAPI lint | PASS |
| Prisma client generation, database build and schema validation | PASS |
| API typecheck/build | PASS |
| Frontend typecheck/build/runtime verification | PASS |
| Python E2E syntax and `git diff --check` | PASS |
| Final native cross-role suite | PASS, 9; 0 failed; 0 skipped |

Logs are under [`test-results/`](test-results/). The host `pnpm` command is 11.x; every T024 package operation used the project-pinned pnpm 10.13.1 through Corepack/task-local resolution. No global toolchain was changed.

Earlier harness attempts found a missing generated Prisma package, outdated T011 selectors/queue assumptions, a T017 runtime-path guard, and a synthetic T014 report fixture. These were corrected in T024; the final full suite and final SQL checks have no unresolved failures. The final E2E has nine passes, zero skips.

## Isolation, branch and next work

- T024 runtime files remain under ignored `runtime-local/native-web-t024/`; config mode is 0600. Final summary reports `runtimeStopped=true`. PostgreSQL PID 685042 was stopped through the T024 owner-aware helper. API/Web/Redis/MinIO service records were identity-checked and cleared after exit; ports 4134, 4334, 55674, 6474, 59274 and 59275 are free. Database, bucket objects and evidence remain retained.
- T005 shared worktree stayed on `feat/question-bank-v1` with the same 20 pre-existing bilingual/untracked changes observed before T024. The source directory was only read as Question Bank import input; root `.env` was not read or changed, and nothing from T005 was staged.
- T019 and T020 source checkouts remain clean at their accepted SHAs. T021/T022/T023 source was not edited by T024. T022 advanced to its own clean commit `e456eac9b02a5abb4851525685cc5bd130d9af91`; its owner evidence records its own service stop. T023 advanced to its own clean commit `34af873837c9cfb74a7be33e94617b94668b4f4d`; its evidence records its own service stop. T024 sent no signal to T021/T022/T023 processes.
- No Docker/Compose/P1-SIM was used. L4 remains OPEN and its historical volume was not accessed.
- State: T024 is READY_TO_MERGE only. It is not merged into `feat/question-bank-v1`. T005 bilingual course changes still need a future three-way review; T021 profile, T022 player and T023 invitation work remain their own branches. Physical microphone, calibrated automatic scoring and pilot/production gates are NOT_RUN.
