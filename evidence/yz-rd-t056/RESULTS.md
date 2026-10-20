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
- `FINAL_SHA=reported in the task return; omitted here to avoid a self-referential commit hash`
- `LEVEL1_SOURCE_MANIFEST=NOT_AVAILABLE`: no manifest file exists in the inspected source tree. Level 1 media has a `水平一级/` directory, but the importer uses a shared root-level question DOCX, answer DOCX, and media ZIP. No level-isolated question/answer source package was found.
- `L4_SOURCE_READ=T056:NO; historical T053:YES`: T056 did not open any raw source file. The accepted T053 preflight read the shared inputs before filtering and reported 120 parsed items, then selected 20 Level 1 items.
- `L4_IMPORT_APPLIED=T056:NO; historical T053:NO`: T053 reports only the 20-item Level 1 selection was applied; no Level 4 record was applied.
- `L4_RUNTIME_OPENED=T056:NO; historical T053:NO`: T053 reports no Level 4 activity/session was opened in the browser.
- `MIXED_SOURCE_OWNER_DECISION=REQUIRED`: see the source-boundary finding below.
- `T005_HASH_PARITY=NOT_RECHECKED_IN_T056`: T056 did not hash or modify protected source files. T053's accepted report states its source hashes were unchanged, but this T056 audit did not independently reproduce the hashes.
- `TEST_RESULTS=NOT_RUN`: no source-level tests or importer runs were safe after identifying the mixed inputs. Static read-order evidence is recorded below.
- `READY_TO_MERGE=NO`: no implementation was made; this branch records the stop condition and evidence only.
- `HISTORICAL_L4_INCIDENT_OPEN=YES`: T053 read the shared source before selection. Owner disposition remains pending; the incident is distinct from an L4 import or runtime open, both of which T053 reports did not occur.

## Read-only source inventory

The T053 accepted preflight names `/home/tian/code/yuzan-workspace-main/习题课程资源` as its source directory. Read-only directory inspection found these importer inputs at the root:

| Input | Observed size | Boundary finding |
|---|---:|---|
| `题库【三改】.docx` | 3,200,067 bytes | One shared source file; T053 preflight reported 120 parsed items before selecting Level 1. |
| `答案及评分细则.docx` | 27,918 bytes | One shared source file; the importer reads the entire document before selection. |
| `题库音频及图片.zip` | 128,497,084 bytes | One shared archive; T053 preflight reported 126 media files (90 images, 36 audio). |

The directory also has per-level extracted media paths, including `水平一级/` and `水平四级/`. The importer does not use those paths: its source directory mapping points to the shared DOCX and ZIP files above. No manifest-like file name was present in the inspected source tree. No raw document or archive content was opened during T056.

## Importer read-order audit

At [`tools/question-bank-importer/index.mjs`](../../tools/question-bank-importer/index.mjs):

1. `readDocx()` opens `word/document.xml` and its relationship file in the DOCX before it can identify question levels (lines 86–111).
2. `inventory()` lists the media archive, opens every non-directory entry, and hashes each entry before applying the level label inferred from its path (lines 841–854).
3. `run()` starts both DOCX reads and full media inventory together, parses all questions and answers, binds media, and validates all levels; only then does it call `selectLevels()` (lines 983–999).
4. The apply script passes `--level` into that same `run()` only after constructing paths to the shared files ([`question-bank-apply.ts`](../../backend/api/src/scripts/question-bank-apply.ts), lines 132–152). Its preflight therefore does not establish a read boundary.

This matches T053's accepted report: `Parsed items: 120` followed by `Selected: 20`. The current design cannot establish a pre-open Level 1 allowlist from the available manifest or path names. Reading a DOCX/ZIP to discover internal per-level content would cross the boundary that this task is meant to enforce.

## Owner decision required

Please provide an owner-approved Level 1-isolated source package and manifest that identify separate Level 1 question, answer, and media inputs before any source file is opened. The manifest should identify the exact permitted paths and owner-provided hashes. Once those exist, the importer can reject every non-allowlisted file before opening it, and T056 can add and run the positive Level 1 and negative Level 4 regression proofs.

Until that decision, T056 intentionally made no importer changes, did not run an import, did not compute hashes of the mixed inputs, and did not modify T005 source files or course resources.

## Policy note

The target checkout's `AGENTS.md` lacks the `AA-DEV-V2.2` marker. The task card supplied no separate Lane policy reference. This mismatch is recorded; the user-provided `/home/tian/code/AGENTS.md` and the task-specific source boundary rules governed this offline audit.
