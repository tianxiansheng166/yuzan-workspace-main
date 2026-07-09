# Branch protection baseline

This document describes the branch-protection settings that the repository
administrator must enable in the GitHub UI. The settings are **not** applied
automatically by this repository.

## `main`

- Require a pull request before merging.
- Require at least one approving review.
- Dismiss stale PR approvals when new commits are pushed.
- Require status checks to pass before merging:
  - `format`
  - `web`
  - Optionally `root-baseline` once GOV-002 is merged and made required.
- Include administrators (or exclude according to team policy, documented here).
- Do not allow bypassing the above settings.
- Restrict pushes that create files matching:
  - `packages/contracts/**`
  - `infra/database/**`
  - `pnpm-lock.yaml`
  - `.github/workflows/**`
- Allow force push: **No**.
- Allow deletions: **No**.

## `integration/*`

- Protect active integration branches (for example
  `integration/vm2-competition-mvp-v2`).
- Require PR for changes.
- Require the `web` status check.
- Allow force push: **No** for shared integration branches; allowed only for
  personal provisional branches.

## `task/*` and provisional branches

- Personal task branches do not need GitHub protection rules.
- See `project-ops/governance/stacked-provisional-policy.md` for stacked
  provisional workflow.
