# MIG-001 Manual Review

## Primary Disposition Traceability

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
- [mig001_73170dc9183b] `.codex/ui_audit_chrome/professional-purchase.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_6f6e378653cc] `.codex/ui_audit_chrome/student-dashboard.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_7324171639ae] `.codex/ui_audit_chrome/student-profile.png` -> REVIEW (VISUAL_REFERENCE_ONLY)
- [mig001_1370a4c32fff] `.codex/ui_audit_chrome/teacher-dashboard.png` -> REVIEW (VISUAL_REFERENCE_ONLY)

## PII-sensitive Sources

- [mig001_b9565913e8f8] `admin-dashboard.html` -> knownLiteral
- [mig001_ea65f0c19829] `admin-student-management.html` -> email
- [mig001_07ff6a7cbd44] `course-center.html` -> email, knownLiteral
- [mig001_cf368ba33f3f] `db/analytics.json` -> knownLiteral
- [mig001_000f15eec484] `db/applications.json` -> structure-blocked
- [mig001_9f7eac9cecb9] `db/assessments.json` -> structure-blocked
- [mig001_4bcaeb9d12e6] `db/lang/bo.json` -> knownLiteral
- [mig001_fcc9dfae2237] `db/lang/zh.json` -> knownLiteral
- [mig001_a932e679ba94] `db/learning-records.json` -> structure-blocked
- [mig001_4392c1eb542a] `db/progress.json` -> structure-blocked

## Rights / Provenance Review

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

## Outstanding Questions

- Confirm whether the curriculum DOCX is the approved master version for staged conversion.
- Confirm ownership and authorization status for logo, hero art, course covers, subtitles, uploaded assets, and signed external image sources.
- Confirm whether AI-related legacy intents remain in scope as future backlog only, not MVP implementation.
- Confirm whether all pricing, charity, and volunteer flows remain deferred and should stay blocked from migration.
