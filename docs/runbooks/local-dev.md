# Local Development Runbook

## Quick Start

```bash
# 1. Clone and enter the repo
cd /path/to/moongate-sponsor-marketplace

# 2. Start infrastructure
make up
# Or: docker compose up -d

# 3. Install dependencies
pnpm install

# 4. Copy env file
cp .env.example .env
# Edit .env — minimum required: AUTH_SECRET (any 32+ char string)

# 5. Generate Prisma client + run migrations + seed
pnpm --filter @moongate/db db:generate
pnpm --filter @moongate/db db:migrate:dev -- --name init
pnpm --filter @moongate/db db:seed

# 6. Start development servers
pnpm dev
# API: http://localhost:3001
# Web: http://localhost:3000
```

## Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Web App | http://localhost:3000 | — |
| API | http://localhost:3001 | — |
| Postgres | localhost:5432 | moongate / moongate |
| Redis | localhost:6379 | — |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| Mailpit | http://localhost:8025 | — |
| Prisma Studio | http://localhost:5555 | `make db-studio` |

## Demo Credentials

After seeding:
- **Tenant slug:** `ethglobal`
- **Event slug:** `ethmilan-2025`
- **Public page:** http://localhost:3000/ethglobal/ethmilan-2025
- **Sponsor packages:** http://localhost:3000/ethglobal/ethmilan-2025/sponsor
- **Organizer login:** http://localhost:3000/auth/login
  - Email: `admin@ethglobal.com`
  - Use magic link (check Mailpit or console log for link)

## Useful Commands

```bash
# View all running services
docker compose ps

# Reset database and re-seed
pnpm --filter @moongate/db db:reset

# Open Prisma Studio (visual DB browser)
make db-studio

# Run just the API in watch mode
pnpm --filter @moongate/api dev

# Run just the web in watch mode
pnpm --filter @moongate/web dev

# Check TypeScript across all packages
pnpm typecheck

# Run tests
pnpm test
```

## AI Extraction in Dev

By default `AI_PROVIDER=mock` — no API key needed.

To use real Anthropic:
1. Set `AI_PROVIDER=anthropic` in `.env`
2. Set `ANTHROPIC_API_KEY=sk-ant-...`
3. Upload a real sponsorship PDF in the admin

The mock provider returns realistic ETHMilan-shaped suggestions.

## Common Issues

**Prisma can't connect:**
- Check `docker compose ps` — postgres must be healthy
- Check `DATABASE_URL` in `.env`

**Auth token invalid:**
- Check `AUTH_SECRET` is set in `.env` (min 32 chars)
- Clear `localStorage.moongate_token` in browser

**MinIO bucket not found:**
- Log into MinIO console (localhost:9001)
- Create bucket named `moongate-dev`
- Set bucket policy to public read
