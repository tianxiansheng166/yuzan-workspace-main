# yuzan-next

Production-oriented rebuild of 语赞心声.

## Prerequisites

- Node.js 24 LTS or a currently supported compatible LTS
- Corepack + pnpm
- Docker / Docker Compose

## Start

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d postgres minio
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open:

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1
- MinIO console: http://localhost:9001

## Quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
python ../orchestration/scripts/validate_task_files.py
```

This scaffold must be validated on the actual development machine during GOV-001. It is intentionally a foundation, not a claim that the full product is implemented.
