# PRODUCT-INVESTMENT-DELIVERY-PLAN-001 Handoff

## Status

`READY_FOR_REVIEW`

## Branch and baseline

- Branch: `task/product-investment-delivery-plan-001`
- Base: `d09c4433339cc18018cacab1838818883578913c`
- Metadata commit: `e969539`
- Content commits: `1a19081`, `fd10a13`
- Merge target: `integration/p0-multitrack-001`

## User outcome

Delivered an eight-file product and execution package that turns the mentor feedback, 600-question checklist,
current integrated source and live runtime evidence into one actionable path toward:

- a truthful competition demo;
- a student mini-program plus teacher/admin Web plus shared service platform;
- one auditable teacher-to-student-to-teacher P0 loop;
- a first-school MVP with governance and compliance gates;
- investment diligence based on evidence rather than roadmap claims.

No business code, Prisma schema, OpenAPI, dependencies, runtime configuration or real data changed.

## Primary artifacts

- `docs/11-product-delivery/README.md`
- `docs/11-product-delivery/01-投资级产品定义与范围冻结.md`
- `docs/11-product-delivery/02-首校MVP标准PRD.md`
- `docs/11-product-delivery/03-业务架构对象模型与状态机.md`
- `docs/11-product-delivery/04-技术架构复用与端形态决策.md`
- `docs/11-product-delivery/05-开发路线任务图与验收门禁.md`
- `docs/11-product-delivery/06-600问分层决策与待办台账.md`
- `docs/11-product-delivery/07-投资尽调首校试点与团队协作.md`

## Main decisions proposed

1. Product form: student WeChat mini-program, teacher/admin Web, one shared API and service platform.
2. Only P0: teacher publishes one classical-Chinese reading/comprehension practice; student produces real
   recording and written evidence; processing remains truthful; teacher reviews; report/intervention/retest closes.
3. The current strategic PRD remains an upstream mother document, not a direct construction specification.
4. The 600 questions are tiered into competition, usable MVP, first-school, commercial and deferred horizons;
   only 30 current blocking decisions are promoted.
5. Current source is reused as a modular monolith plus worker and provider adapters; no premature microservices
   or separate mini-program backend.
6. Demo fallbacks, fake tokens, fixed business IDs and unverified metrics are P0 blockers.
7. DeepSeek is P1 for server-side, schema-validated, human-reviewed drafts; it is not a speech scoring engine.
8. The exposed chat credential must be revoked and was not used or stored.

## Current evidence recorded

- Canonical `main` and `origin/main` were both at the exact task base when the task started.
- Node 24 typecheck and build passed.
- Repository tests passed: API 937 passed / 55 skipped; worker 33 passed; contract, database and domain tests passed.
- Login page, API readiness and Flowise root were reachable.
- Speech scoring port 8100 was unavailable.
- Re-running the main launcher found an existing frontend listener only after partial setup, exposing a runtime
  ownership/idempotency gap.
- A 390px browser check had no script/console/request errors but visually showed overlapping login hero text.
- Current frontend source includes API-failure demo login fallback/fake tokens and fixed review navigation IDs.

These are snapshot facts, not production-readiness claims.

## Fresh-reader review

A manual context-independent review checked whether a new team member could locate clear answers to ten
questions without reading prior chat history:

1. What is the product?
2. What is the only P0?
3. Which endpoint form belongs to each role?
4. What is verified today and what remains blocked?
5. What is the very next engineering task?
6. What is explicitly out of scope?
7. How should the 600 questions be used?
8. What is DeepSeek allowed and not allowed to do?
9. What evidence makes a feature complete?
10. What must be true before an investment or first-school claim?

All ten answers are present in the README and linked specialist documents. Cross-document searches also found
the P0, next task, dynamic-ID rule, fake-login blocker, mini-program decision, DeepSeek boundary and pilot gate.
Relative Markdown links resolve and all eight files parse as GFM through Pandoc.

## Known open items

- Product Owner, technical owner, teaching/research owner and integration/release owner are not yet named.
- Competition date, demo duration, first content unit, target mini-program/H5 cutoff and devices are not frozen.
- First school, class, student count, schedule, consent, data policy, review SLA and commercial buyer remain open.
- Speech provider runtime and evaluation dataset remain unverified.
- Cross-role teacher assignment to student submission and back to teacher has no accepted browser/API/DB proof.
- The documents propose decisions; they do not fabricate project-side approval.

## Reviewer entry

1. Read `docs/11-product-delivery/README.md` and approve or amend the proposed product form and only P0.
2. Assign named owners and close the first ten decisions in the 600-question ledger.
3. Confirm the current source/runtime findings against the latest integration baseline.
4. Dispatch wave 0 tasks, then `P0-TEACHER-STUDENT-ASSIGNMENT-CLOSURE-001`.
5. Run the task JSON minimal tests and repository review gate.

## Rollback

Revert this task branch's documentation, task metadata, handoff and learning-log commits after the base. No
database, contract, dependency or runtime rollback is required.
