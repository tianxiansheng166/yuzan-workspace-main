# VM1 Ubuntu Evacuation Report

**Date:** 2026-07-11
**Task:** UBUNTU_VM1_FULL_EVACUATION_001
**Repository:** git@github.com:tianxiansheng166/yuzan-workspace-main.git
**Operator:** VM1-Trae-1

---

## 1. Remote & Authentication

| Field | Value |
|-------|-------|
| origin fetch URL | git@github.com:tianxiansheng166/yuzan-workspace-main.git |
| origin push URL | git@github.com:tianxiansheng166/yuzan-workspace-main.git |
| SSH | SUCCESS (tianxiansheng166 authenticated) |
| fetch | SUCCESS |
| origin matches target | YES |

## 2. Worktree Inventory

| Metric | Count |
|--------|-------|
| Total worktrees | 38 |
| Clean worktrees | 36 |
| Dirty worktrees (originally) | 2 |
| Dirty worktrees preserved | 2 |
| Detached worktrees | 6 |
| Detached commits preserved | 6 (all already in remote) |

### Dirty Worktrees

1. **Main workspace** (`yuzan-next`, branch: `main`)
   - Untracked: `source-materials/yuzan-frontend-direction-pack-v2.1/` (107 files)
   - 96 files identical to remote, 11 files differ
   - Differing files saved to evacuation branch
   - Main workspace NOT clean (untracked design pack remains per rules)

2. **frontend-manual-image-workspace-001** (branch: `task/frontend-manual-image-workspace-001`)
   - Untracked: `source-materials/yuzan-frontend-direction-pack-v2.1/manual-image-generation.zip` (104 KB)
   - Zip saved to evacuation branch

### Detached Worktrees (all clean, all HEADs in remote)

| Worktree | HEAD | In Remote |
|----------|------|-----------|
| preview-577a744 | 577a7442 | YES |
| review-acc-root-001-01d2440 | 01d24402 | YES |
| review-mig-001-32982b9 | 32982b9f | YES |
| review-mig-001-adf54e3-dynamic | adf54e3e | YES |
| review-sph-001-privacy-20260710 | 149fc3d6 | YES |
| verify-integration-577a744-vm1 | 577a7442 | YES |

## 3. Branch Summary

| Metric | Count |
|--------|-------|
| Branches pushed normally (upstream set) | 7 (upstream tracking added) |
| Branches already in sync with remote | 31 |
| Branches behind remote (local HEAD is ancestor) | 2 (gov-002-contract, idn-001-identity-api) |
| Evacuation branches created | 3 |
| Branches still not remote | 0 |
| Local-only commits | 0 |

### Evacuation Branches Created

| Branch | Commit | Purpose |
|--------|--------|---------|
| `evacuation/vm1/design-pack-local-diff-20260711` | `017b36ada0ca3d8e56c477aaaed2b1240476a0c3` | 11 design pack files differing from remote |
| `evacuation/vm1/manual-image-workspace-zip-20260711` | `e2f6be47f0e45cecda5dcb541f8f213c348b8438` | Untracked manual-image-generation.zip archive |
| `task/frontend-generated-assets-intake-001` | `f86961d2cb4e2db7cb243d175eb2b8e54ad17a74` | 18 unique generated images (RAW_INTAKE) |

### Branches with Upstream Tracking Added

| Branch | Upstream | Local = Remote |
|--------|----------|----------------|
| task/acc-idn-001-prisma | origin/task/acc-idn-001-prisma | YES |
| task/acc-root-001-api-wiring | origin/task/acc-root-001-api-wiring | YES |
| task/acc-ui-001-app-shell | origin/task/acc-ui-001-app-shell | YES |
| task/acc-web-001-auth-api | origin/task/acc-web-001-auth-api | YES |
| task/frontend-directive-v2-1 | origin/task/frontend-directive-v2-1 | YES |
| task/frontend-manual-image-workspace-001 | origin/task/frontend-manual-image-workspace-001 | YES |
| task/lrn-001-learning-api | origin/task/lrn-001-learning-api | YES |

## 4. Stash Summary

| Metric | Count |
|--------|-------|
| Stash count | 0 |
| Stashes preserved to remote | 0 |
| Stashes requiring manual recovery | 0 |

## 5. Design Pack

| Field | Value |
|-------|-------|
| Design directive remote | origin/task/frontend-directive-v2-1 |
| Design directive HEAD | e9359c4964c34c7fbcfc3954c5306aad44ca367f |
| Expected HEAD match | YES |
| Remote contains design pack | YES (107 files) |
| Untracked design pack copy in main | YES (107 files) |
| Files identical to remote | 96 |
| Files differing from remote | 11 |
| Differing files saved to branch | evacuation/vm1/design-pack-local-diff-20260711 |
| Untracked duplicate handled | YES (differences preserved, backup copied to recovery) |
| Main worktree clean | NO (untracked design pack remains per non-identical rules) |

## 6. Generated Images

| Metric | Value |
|--------|-------|
| Total images found | 277 |
| Unique images (by SHA256) | 60 |
| Already tracked on remote | 42 |
| Images needing intake | 18 |
| Intake total size | 30,792,965 bytes (29.4 MB) |
| Sensitive suspects | 0 |
| Images blocked for security | 0 |
| Images blocked for size | 0 |
| Generated image intake branch | task/frontend-generated-assets-intake-001 |
| Generated image intake commit | f86961d2cb4e2db7cb243d175eb2b8e54ad17a74 |
| Generated images remote safe | YES |
| Intake worktree clean | YES |

## 7. Git Bundle

| Field | Value |
|--------|-------|
| Bundle path | recovery/windows-evacuation-vm1-20260711/yuzan-all-refs-vm1.bundle |
| Bundle size | 36 MB |
| Bundle SHA256 | 8b38921565364f552813acc08bb72444fcd4e32bc8ba4cc2b2180226c34d9ed8 |
| Bundle verified | YES |
| Bundle pushed to GitHub | NO (local backup only) |

## 8. VM1 Handoff Branch

| Field | Value |
|--------|-------|
| Branch | evacuation/vm1-handoff-20260711 |
| Base | origin/integration/core-framework-20260710 (577a7442) |
| Commit | (to be filled after commit) |

## 9. Security Verification

| Check | Result |
|-------|--------|
| Secrets pushed | NO |
| Database dumps pushed | NO |
| .env files pushed | NO |
| SSH keys pushed | NO |
| Tokens pushed | NO |
| main modified | NO |
| force push | NO |
| amend | NO |
| rebase | NO |
| reset --hard | NO |
| git clean | NO |
| Stash dropped | NO |
| Dirty worktree deleted | NO |
| Unreviewed code merged to integration | NO |

## 10. Remaining Blockers

| Blocker | Status |
|---------|--------|
| LOCAL_ONLY_COMMITS | 0 |
| UNPUSHED_SAFE_BRANCHES | 0 |
| UNPRESERVED_DIRTY_WORKTREES | 0 |
| UNPRESERVED_STASHES | 0 |
| GENERATED_IMAGES_REMOTE_SAFE | YES |
| Main worktree untracked design pack | Expected per non-identical rules (differences preserved on evacuation branch) |

## 11. Conclusion

VM1 is safe to power off. All valuable code, tests, documentation, design packs, generated images, and branches have been preserved to GitHub. No secrets, database dumps, or sensitive materials were pushed. Main was not modified. No force push, amend, rebase, or destructive operations were performed.
