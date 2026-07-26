# PRODUCT-WEB-PRD-001 Handoff

## Status

`READY_FOR_REVIEW`

## Branch and baseline

- Branch: `task/product-web-prd-001`
- Base: `d681abb717041b22682792e22979108ea296f91e`
- PRD content commit: `04bc931`
- Merge target: `integration/p0-multitrack-001`
- Main/integration merge: not performed by this task

## User outcome

Delivered one strategic Web PRD that can be read by investors/funders, partner schools, product, teaching research and engineering. It separates:

- project-side historical/business claims that still require diligence;
- current repository and task evidence;
- target product requirements and priorities;
- the 18-month staged roadmap, pilot gates and open decisions.

No business code, OpenAPI, Prisma, dependencies or runtime configuration changed.

## Primary artifact

`docs/10-project-review/02-语赞心声Web产品PRD（投资与产品版）.md`

Document facts:

- 1461 lines;
- 44311 characters;
- 16/16 required major sections;
- 95 functional requirement IDs plus 10 blocking decision IDs;
- investor, school and engineering reading paths;
- current execution/evidence/integration status split;
- Stage 0 first-school freeze template, resource gate and decision register;
- funding/diligence template with no invented amount.

## Main product decisions captured

1. The product core is the real learning evidence loop:

   `course/practice → recording and answer evidence → machine processing → teacher review → report → intervention → retest`.

2. Student self-practice, course practice, assignment and future stage assessment reuse one practice engine and differ through delivery policy.
3. AI lesson plans remain teacher-reviewed drafts; translation must be revised/approved before bilingual course consumption.
4. Source courses remain available when translation providers or approved translations are unavailable.
5. P0 weak-network support includes local draft/outbox, idempotent sync, recovery and unsynced telemetry; full content packages and long-offline conflict handling are later scale enhancements.
6. Historical engineering task IDs named P0 are not automatically the PRD's pilot-required product P0.
7. Business plan coverage, outcome, media and financial figures remain project-side claims until the diligence/reconciliation table is closed.

## Current baseline recorded in the PRD

- AI tool contracts: `INTEGRATED`, commit `1d0cd1bb0898ad47a6f9faebba42d3d18b84260d`.
- Student independent practice: `INTEGRATED`, commit `45fefdf361f7df4d0026c31b3e1d338f537acb47`.
- Course-linked practice: `VERIFIED / NOT_INTEGRATED`, commit `ca14c57f0534e4e8ddf3e273128668b6c12e685e`.
- Whole-course submit: `IN_PROGRESS / EVIDENCE_REPAIR / NOT_INTEGRATED`, remote head `4f86b0f319907b29c073dd9438b0459fb3b85c43`.
- Teacher AI lesson planning: branch `READY_FOR_REVIEW`, evidence `PARTIAL`, remote head `6d1d70e426ec35e079535011daff62780fe07031`.
- Tibetan translation: `BLOCKED / PARTIAL / NOT_INTEGRATED`, remote head `e8f2d8c5c0049a320fe45c7bd2e9e499ccd722cc`.

These are snapshot facts, not production-readiness claims.

## Fresh-reader test

A reader with no prior project context reviewed the PRD as:

1. an education/public-interest investor;
2. a partner-school leader;
3. a product/engineering owner.

The first pass found five P0 gaps: unnamed decision ownership, weak-network sequencing, no first-school freeze sheet, insufficient engineering evidence pointers and no investment-request framework.

The PRD was revised to add:

- role-specific reading paths;
- separate execution/evidence/integration enums and exact commit pointers;
- a replay procedure;
- P0 weak-network work before pilot;
- a first-school freeze table with NO-GO semantics;
- stage responsibility and resource templates;
- a funding/request table with DRI, due date and data-room index;
- a metric dictionary;
- risk owners and response deadlines;
- `DEC-01..DEC-10` with Day 0, named-DRI fields and close evidence.

The second reader pass concluded: **no P0; deliverable** as an internal review, pilot discussion and investment diligence entry point. It explicitly remains not a formal investment decision or pilot launch document.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Task JSON parse | PASS | PowerShell UTF-8 `ConvertFrom-Json` |
| Required sections | PASS | 16/16 headings |
| Markdown parse | PASS | Pandoc GFM parse, exit 0 |
| Requirement/decision IDs | PASS | 105 numbered IDs, no duplicates |
| Code fences | PASS | 30 fences, balanced |
| Git whitespace | PASS | `git diff --check` |
| Fresh-reader regression | PASS | no remaining P0 |
| Task gate review | PASS | recorded after running the repository gate |

Gate note: the first review attempt exposed a Windows Git `core.quotePath` issue for the Chinese PRD filename. The real file was inside `allowed_paths`. Review was rerun successfully with process-scoped `core.quotePath=false`; no global or repository Git config was changed. The resolved incident is logged as `ERR-20260725-001`.

## Known open items

- `DEC-01..DEC-10` are intentionally `OPEN`; named people, absolute dates, school, content, provider, legal approvals and budget must be supplied by the project.
- Investment amount, runway and cash scenarios are `TBD`; the PRD does not invent them.
- Business-plan metrics remain unverified and may not be used externally until reconciled.
- Technical status can drift after 2026-07-25; reviewers must refresh remote heads and accepted baselines before a later decision.
- This is not legal advice, a formal financial forecast, a term sheet or proof of learning causality.

## Reviewer entry

1. Read the role-specific path at the beginning of the PRD.
2. Confirm the current status matrix against `project-ops/accepted-baselines.json` and `project-ops/MULTITRACK-BOARD.md`.
3. Review whether the project accepts the proposed product P0 and first-school Stage 0 gate.
4. Assign named DRI/approvers and an absolute Day 0 before any pilot start.
5. Run the task's `minimal_tests` and repository review gate.

## Rollback

Revert this task branch's commits after the base. No database, contract, dependency or runtime rollback is required.
