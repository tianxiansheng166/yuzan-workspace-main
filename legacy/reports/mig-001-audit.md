# MIG-001 Legacy Asset Audit

## Allowed Paths

- `legacy/exports/**`
- `legacy/review/**`
- `legacy/reports/**`
- `tools/migration/**`

## Input Validation

- branch: `task/mig-001-migration`
- expected HEAD: `7cace5434ab8fb7187783fb2ecc88d94c862601b`
- actual HEAD: `32982b9fdb722ccfc34e2ce558ca431ce8320ef0`
- legacy source root: `legacy/source-tree/two-legacy`
- legacy tree sha256: `9b6dffaec4bc6f03ac1ab1e14217a422c563a10b6b9856909c7aa5067b9a79c2`

## Primary Disposition

- scanned file count: 113
- policy: exactly-one-per-file
- `REUSE`: 6
- `REWRITE`: 42
- `DISCARD`: 32
- `REVIEW`: 33
- total: 113

## Legacy Category Detail

- `REUSE_AS_IS`: 0
- `REUSE_AFTER_REVIEW`: 6
- `REWRITE_FROM_INTENT`: 42
- `VISUAL_REFERENCE_ONLY`: 17
- `DISCARD`: 32
- `PRIVACY_BLOCKED`: 5
- `COPYRIGHT_BLOCKED`: 9
- `UNKNOWN_REQUIRES_REVIEW`: 2

## Risk Tags

- policy: overlapping-tags-allowed
- `binaryAsset`: 31
- `containsPii`: 33
- `copyrightUnverified`: 29
- `externalDependency`: 34
- `sourceUnknown`: 23
- `obsoleteDemo`: 29
- `fakeData`: 21
- `runtimeCoupled`: 37
- privacy risk count: 33
- copyright pending count: 29

## Read-only and Boundary Proof

- legacy file count: 113
- legacy tree sha256 before: `9b6dffaec4bc6f03ac1ab1e14217a422c563a10b6b9856909c7aa5067b9a79c2`
- legacy tree sha256 after: `9b6dffaec4bc6f03ac1ab1e14217a422c563a10b6b9856909c7aa5067b9a79c2`
- tree hash unchanged within run: yes
- symlink count: 0
- legacy symlink escape detected: no
- outside-root read detected: no
- outside-root write detected: no
- output realpath boundary verified: yes
- output symlink escape detected: no
- dry-run writes: 0

## Repeatability

- status: stable
- conclusion: Existing generated files already match current input state; rerun produces no content change.

## PII and Copyright

- Generated outputs are scanned with phone/email/ID/known-literal rules and are required to produce zero matches.
- output leak scan matches: 0
- Source PII is retained only as file-level counts and match digests in the report output.
- Media exports contain metadata only; no legacy binaries are copied.

## Curriculum and Translation Scope

- curriculum source doc: `docs/resources/“语赞心声”分级课程体系总览.docx`
- curriculum source sha256: `ef6f77a62b6fbbcad32892f0d44b9c4972f50cb6667974bdc67d1c6aa8d2273e`
- curriculum records exported: 10
- safe translation entries exported: 797
- translation course coverage rows: 10

## Page Flow Intent

- [mig001_b9565913e8f8] `admin-dashboard.html` -> Page flow, IA, copy, and role journey intent
- [mig001_ea65f0c19829] `admin-student-management.html` -> Page flow, IA, copy, and role journey intent
- [mig001_07ff6a7cbd44] `course-center.html` -> Page flow, IA, copy, and role journey intent
- [mig001_f6013a00b362] `index.html` -> Page flow, IA, copy, and role journey intent
- [mig001_fd37308ebe3c] `learning-tasks.html` -> Page flow, IA, copy, and role journey intent
- [mig001_6edc82242bd1] `platform-internal.html` -> Page flow, IA, copy, and role journey intent
- [mig001_bac465da5bad] `student-dashboard.html` -> Page flow, IA, copy, and role journey intent
- [mig001_50945f57b93b] `student-management.html` -> Page flow, IA, copy, and role journey intent
- [mig001_b3a1c2928494] `student-profile.html` -> Page flow, IA, copy, and role journey intent
- [mig001_50a4a939d1c7] `teacher-dashboard.html` -> Page flow, IA, copy, and role journey intent
- [mig001_bd2353e75943] `video-player.html` -> Page flow, IA, copy, and role journey intent

## External Asset Domains

- `cdn.jsdelivr.net`: 23 references
- `cdn.tailwindcss.com`: 15 references
- `fonts.googleapis.com`: 16 references
- `fonts.gstatic.com`: 8 references
- `p11-doubao-search-sign.byteimg.com`: 10 references
- `p26-doubao-search-sign.byteimg.com`: 16 references
- `p3-doubao-search-sign.byteimg.com`: 2 references
- `p3-flow-imagex-sign.byteimg.com`: 3 references
- `platform.deepseek.com`: 1 references

## Manual Review Traceability

- [mig001_14bdcc3d622c] `.audit-course-desktop.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_8e40dfd5d267] `.audit-course-mobile.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_54d293743318] `.audit-home-desktop.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_791d0a1e550a] `.audit-home-mobile.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_b90986791171] `.codex/ui_audit_chrome/admin-dashboard.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_5a8e42feb5f0] `.codex/ui_audit_chrome/admin-student-management.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_dfcd6096f3f5] `.codex/ui_audit_chrome/course-center.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_eddc7312fec8] `.codex/ui_audit_chrome/index.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_25e438a87aca] `.codex/ui_audit_chrome/learning-tasks.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_e944cfb8b67c] `.codex/ui_audit_chrome/platform-internal.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_192c3b4219a9] `.codex/ui_audit_chrome/premium-purchase.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_6c526c098d69] `.codex/ui_audit_chrome/pricing.png` -> REVIEW (VISUAL_REFERENCE_ONLY)

## Absolute Path Scan

- contains absolute machine path: no

## Known Limitations

- Rights and provenance still require human confirmation for blocked media and brand assets.
- Safe translation export intentionally excludes risky literals, so downstream migration must merge approved entries only.
- Course DOCX is represented by structure hints and source metadata, not copied body text.
