# Architecture — Moongate Sponsor Marketplace

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                          │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS
                ┌────────┴────────┐
                │  Next.js Web    │  Port 3000
                │  (apps/web)     │  App Router, SSR + Client
                └────────┬────────┘
                         │ HTTP / fetch
                ┌────────┴────────┐
                │  Fastify API    │  Port 3001
                │  (apps/api)     │  REST JSON, JWT sessions
                └──┬──────┬──────┘
                   │      │
          ┌────────┘      └─────────┐
    ┌─────┴──────┐         ┌───────┴────────┐
    │ PostgreSQL  │         │     Redis       │
    │ (Prisma)    │         │  (BullMQ jobs)  │
    └────────────┘         └───────┬─────────┘
                                   │
                          ┌────────┴─────────┐
                          │  AI Extraction    │
                          │  Worker           │
                          │  (BullMQ + AI SDK)│
                          └──────────────────┘

Storage: MinIO (dev) / S3 (prod)
Email: Mailpit (dev) / Resend (prod)
Payments: Stripe
```

## Monorepo Structure

```
moongate-sponsor-marketplace/
├── apps/
│   ├── web/          — Next.js 14 App Router (public + admin UI)
│   └── api/          — Fastify REST API
├── packages/
│   ├── db/           — Prisma schema, client, seed
│   ├── config/       — Shared enums, constants, RBAC map
│   ├── types/        — Shared TypeScript interfaces
│   ├── utils/        — Utility functions
│   ├── ai/           — AI provider abstraction + extraction pipeline
│   ├── payments/     — Stripe abstraction
│   ├── storage/      — S3/MinIO abstraction
│   ├── emails/       — Email templates
│   └── auth/         — Auth utilities (shared between api and web)
└── docs/
    ├── architecture.md
    ├── domain-model.md
    ├── ai-extraction.md
    ├── rbac.md
    ├── deployment.md
    └── runbooks/
```

## Multi-Tenancy

Each tenant (e.g. ETHGlobal, Devcon, ETHWarsaw) has:
- Their own `Tenant` row with slug, branding, currency
- All data rows include `tenantId`
- Tenant resolved per-request via `X-Tenant-Slug` header or subdomain
- All Prisma queries include `tenantId` in `where` clause

Public URLs: `/:tenantSlug/:eventSlug` (e.g. `/ethglobal/ethmilan-2025`)
Admin URLs: `/admin/:tenantSlug/events/:eventId`

## Request Flow

### Public Bid Submission
1. Sponsor visits `/ethglobal/ethmilan-2025/bid/premium-sponsor`
2. Server renders item details (SSR, strips private fields)
3. Client submits form → `POST /api/public/events/ethglobal/ethmilan-2025/items/premium-sponsor/bids`
4. API validates, creates Bid record, logs activity
5. Organizer sees bid in admin console under Bids → Inbox

### AI Deck Extraction
1. Organizer uploads PDF → `POST /api/organizer/events/:eventId/decks`
2. API stores FileAsset, creates SponsorshipDeck + ExtractionJob records
3. BullMQ job queued (or mock runs synchronously in dev)
4. Worker: extracts PDF text → calls AI provider → parses JSON → creates ExtractionSuggestion rows
5. Organizer reviews suggestions in `/admin/.../decks` UI
6. Accept → creates draft SponsorItem with `status: review_required`
7. Organizer edits and publishes items

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| API framework | Fastify | Speed, TypeScript, plugin model |
| ORM | Prisma | Type safety, migrations, multi-DB support |
| Auth | Custom sessions | Control, multi-tenancy, no per-MAU cost |
| AI | Anthropic + abstraction | Best structured output; swap without code changes |
| Multi-tenant | Shared DB + tenantId | Simpler ops, same migration path |
| Public bid privacy | Server-side field strip | `reservePrice`/`minimumBid` never sent to clients |
| Item status | Enum with 6 states | Clear lifecycle from draft → archived |

## Security Layers

1. **Tenant isolation**: Every query includes `tenantId`
2. **RBAC**: `requirePermission()` hook on all organizer mutations
3. **Private data**: `reservePrice`, `minimumBid` stripped before public API responses
4. **Rate limiting**: Global 100/min, 5 bids/10min for bid submission
5. **Input validation**: Zod schemas on every route body
6. **Audit logs**: Written for sensitive organizer actions
7. **Session tokens**: Random 32-byte hex, stored hashed, expire after 30 days
