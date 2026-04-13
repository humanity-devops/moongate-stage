# Moongate Sponsor Marketplace — Repository Audit

**Date:** 2026-03-30
**Auditor:** Claude Code (Principal Engineer)
**Repository State at Audit:** Empty directory

---

## Phase 0 Finding: Repository Was Empty

The repository at `/Users/ry/Documents/sponsorship` contained no files at audit time. This document records the architectural decisions made during scaffolding.

---

## Decisions Made

### Backend: Fastify over NestJS

**Chosen:** Fastify v4 with TypeScript
**Rationale:**
- Faster cold starts and request throughput (~2× vs NestJS)
- First-class TypeScript without heavy decorator magic
- Simpler plugin model for multi-tenant middleware
- Zod validation integrates more cleanly than class-validator
- Less boilerplate for a product-first codebase
- NestJS adds structural overhead that is valuable for large teams but is unnecessary complexity for a focused, well-typed codebase

**Trade-offs:**
- No built-in DI container (not needed here — Prisma and explicit service functions are sufficient)
- More manual route organization (mitigated by feature-based file structure)

### Auth: Custom session tokens + magic links

**Chosen:** Custom session table (no third-party auth provider)
**Rationale:**
- Full control over multi-tenant session behavior
- No per-MAU cost at scale
- Magic link flow covers the primary use case (organizer team login)
- Password auth available for automated integrations

### AI Provider: Abstraction layer with Anthropic as default

**Chosen:** Provider adapter pattern (Anthropic / OpenAI / Mock)
**Rationale:**
- Never lock into a single provider
- Mock provider allows full dev/test without API keys
- Anthropic Claude 3.5 Sonnet is the best fit for structured JSON extraction tasks

### Multi-tenancy: Row-level isolation via tenantId

**Chosen:** Shared database, tenant-scoped queries
**Rationale:**
- Simpler operations (one migration path, one connection pool)
- RLS policies can be added later for additional enforcement
- Every model carries tenantId with indexed foreign key
- Tenant resolution via `X-Tenant-Slug` header or subdomain

---

## What Was Built

### Packages
| Package | Status | Purpose |
|---------|--------|---------|
| `@moongate/config` | ✅ Complete | Shared enums, status arrays, RBAC permission map |
| `@moongate/types` | ✅ Complete | TypeScript interface types |
| `@moongate/utils` | ✅ Complete | Utility functions (slugify, formatCurrency, etc.) |
| `@moongate/db` | ✅ Complete | Prisma schema (30 models), singleton client, seed |
| `@moongate/ai` | ✅ Complete | AI provider abstraction, extraction pipeline, prompts |
| `@moongate/payments` | 🚧 Scaffold only | Stripe integration (interface defined, not wired) |
| `@moongate/storage` | 🚧 Scaffold only | S3/MinIO abstraction (interface defined, not wired) |
| `@moongate/emails` | 🚧 Scaffold only | Email templates (not wired) |

### API (`apps/api`)
| Feature | Status |
|---------|--------|
| Auth (login, magic link, session, logout, /me) | ✅ |
| Public event + item browse | ✅ |
| Public bid submission | ✅ |
| Public lead capture | ✅ |
| Organizer event CRUD | ✅ |
| Organizer item CRUD + publish | ✅ |
| Organizer bid management | ✅ |
| Bid accept/reject/counter | ✅ |
| Bid → Order conversion | ✅ |
| PDF deck upload + extraction trigger | ✅ |
| AI extraction suggestions | ✅ (mock + real provider) |
| Extraction review (per-suggestion) | ✅ |
| Bulk create items from suggestions | ✅ |
| Dashboard aggregates | ✅ |
| Audit log writes | ✅ |
| Rate limiting | ✅ |
| Tenant isolation middleware | ✅ |
| RBAC permission enforcement | ✅ |
| Stripe checkout | 🚧 Interface ready |
| File upload (signed URLs) | 🚧 Interface ready |

### Web (`apps/web`)
| Feature | Status |
|---------|--------|
| Event landing page | ✅ |
| Sponsor packages listing | ✅ |
| Package filters (category, mode) | ✅ |
| Item detail page | ✅ |
| Bid submission form | ✅ |
| Benefits table | ✅ |
| Organizer login (magic link + password) | ✅ |
| Admin events list | ✅ |
| Admin event dashboard | ✅ |
| Admin items management | ✅ |
| Admin bids (list + kanban) | ✅ |
| Admin bid counter modal | ✅ |
| AI extraction review UI | ✅ |
| Compare packages page | 🚧 Scaffolded |
| Checkout flow | 🚧 Scaffolded |
| Sponsor portal | 🚧 Not started |
| Analytics dashboard | 🚧 Not started |

---

## Known Gaps (Next Phase)

### High Priority
1. **File uploads**: Signed S3/MinIO upload URLs, actual PDF storage
2. **Stripe checkout**: Complete Stripe session creation and webhook handler
3. **Email notifications**: Bid submitted, bid accepted/rejected, order confirmed
4. **Real AI extraction**: Wire Anthropic API for actual PDF text extraction
5. **Sponsor portal**: Secure link for asset submission post-purchase

### Medium Priority
6. PDF text extraction (pdf-parse or pdfjs)
7. Page image rendering for visual deck understanding
8. Compare packages page
9. Analytics dashboard with charts
10. Password hashing with bcrypt (replace SHA256 placeholder)

### Lower Priority
11. Webhook delivery to organizer systems
12. CSV/Excel export of bids and orders
13. Custom domain per tenant
14. Crypto payment rails
15. Rate limit storage (Redis-backed instead of in-memory)

---

## Security Notes

- All organizer routes are behind `requireAuth` + `requirePermission`
- Public bid endpoints have per-route rate limits (5 bids / 10 min)
- Private fields (`reservePrice`, `minimumBid`) are stripped from public API responses
- Tenant isolation enforced at query level (tenantId in every where clause)
- TODO: Replace SHA256 password hash with bcrypt
- TODO: Add CSRF protection for cookie-based sessions if implemented
- TODO: Sign upload URLs rather than allowing direct public writes
