# Stacked provisional branch policy

## Purpose

Allow parallel development while keeping `main` and shared `integration/*`
branches stable.

## Definitions

- **Task branch**: `task/<task-id>-<short-description>-<owner>`. Owned by one
  developer.
- **Provisional branch**: a short-lived integration branch used to stack
  multiple task branches before they are ready for the main integration branch.
- **Integration branch**: `integration/<context>` — shared target for a feature
  group.

## Rules

1. Task branches are created from the current integration commit or from `main`
   if no integration applies.
2. A provisional branch may be created from an integration branch to collect
   two or more task branches for early cross-cutting review.
3. Provisional branches must not replace the integration branch or be treated
   as release branches.
4. Force push is prohibited on shared integration branches.
5. Rebasing or squashing a task branch is allowed before opening the final PR,
   but must be coordinated with reviewers.
6. When a task branch is merged into integration, the provisional branch should
   be deleted unless it contains additional unmerged tasks.
7. Provisional branches must not contain secrets, real student data, or
   committed build artifacts.

## Pull request rules

- PR title must reference the task ID.
- PR description must fill in the required sections from
  `.github/pull_request_template.md`.
- PRs modifying `packages/contracts/**`, `infra/database/**`, `pnpm-lock.yaml`
  or `.github/workflows/**` require explicit CODEOWNERS review.
- Stacked provisional PRs must be marked as such in the template.

## Cleanup

- Delete merged provisional branches within 7 days.
- Delete merged task branches immediately after merge unless a follow-up task is
  pending.
