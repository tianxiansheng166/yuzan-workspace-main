# YZ-RD-T008 execution receipt

Date: 2026-10-18
Status: DONE / browser, API, and database verified
Base: `ee77c899aa36effc3b661f7ce5bde48dbdb574dc`

## User-visible result

- Today opens the existing student practice catalog. The catalog and detail page use the current student's real PracticeDelivery and Attempt state.
- Existing attempts route by server state: `CREATED` to the unified Runner, `IN_PROGRESS` back to the Runner, `SUBMITTED` / `PROCESSING` / `FAILED` to processing status, and completed attempts to their result. The catalog no longer presents a pending submission as a new practice.
- History combines the current student's real session statuses with completed reports and published teacher feedback. Pending states do not show scores. History is not persisted in shared local storage between student accounts.
- The Attempt report/history shortcut now sits below the fixed student navigation bar and is clickable.

## Canonical route map

`/student/today/` → `/student/practices/` → `/student/practices/:practiceDefinitionId/` → `/student/practices/attempts/:attemptId/runner/` → `/student/practices/attempts/:attemptId/processing/` → `/student/practices/history/`

## Browser/API/database proof

- Student A's Attempt: `9f5a8eaf-039c-4266-990a-59cd55598570`, enrollment `f1111111-1111-4111-8111-111111111111`, final server status `PROCESSING`.
- Student B's independent Attempt: `3b3a6c22-c422-4564-9b85-7e003e054c85`, enrollment `8a88cb5a-8776-43f5-9a42-00825dbfd5b3`, server status `IN_PROGRESS`.
- The browser completed the real 20-item Question Bank attempt through the unified Runner: 6 source audio clips played and 4 browser-simulated microphone recordings uploaded and bound. The history row kept the same Attempt ID, showed `处理中`, offered the real processing link, and did not show a score before a report existed.
- A double click on Runner submit produced one browser POST. A repeated API submit returned the same Attempt ID; no second Attempt was created.
- Returning to the catalog linked A to the existing processing Attempt. The isolated DB count increased by exactly one A Attempt; revisiting the catalog did not create another.
- A and B each saw their own history row and not the other's. Real negative API checks returned 401 for anonymous practice access, 403 for cross-enrollment history, and 404 for an unknown Attempt; B's request for A's Attempt was denied (403/404).
- A browser-injected network interruption rendered the history error state; retry reloaded A's Attempt. History had no horizontal overflow at 1280px or 1440px.
- Runtime: Compose project `yz-rd-t008-20261018`, DB `yzrdt008_student_history`, ports DB 55448 / Redis 6392 / MinIO 59028–59029 / API 4018 / Web 4178. It used fictional accounts and the read-only source files under `习题课程资源/`; the import parsed 120 items and 126 media files. Runtime containers and volumes were removed after the proof.
- No speech worker or production scoring provider was started. The browser recordings were simulated microphone input; the proof ends in `PROCESSING` and makes no formal-score claim.

## Checks

- `pnpm --filter @yuzan/frontend test`: 24 passed.
- `pnpm --filter @yuzan/frontend lint`: passed.
- Isolated PostgreSQL migration, seed, API build, and Question Bank import: passed.
- `tests/e2e/assessment/test_yz_rd_t008_student_history.py`: 1 passed in 31.83s.
- `git diff --check`, Python syntax check, and JavaScript syntax checks: passed.

## Boundaries

- No backend DTO, OpenAPI, generated contract, shared API client, Prisma, teacher, T005 Course/Bilingual, `CURRENT_HANDOFF.md`, or `docs/11-product-delivery/05` file was changed.
- The T005 dirty main checkout and its protected resource files were left untouched. T008 work is isolated on `feat/yz-rd-t008-student-practice-history`.
- No unresolved backend contract is required; the implementation uses the existing session, practice Attempt, history, and history-events endpoints.

## Cleanup incident

During a manual cleanup after an early runtime failure, I ran `docker compose down --volumes` without re-exporting the T008 `POSTGRES_VOLUME_NAME`. Compose removed the default volume `yuzan-four-port-postgres-55432`. The `p0-integration-postgres-1` container was not present at the time, but the volume contents had not been inspected before removal, so possible local database data loss cannot be ruled out. No recovery was attempted. Subsequent T008 runtime cleanup used the T008 project and explicit volume name; no T008 containers or volumes remain.
