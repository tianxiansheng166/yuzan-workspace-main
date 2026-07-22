# yuzan-next

Production-oriented rebuild of 语赞心声.

## Prerequisites

| Tool       | Required Version  | Notes                           |
| ---------- | ----------------- | ------------------------------- |
| Node.js    | >=24 <27          | From package.json engines       |
| pnpm       | >=10              | Use corepack or install via npm |
| Docker     | Docker Compose v2 | Required for PostgreSQL/MinIO   |
| PostgreSQL | 17-alpine         | Via docker-compose.yml          |
| MinIO      | latest            | Via docker-compose.yml          |

### Version Verification

```bash
# Check Node.js version (must satisfy >=24 <27)
node --version

# Check pnpm version
pnpm --version

# Check Docker Compose
docker compose version
```

**Important:** This project requires Node.js 24+. If your system's default Node version is different, use a version manager:

- **nvm (Linux/macOS):** `source ~/.nvm/nvm.sh && nvm use 24`
- **fnm (Windows):** `fnm use 24`

## Platform-Specific Setup

### Linux

```bash
# Install Node.js via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 24
nvm use 24

# Enable corepack for pnpm
corepack enable
corepack prepare pnpm@10.13.1 --activate

# Install Docker (if not installed)
# Ubuntu/Debian:
sudo apt update && sudo apt install docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Log out and back in for group changes

# Project setup
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d minio redis
pnpm db:generate
pnpm db:migrate
pnpm dev
```

### macOS

```bash
# Install Node.js via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 24
nvm use 24

# Enable corepack for pnpm
corepack enable
corepack prepare pnpm@10.13.1 --activate

# Install Docker Desktop if not installed
# Download from: https://www.docker.com/products/docker-desktop

# Project setup
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d minio redis
pnpm db:generate
pnpm db:migrate
pnpm dev
```

### Windows (PowerShell)

```powershell
# Install Node.js via fnm (recommended for Windows)
winget install Schniz.fnm
fnm install 24
fnm use 24

# Enable corepack for pnpm
corepack enable
corepack prepare pnpm@10.13.1 --activate

# Install Docker Desktop if not installed
# Download from: https://www.docker.com/products/docker-desktop

# Project setup
pnpm install
Copy-Item .env.example .env
docker compose up -d minio redis
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Environment Configuration

Copy `.env.example` to `.env` and configure:

| Variable         | Description            | Example                                                       |
| ---------------- | ---------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection  | `postgresql://yuzan:yuzan_dev_only@127.0.0.1:55432/yuzan_dev` |
| `SESSION_SECRET` | Session encryption key | Generate 32+ random bytes                                     |
| `S3_ENDPOINT`    | MinIO endpoint         | `http://127.0.0.1:59000`                                      |
| `S3_ACCESS_KEY`  | MinIO access key       | `minio`                                                       |
| `S3_SECRET_KEY`  | MinIO secret key       | Set your own password                                         |

**Important:** Never commit `.env` or real secrets to the repository.

## Development Commands

```bash
# Install dependencies (use frozen lockfile for reproducible builds)
pnpm install --frozen-lockfile

# Start infrastructure
docker compose up -d minio redis

# Database setup
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run migrations (development)
pnpm db:validate    # Validate schema

# Development server
pnpm dev            # Start all apps (web, api, worker)

# Quality checks
pnpm format:check   # Prettier format check
pnpm lint           # ESLint + contract lint
pnpm typecheck      # TypeScript check
pnpm test           # Unit tests
pnpm build          # Production build

# Full check
pnpm check          # Runs all quality checks sequentially
```

## Services

| Service        | Port  | URL                          |
| -------------- | ----- | ---------------------------- |
| Frontend       | 4175  | http://127.0.0.1:4175        |
| API (NestJS)   | 4000  | http://localhost:4000/api/v1 |
| MinIO Console  | 59001 | http://localhost:59001       |
| PostgreSQL     | 55432 | localhost:55432              |
| Redis          | 6380  | localhost:6380               |
| Flowise        | 4300  | http://127.0.0.1:4300        |
| Speech scoring | 8100  | http://127.0.0.1:8100        |

## Troubleshooting

### Port Already in Use

If ports 55432, 59000, or 6380 are already allocated:

```bash
# Check what's using the port
docker ps -a

# Option 1: Use existing containers from main workspace
# The .env points to the project-specific local ports above

# Option 2: Stop conflicting containers
docker stop <container_name>

# Option 3: Modify docker-compose.yml to use different ports
# Then update .env accordingly
```

### Node Version Mismatch

```bash
# Using nvm
nvm use 24

# Using fnm
fnm use 24
```

### pnpm Not Found

```bash
# Enable corepack (Node.js built-in package manager)
corepack enable
corepack prepare pnpm@10.13.1 --activate
```

### Prisma Generate Fails

```bash
# Ensure database container is running
docker start yuzan-four-port-postgres-55432

# Regenerate client
pnpm db:generate
```

## Project Structure

```
yuzan-next/
├── frontend/         # Current backend-connected static frontend
├── backend/
│   ├── api/          # NestJS API
│   ├── worker/       # Background worker
│   └── speech-scoring/ # Python speech scoring service
├── packages/
│   ├── contracts/    # OpenAPI schema & generated types
│   ├── domain/       # Domain logic
├── infra/
│   └── database/     # Prisma schema & migrations
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Frontend source of truth

`frontend/` is the only active frontend for the current product closure. The old
Nuxt tree is stored outside the repository in `../legacy-archive` and does not
participate in pnpm, CI or source discovery. A future framework migration is a
separate architecture task and must not recreate a second active frontend.

## Dependency ownership

Run `pnpm install` only from the repository root. pnpm stores physical packages
once in the root virtual store/global content-addressed store; the `node_modules`
entries inside backend/shared packages are generated links. Each package keeps
its own `package.json` so undeclared dependencies cannot leak between services.

This scaffold is a foundation for the project. All commands listed have been verified to exist in package.json.
