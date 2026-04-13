# AI Extraction Pipeline — Moongate Sponsor Marketplace

## Overview

When an organizer uploads a sponsorship PDF deck, the system runs a multi-stage extraction pipeline to produce structured draft sponsorship items for human review.

**Core principle: AI never publishes — humans always review.**

## Pipeline Stages

```
PDF Upload
    ↓
Stage A: Store PDF as FileAsset (S3/MinIO)
    ↓
Stage B: Extract text from PDF (pdf-parse / pdfjs)
    ↓
Stage C: Render pages as images (optional, for visual decks)
    ↓
Stage D: Classify pages (cover / stats / sponsor_package / etc.)
    ↓
Stage E: Send text to AI provider with structured prompt
    ↓
Stage F: Parse and validate AI JSON output (Zod schemas)
    ↓
Stage G: Create ExtractionSuggestion rows in DB
    ↓
Stage H: Organizer reviews suggestions in admin UI
    ↓
Stage I: Accepted suggestions → draft SponsorItems (status: review_required)
    ↓
Stage J: Organizer edits items and publishes
```

## AI Prompt Contract

The extraction prompt instructs the AI to return a JSON object with:

```json
{
  "eventMeta": { "name", "tagline", "city", "country", "startDate", "endDate" },
  "stats": { "expectedAttendees", "onlineReach", "mediaReach", "newsletterSubs", "internationalPct", "topicTags" },
  "items": [
    {
      "publicTitle", "category", "mode", "listPrice", "currency",
      "quantityTotal", "isExclusive", "packageTier",
      "shortDescription", "longDescription",
      "benefits": [{ "type", "label", "value", "quantity" }],
      "confidence": 0.0-1.0
    }
  ],
  "addOns": [...],
  "contact": { "email", "telegram", "contactName" }
}
```

## Confidence Scoring

| Score | Meaning |
|-------|---------|
| 0.90+ | Explicit data from the deck — copy it |
| 0.75-0.89 | Reasonable inference with supporting context |
| 0.60-0.74 | Possible interpretation — review carefully |
| < 0.60 | Guess — likely reject or manually fill |

The review UI shows a color-coded confidence bar:
- Green: >= 0.85
- Yellow: 0.70-0.84
- Red: < 0.70

## Page Classification

Each page is classified into:
- `cover` — event name, dates, branding
- `stats` — audience numbers, reach metrics
- `value_proposition` — why sponsor, benefits overview
- `sponsor_package` — tier package (premium/gold/silver)
- `upgrade` — optional upgrade to a tier
- `add_on` — standalone add-on (food, badge, ads)
- `contact` — contact info and CTA
- `other` — unclassified

## Typical ETHMilan-Style Deck Mapping

| Deck Section | Extracted As | Mode |
|-------------|-------------|------|
| Title Sponsor | sponsor_item | sealed_bid |
| Premium Pack | sponsor_item | fixed_price |
| Mid-Tier Pack | sponsor_item | hybrid |
| Community Pack | sponsor_item | fixed_price |
| Coffee Sponsor | add_on | fixed_price |
| Lunch Sponsor | add_on | hybrid |
| Badge/Lanyard | add_on | fixed_price |
| Screen Ads | add_on | fixed_price |
| Custom Package | sponsor_item | request_only |

## Provider Abstraction

The AI package supports three providers via `createAIClient(provider, apiKey)`:

| Provider | Model | Use Case |
|----------|-------|---------|
| `anthropic` | claude-3-5-sonnet-20241022 | Production (best structured output) |
| `openai` | gpt-4o | Alternative |
| `mock` | mock-v1 | Development and testing (no API key needed) |

Set `AI_PROVIDER=mock` in `.env` to use realistic mock data without API calls.

## Review UI

The extraction review UI at `/admin/:tenant/events/:eventId/decks` shows:
- Per-suggestion confidence bar
- Source page references
- All extracted fields in editable cards
- Accept / Reject buttons per suggestion
- Bulk "Create Items" from all accepted suggestions
- Created items land in `review_required` status
