# RBAC — Moongate Sponsor Marketplace

## Role Hierarchy

```
platform_superadmin (all permissions)
platform_ops (analytics + audit read)

organizer_owner (all tenant permissions)
organizer_admin (full event management)
organizer_sales (bids + orders)
organizer_finance (orders + payments)
organizer_viewer (read-only)
```

## Permission Matrix

| Permission | superadmin | platform_ops | owner | admin | sales | finance | viewer |
|-----------|-----------|-------------|-------|-------|-------|---------|--------|
| manage_tenant | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| manage_event | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| manage_branding | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| upload_deck | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| review_ai_suggestions | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| publish_items | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| manage_inventory | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| manage_bids | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| accept_bids | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| counter_bids | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| reject_bids | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| manage_orders | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| manage_payments | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| manage_assets | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| view_analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| export_data | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| view_audit_logs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

## Implementation

RBAC is enforced server-side in the Fastify API via `requirePermission()`:

```typescript
fastify.post('/items', async (request) => {
  await requirePermission('manage_inventory')(request);
  // ... handler
});
```

The `ROLE_PERMISSIONS` map in `@moongate/config` is the single source of truth.

Frontend guards are UI-only hints — all enforcement happens at the API level.

## Sponsor-Side Access

Sponsors are not authenticated users in the standard sense:
- **Public visitors**: No auth, can browse public items
- **SponsorContact**: Created when bid is submitted. Optionally receives a `portalToken` for asset submission
- **Sponsor portal**: Accessed via secure one-time token link (no password)

Sponsor portal tokens expire and are invalidated after use.
