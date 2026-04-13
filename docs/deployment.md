# Deployment Guide — Moongate Sponsor Marketplace

## Environment Overview

| Environment | Infrastructure | Notes |
|-------------|---------------|-------|
| Local Dev | Docker Compose | MinIO, Mailpit, Postgres, Redis |
| Staging | Fly.io / Railway | Real Stripe test keys, S3 bucket |
| Production | Fly.io / Railway / AWS | Real Stripe live keys, S3 |

## Recommended Production Stack

- **API**: Fly.io (containers) or Railway
- **Web**: Vercel (Next.js hosting)
- **Database**: Neon (serverless Postgres) or Supabase or RDS
- **Redis**: Upstash (serverless) or ElastiCache
- **Storage**: AWS S3 or Cloudflare R2
- **Email**: Resend
- **Payments**: Stripe

## Required Environment Variables (Production)

```bash
# Core
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
AUTH_SECRET="<strong-secret-min-32-chars>"
NODE_ENV="production"

# App URLs
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXT_PUBLIC_API_URL="https://api.your-domain.com"
AUTH_URL="https://your-domain.com"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Storage
S3_ENDPOINT="https://s3.amazonaws.com"
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
S3_BUCKET="moongate-prod"
S3_REGION="us-east-1"

# Email
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@yourdomain.com"

# AI
AI_PROVIDER="anthropic"
ANTHROPIC_API_KEY="sk-ant-..."
```

## Database Migrations

```bash
# Run migrations in production
pnpm --filter @moongate/db db:migrate

# Generate client after schema changes (local)
pnpm --filter @moongate/db db:generate
```

## Stripe Webhook Setup

1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Login: `stripe login`
3. Forward events locally: `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
4. In production: configure webhook endpoint at `https://api.yourdomain.com/api/webhooks/stripe`

Events to subscribe to:
- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

## Multi-Tenant Routing

### Subdomain approach (production)
- `ethglobal.moongate.xyz` → tenant slug `ethglobal`
- Requires wildcard SSL cert and DNS

### Header approach (default)
- `X-Tenant-Slug: ethglobal` header
- Works for all environments

### Custom domain (advanced)
- Map `sponsors.ethglobal.com` → `ethglobal` tenant
- Configure in `Tenant.domain` field
- Requires wildcard SSL and custom routing

## Health Checks

- API health: `GET /health`
- Database: check Prisma connection in health endpoint
- Redis: ping in health endpoint

## Observability

- Structured JSON logging via Pino (production)
- Error reporting: add Sentry DSN to `SENTRY_DSN` env var
- Metrics: instrument `/health` endpoint with Prometheus labels

## Security Checklist

- [ ] AUTH_SECRET is 32+ random characters
- [ ] Stripe webhook signature verification enabled
- [ ] S3 bucket is private (signed URLs for access)
- [ ] CORS allows only your domains
- [ ] Rate limiting configured
- [ ] All API routes have auth + permission checks
- [ ] `NODE_ENV=production` disables dev features (magic link token exposure, etc.)
