# YZ-RD-T056 Results

- **Task:** `YZ-RD-T056`
- **Status:** `NEEDS_OWNER_DECISION`
- **Base:** `bd49ce3dbc0259c862cdc15353a0ae417d016687`
- **Branch:** `feat/yz-rd-t056-l1-source-read-boundary-isolation`
- **Worktree:** `/home/tian/code/work/yuzan-workspace-t056`
- **Date:** 2026-10-20

## Return fields

- `TASK_ID=YZ-RD-T056`
- `STATUS=NEEDS_OWNER_DECISION`
- `FINAL_SHA=reported in task return; omitted here to avoid a self-referential commit hash`
- `LEVEL1_SOURCE_MANIFEST=NOT_AVAILABLE`: no owner-approved L1 package or manifest exists in the inspected source tree. The manifest schema and required invocation are now documented in [`SOURCE-MANIFEST.md`](../../tools/question-bank-importer/SOURCE-MANIFEST.md).
- `L4_SOURCE_READ=T056:NO for actual source files; historical T053:YES`: T053 parsed the shared 120-item source set before selecting 20 L1 items. T056's CLI negative run rejected the shared source directory before opening any source file.
- `L4_IMPORT_APPLIED=T056:NO; historical T053:NO`: T053 reports only the 20-item Level 1 selection was applied.
- `L4_RUNTIME_OPENED=T056:NO; historical T053:NO`: T053 reports no Level 4 activity/session was opened in the browser.
- `MIXED_SOURCE_OWNER_DECISION=REQUIRED`: provide an owner-approved, pre-screenable Level 1 package with separate question DOCX, answer DOCX, and media ZIP, plus a manifest and separately approved manifest SHA-256.
- `T005_HASH_PARITY=NOT_RECHECKED_IN_T056`: no T005 source or course resource was modified. T053's accepted report states its source hashes were unchanged; this task did not independently recalculate them.
- `TEST_RESULTS=PASS`: 24/24 question-bank tests; API build and typecheck; focused ESLint; Prettier check; shared-source CLI refusal. Full import of real Level 1 materials remains unverified pending the owner package.
- `READY_TO_MERGE=NO`: the real Level 1 positive import and T005 hash parity evidence remain outstanding.
- `HISTORICAL_L4_INCIDENT_OPEN=YES`: T053 read the shared source before selection. Owner disposition is pending; this is separate from L4 import/runtime status above.

## Read-only source inventory

The T053 accepted preflight names `/home/tian/code/yuzan-workspace-main/习题课程资源` as its source directory. T056 inspected path names and file metadata only; it did not open raw DOCX, ZIP, image, or audio content.

| Importer input        |     Observed size | Boundary finding                                                                               |
| --------------------- | ----------------: | ---------------------------------------------------------------------------------------------- |
| `题库【三改】.docx`   |   3,200,067 bytes | One shared question source; T053 preflight reported 120 parsed items before selecting Level 1. |
| `答案及评分细则.docx` |      27,918 bytes | One shared answer source; importer reads its full document before selection.                   |
| `题库音频及图片.zip`  | 128,497,084 bytes | One shared archive; T053 preflight reported 126 media files (90 images, 36 audio).             |

Extracted media folders include separate `水平一级/` and `水平四级/` paths, but the importer uses the shared root-level DOCX and ZIP inputs above. No manifest-like file name or isolated question/answer package was found. The existing shared question DOCX is not an acceptable L1 input.

## Read-order finding and T056 change

Before this change, `run()` opened both DOCX files and inventoried the full media archive before calling `selectLevels()`. T053's accepted preflight reported 120 parsed items before selecting 20 Level 1 items.

T056 now requires an explicit mode. The level-specific `run()` calls the boundary helper before `readDocx()` or `inventory()`. The helper verifies the external manifest SHA-256, validates the role/level/path/hash records, builds an exact allowlist for the requested level, opens only those allowlisted files, checks their hashes, and stages their bytes for parsing. Other-level paths are never resolved or opened. The API apply path uses those staged files and recorded hashes instead of reopening or rehashing the original sources. The generated `source-read-audit.json` records opened file level/hash and archive-entry level/hash. `selectLevels()` remains at line 1057, after parsing the owner-isolated input set.

The manifest shape is [`source-manifest.schema.json`](../../tools/question-bank-importer/source-manifest.schema.json); the implementation is [`source-read-boundary.mjs`](../../tools/question-bank-importer/source-read-boundary.mjs). A level-specific run without an explicit manifest fails closed. `--all` remains a distinct explicit whole-corpus mode and was not used by T056.

## Safe-negative and regression evidence

- [`l1-shared-source-negative.log`](l1-shared-source-negative.log): ran the built apply CLI against the existing shared source directory with `--level 1` and no owner manifest. It exited 1 with `an owner-approved source manifest is required before source files can be opened`.
- [`source-boundary-tests.log`](source-boundary-tests.log): 24 passed, 0 failed. New cases stage/hash L1-only files, include existing synthetic L4 sentinel files and assert the open callback sees only L1 paths, reject incomplete allowlists and invalid manifest digests before source opens, and require explicit importer mode.
- [`api-build.log`](api-build.log): API build passed.
- [`api-typecheck.log`](api-typecheck.log): API typecheck passed.
- [`focused-eslint.log`](focused-eslint.log): `question-bank-apply.ts` passed focused ESLint.
- [`format-check.log`](format-check.log): the new boundary helper, regression tests, manifest schema, and documentation passed Prettier. Existing importer/API files retain their repository formatting.

The synthetic L1 staging positive proves the allowlist/hash boundary works; it does not prove a full import of the real 20-item L1 material. That proof cannot run until the owner supplies a genuinely level-isolated question/answer/media package. No L4 real source was opened, and no T005 source or course resource was modified.

## Owner decision required

Please provide an owner-approved Level 1-isolated package and manifest with separate question, answer, and media files. Include the exact relative paths, each file's SHA-256, and the separately approved manifest SHA-256. Do not point the L1 manifest at the existing shared question or answer DOCX.

After that package is available, T056 still needs to run the actual L1 preflight/import proof, preserve its per-file read audit, verify T005 hash parity, and update the return fields before merge readiness can change.

## Policy note

The target checkout's `AGENTS.md` lacks the `AA-DEV-V2.2` marker. The task card supplied no separate Lane policy reference. This mismatch is recorded; the user-provided `/home/tian/code/AGENTS.md` and task-specific source boundary rules governed this offline work.
