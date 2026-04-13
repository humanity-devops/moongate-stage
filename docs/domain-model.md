# Domain Model — Moongate Sponsor Marketplace

## Core Entities

### Tenant
The top-level organizational unit. Each event organizer company (e.g. ETHGlobal) is a Tenant.

**Key fields:** `slug`, `name`, `primaryColor`, `accentColor`, `domain`, `currency`

### Event
A specific conference or meetup owned by a Tenant.

**Key fields:** `slug`, `name`, `startDate`, `endDate`, `status` (draft | published | archived)
**Relations:** `EventBranding`, `EventStats`, `SponsorItem[]`, `Bid[]`, `Order[]`

### SponsorItem
The core commerce entity — a sponsorship package, add-on, or opportunity.

**Item Modes:**
- `fixed_price` — has a list price, direct checkout
- `sealed_bid` — no public checkout, sponsors submit private offers
- `hybrid` — shows list price AND allows private offer ("Buy Now or Offer")
- `request_only` — no price shown, contact form only

**Item Statuses:**
- `draft` → `review_required` → `published` → `sold_out` | `archived`

**Key fields:**
- `listPrice` — public price (shown to sponsors)
- `reservePrice` — minimum the organizer will accept (NEVER sent to clients)
- `minimumBid` — minimum bid floor (NEVER sent to clients)
- `bidAllowed` — enables private offer form
- `quantityTotal` / `quantitySold` — inventory tracking
- `isExclusive` — only one buyer

### Bid
A private offer from a sponsor on a specific SponsorItem.

**Statuses:** `submitted` → `under_review` → `countered` → `accepted` | `rejected` | `expired` | `withdrawn`

**Privacy rule:** Bids are NEVER visible to the public or other sponsors. Only organizer users with `manage_bids` permission can view them.

**Flow:** Bid → (CounterOffer*) → Accepted → Order created

### Order
Created when a fixed-price item is purchased or a bid is accepted.

**Statuses:** `pending` → `payment_pending` → `paid` → `fulfilled` | `cancelled` | `refunded`

### CounterOffer
An organizer's counter-proposal to a Bid. Multiple counters are allowed; each supersedes the previous pending one.

### SponsorshipDeck
A PDF uploaded by organizers for AI-assisted item extraction.

**Extraction flow:**
`SponsorshipDeck` → `ExtractionJob` → `ExtractionSuggestion[]` → (human review) → `SponsorItem[]`

### ExtractionSuggestion
A single AI-extracted piece of data. Each suggestion has:
- `type`: event_meta | stats | sponsor_item | upgrade | add_on | contact
- `suggestedData`: JSON blob of extracted fields
- `confidence`: 0.0 - 1.0
- `status`: pending | accepted | rejected | merged
- `sourcePageNumbers`: which PDF pages it came from

## RBAC Summary

See [rbac.md](./rbac.md) for full permission matrix.

Quick reference:
- `organizer_owner` — everything except `manage_tenant`
- `organizer_admin` — full event/item/bid/order management
- `organizer_sales` — bid management and orders
- `organizer_finance` — orders and payments only
- `organizer_viewer` — read-only analytics

## Key Business Rules

1. **Bid privacy**: `reservePrice` and `minimumBid` are never exposed in public API responses
2. **Inventory**: `quantityReserved + quantitySold <= quantityTotal` enforced at application level
3. **Exclusive items**: `quantityTotal = 1`, once sold cannot be purchased again
4. **Hybrid mode**: sponsors can either buy at list price OR submit a lower private offer
5. **AI suggestions**: Never auto-published — always require human review + explicit publish action
6. **Sold-out display**: Items with `visibleWhenSoldOut: true` remain visible for social proof
7. **Bid expiry**: Optional `expiresAt` on Bid, worker marks as `expired` if not actioned
