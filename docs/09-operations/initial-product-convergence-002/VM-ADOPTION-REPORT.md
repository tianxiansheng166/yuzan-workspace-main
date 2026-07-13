# VM adoption report

## Package verification

- VM A ZIP: `340A3725A6DDBB7DAED2DAD36B1C68FABA5B7A12A2DCFFD730CA5C3DDD10F2FF`; 10 manifest-owned files checked, 0 mismatches.
- VM B ZIP: `A41D294F89F96D2B0FF461EBF34BBFBEA92411E4CC40F7B4AB2BEAF620F85A42`; 91 manifest files checked, 0 mismatches.
- Evidence: external recovery inventory `inventory/vm-inspect/manifest-verification.json`; no ZIP, server, package-lock, QA cache or screenshot was copied into Nuxt.

## Route rulings

### `/admin` — PORT / LIVE_BIND / TRUTHFUL_GAP
VM A supplies terrain composition and explicit persistence state. Nuxt calls `GET /admin/schools`; `PERSISTENCE_PENDING` is rendered as the product state. VM statistics and local actions are rejected.

### `/volunteer` — PORT / LIVE_BIND
VM A supplies the service-desk hierarchy. Nuxt reads current-school volunteers, training and support pairings. VM names, avatars, counts, courses and task data are rejected.

### `/teacher-tools` — REBUILD_PART / LIVE_BIND
The current Nuxt route and VM A were compared. VM A's stronger header/status hierarchy is ported; current standalone demo/provider assumptions are replaced by integrations, MindGraph, click-audit, translation and glossary calls.

### `/plans` — PORT / LIVE_BIND / REJECT_DEMO
VM B supplies the mountain-led public composition. Nuxt reads `GET /plans`; its real empty list is first-class. VM prices, discounts, consultation success and trial success are rejected.

### `/research` — PORT / LIVE_BIND / TRUTHFUL_GAP
VM B supplies the research-path composition only. Nuxt calls governance versions and renders `PERSISTENCE_PENDING`. VM topics, teacher names, percentages, reviews, publish actions and local success mutations are rejected.

### `/teacher` — KEEP / PORT_INTERACTION_ONLY / LIVE_BIND
Current Nuxt plus CP2 live gateway wins. VM common baseline does not replace the current teacher workbench; only its emphasis on a primary teaching path influenced composition. No VM data or asset was adopted here.

### `/student/courses` — SELECTIVE_CHERRY_PICK / PORT_VISUAL_ONLY / LIVE_BIND
The existing frontend integration page is the code source, adapted to the real course-version API. VM common baseline was compared but its course images, enrollment claims and progress data were rejected.

## Assets

Five image assets were selectively copied to `apps/web/public/art/initial-product-002/` and registered in `ASSET-REGISTER.md`. They are decorative bands/terrain, never full-page screenshot backgrounds.