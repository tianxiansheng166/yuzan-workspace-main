# CURRENT TASK

Task: QB-011 — Retry and remediation practice loop
Status: TODO

## Goal

Use the completed QB-010 diagnosis snapshot to guide a student from safe retry
candidates into targeted remediation practice, without changing formal results
or exposing answers, rubrics, or provider evidence.

## Starting point

- QB-010 is complete: completed 20-item Question Bank sessions persist and
  return the deterministic `qb-diagnosis-v1` snapshot.
- The report currently links to Practice Center with the highest-priority family
  label only; it does not create or filter a remediation practice.
- QB-009B remains `PARKED / EXTERNAL_INPUT`. Do not call speech providers or
  start calibration work.

## Constraints

- Keep server-side school, resource, and student scope checks.
- Reuse the immutable Question Bank metadata and formal diagnosis snapshot;
  never use provider candidate points as formal authority.
- Do not modify or stage `pnpm-workspace.yaml`,
  `infra/database/prisma/seed.ts`,
  `tests/e2e/assessment/question-bank-runner.spec.py`, or
  `frontend/assessment/assets/question-bank/`. Never modify original files
  under `local_sources/`.
