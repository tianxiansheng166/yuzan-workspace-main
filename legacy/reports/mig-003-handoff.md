# MIG-003 Media Asset Inventory Handoff

- Task: MIG-003
- Tool: mig-003-media-inventory-v1
- Asset count: 107

## Kind counts

- image: 24
- unknown: 76
- video: 1
- document: 6

## Dispositions

- REVIEW: 97
- MIGRATE: 9
- DUPLICATE: 1

## Rights status

- RESTRICTED: 16
- UNKNOWN: 82
- APPROVED: 9

## Determinism

- run1: dc2e3bdbed00bfe5fd5d3b78ca0bbd886032f996150c9e9ef5f65abd772523e7
- run2: dc2e3bdbed00bfe5fd5d3b78ca0bbd886032f996150c9e9ef5f65abd772523e7
- run3: dc2e3bdbed00bfe5fd5d3b78ca0bbd886032f996150c9e9ef5f65abd772523e7
- deterministic: yes
- dry-run: yes
- source unchanged: yes

## Source provenance

- canonical manifest algorithm: v2
- V2 canonical source hash: f1f64500308c0ba3bfdf505323f3daebe6a6e1f49a04190cb285263de36ac0c8
- V1 full canonical hash: 4e2ca83b9af8d0753fa307fd119a57708da4dfdb857b06a0283ccc7acc96df38
- V1 minus artifact hash: f1f64500308c0ba3bfdf505323f3daebe6a6e1f49a04190cb285263de36ac0c8
- V1 minus artifact equals V2: yes
- legacy raw source change: one audit-generated screenshot added
- business source content changed: no
- audit artifact migration disposition: excluded

## Notes

- All binary media remains in the controlled read-only source; only metadata was committed.
- Rights status is evidence-based; no legal conclusion is made.
- UNKNOWN rights and missing accessibility metadata are queued for manual review.
- One audit-generated screenshot was excluded from the migration asset inventory by supply-stage filtering; the tool itself does not broadly exclude `.audit-` files.
