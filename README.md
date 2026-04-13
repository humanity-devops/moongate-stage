# Moongate Sponsor Marketplace

A production-grade, multi-tenant sponsorship marketplace and sealed-bid auction platform for Web3 events.

## What It Does

Event organizers can:
- Create and manage events with custom branding
- Upload a sponsorship PDF deck and have AI suggest items for sale
- Review, edit, approve, and publish AI-suggested sponsorship packages
- See private bids that are never visible publicly
- Accept, reject, or counter sponsor bids
- Track orders, inventory, and revenue

Sponsors can:
- Browse a polished public event sponsorship page
- Instantly purchase fixed-price packages
- Submit a hidden/sealed bid if they want a lower price or a custom package
- Upload required assets after purchase

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### Setup

```bash
# Start infrastructure (Postgres, Redis, MinIO, Mailpit)
make up

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env — minimum: set AUTH_SECRET to any 32+ character string

# Generate Prisma client, run migrations, seed demo data
pnpm --filter @moongate/db db:generate
pnpm --filter @moongate/db db:migrate:dev -- --name init
pnpm --filter @moongate/db db:seed

# Start development servers
pnpm dev
```

### Access

| What | URL |
|------|-----|
| Public sponsor page | http://localhost:3000/ethglobal/ethmilan-2025 |
| Sponsor packages | http://localhost:3000/ethglobal/ethmilan-2025/sponsor |
| Submit private offer | http://localhost:3000/ethglobal/ethmilan-2025/bid/premium-sponsor |
| Organizer login | http://localhost:3000/auth/login |
| Admin events | http://localhost:3000/admin/ethglobal/events |
| API health | http://localhost:3001/health |
| Mailpit (email preview) | http://localhost:8025 |
| MinIO console | http://localhost:9001 (minioadmin/minioadmin) |
| Prisma Studio | `make db-studio` |

### Demo Credentials

- **Organizer email:** `admin@ethglobal.com`
- **Tenant slug:** `ethglobal`
- Use magic link login (link appears in terminal/Mailpit in dev)

---

## Architecture

```
apps/web          — Next.js 14 App Router (public + admin UI)
apps/api          — Fastify REST API
packages/
  db              — Prisma schema + seed (30 models)
  config          — Shared enums, RBAC permissions
  types           — TypeScript interfaces
  utils           — Utility functions
  ai              — AI extraction (Anthropic/OpenAI/Mock)
  payments        — Stripe abstraction
  storage         — S3/MinIO abstraction
  emails          — Resend/SMTP abstraction
  auth            — Auth token utilities
docs/
  architecture.md
  domain-model.md
  ai-extraction.md
  rbac.md
  runbooks/local-dev.md
  audit/moongate-sponsor-marketplace-audit.md
  implementation-summary.md
```

**Stack:** pnpm + Turborepo · Next.js 14 · Fastify · PostgreSQL + Prisma · Redis + BullMQ · S3/MinIO · Stripe · Anthropic Claude · Tailwind + shadcn-style components

---

## Key Features

### Multi-Tenant
Each event organizer (tenant) has isolated data, branding, events, and sponsor relationships. Tenant resolved via `X-Tenant-Slug` header or subdomain.

### Sponsorship Item Modes
- **Fixed Price** — standard buy now
- **Sealed Bid** — private offer only, no public price
- **Hybrid** — list price shown + "submit private offer" option
- **Request Only** — contact form, no price shown

### AI PDF Extraction
Upload a sponsorship deck → AI extracts structured items → human review → publish. Uses Anthropic Claude 3.5 Sonnet. Mock provider works without API keys in dev.

### Private Bids (Sealed)
Bids are never visible to the public or other sponsors. `reservePrice` and `minimumBid` are stripped from all public API responses. Only organizer users with `manage_bids` permission can view.

### RBAC
7 roles with 17 permissions. Enforced server-side on every organizer route. See [docs/rbac.md](docs/rbac.md).

---

## Development

```bash
make up           # Start Docker services
pnpm dev          # Start all apps in watch mode
pnpm test         # Run all tests
pnpm typecheck    # TypeScript check
make db-studio    # Open Prisma Studio
make db-seed      # Re-seed demo data
make down         # Stop Docker services
make clean        # Full reset (removes volumes)
```

---

## Environment Variables

See `.env.example` for full reference. Minimum required for local dev:

```bash
DATABASE_URL="postgresql://moongate:moongate@localhost:5432/moongate_dev"
AUTH_SECRET="any-string-at-least-32-characters-long"
```

AI extraction works with `AI_PROVIDER=mock` (default) — no API key needed.

---

## Docs

- [Architecture](docs/architecture.md)
- [Domain Model](docs/domain-model.md)
- [AI Extraction](docs/ai-extraction.md)
- [RBAC](docs/rbac.md)
- [Local Dev Runbook](docs/runbooks/local-dev.md)
- [Implementation Summary](docs/implementation-summary.md)
- [Audit Report](docs/audit/moongate-sponsor-marketplace-audit.md)
