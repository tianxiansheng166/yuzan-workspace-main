# Contract Change Request: GOV-ROOT-002

- Status: accepted by repository owner request
- Owner: Integration Lead
- Scope: frontend source of truth, backend paths, pnpm workspace and CI

## Decision

For the current product-closure phase, the static backend-connected runtime is
the only active frontend. It moves from the former `web-runtime/` path to
`frontend/`.
The former Nuxt `apps/apps-web` tree is archived under
`../legacy-archive/root-cleanup-20260722/apps-web` and must not
participate in source discovery, dependency installation, tests or CI.

Backend services move to explicit names:

- former `apps/api` -> `backend/api`
- former `apps/worker` -> `backend/worker`
- former `services/speech-scoring` -> `backend/speech-scoring`

Package manifests remain per workspace package because they declare dependency
ownership. pnpm continues to share physical package content through the root
virtual store and global content-addressed store; package-level `node_modules`
entries are link farms, not independent installs.

## Asset boundary

Runtime-referenced assets remain in `frontend`. Design `reference/` and `qa/`
evidence may be moved to the external legacy archive only after proving active
HTML/CSS/JS does not reference those paths.

## Rollback

Restore archived Nuxt/evidence from
`../legacy-archive/root-cleanup-20260722`, restore old paths with Git, restore
the previous workspace/root scripts, and run the Node 24 frozen install.
