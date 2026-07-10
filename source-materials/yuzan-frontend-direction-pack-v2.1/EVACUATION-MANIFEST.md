# VM1 Evacuation: Design Pack Local Differences

Date: 2026-07-11
Branch: evacuation/vm1/design-pack-local-diff-20260711
Base: main (9708cf36d45d17f1bf42db5ce34134c2cd551de6)

## Context

The VM1 main workspace contained an untracked copy of the design pack
`source-materials/yuzan-frontend-direction-pack-v2.1/`. SHA256 comparison
against `origin/task/frontend-directive-v2-1` (e9359c4) revealed 11 files
that differ from the remote version.

This branch preserves those 11 differing local versions so they are not
lost during the VM1 evacuation.

## Differing Files (11)

1. 00-READ-FIRST.md
2. CHANGELOG-v2.1.md
3. PROJECT-COMPATIBILITY-REPORT.md
4. README-USE-IN-PROJECT.md
5. SHA256SUMS.txt
6. machine/current-repo-contract.json
7. machine/route-matrix.csv
8. package-manifest.json
9. project-adapter/02-two-machine-runbook.md
10. project-adapter/asset-register-import.csv
11. scripts/install-design-pack.sh

## Status

INTEGRATION_ELIGIBLE=no
REQUIRES_REVIEW=yes

These files are local modifications that have not been reviewed or approved.
They must not be merged into main or integration without review.
