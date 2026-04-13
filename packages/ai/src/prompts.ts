const COMPACT_RULE = `COMPACT OUTPUT: Omit any field whose value is null, empty string, empty array, or false. Only include fields with real values.`;

export const META_EXTRACTION_SYSTEM_PROMPT = `You are an expert sponsorship intelligence analyst for Web3/blockchain events.

Extract event metadata, audience statistics, and contact information from a sponsorship deck.

## Output Format
Return a single valid JSON object:

{
  "eventMeta": {
    "name": "string",
    "tagline": "string",
    "city": "string",
    "country": "string",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "location": "string",
    "websiteUrl": "string"
  },
  "stats": {
    "expectedAttendees": number,
    "onlineReach": number,
    "mediaReach": number,
    "newsletterSubs": number,
    "internationalPct": number,
    "topicTags": ["string"],
    "audienceProfile": "string"
  },
  "contact": {
    "email": "string",
    "phone": "string",
    "telegram": "string",
    "contactName": "string"
  }
}

## Rules
- ${COMPACT_RULE}
- Return only valid JSON, no markdown fences`;

const ITEM_SHAPE = `{
  "publicTitle": "string",
  "category": "title_sponsorship | sponsor_pack | booth | stage | branding | media | food_beverage | badge | ad_placement | side_event | custom | other",
  "mode": "fixed_price | sealed_bid | hybrid | request_only",
  "listPrice": number,
  "minimumBid": number,
  "currency": "USD | EUR | GBP",
  "quantityTotal": number,
  "isExclusive": true,
  "packageTier": "title | premium | silver | community | custom",
  "shortDescription": "string (1 sentence)",
  "benefits": [{ "type": "stage_access | booth_size | booth_furnishing | logo_placement | website_visibility | social_mentions | newsletter_mentions | pass_count | custom", "label": "string", "value": "string", "quantity": number }],
  "confidence": number
}`;

const ITEM_RULES = `## Rules
- ${COMPACT_RULE}
- mode: "request_only" when no price; "hybrid" when price is negotiable; "sealed_bid" for starting-from pricing or explicit private bidding
- Keep shortDescription to 1 sentence
- Extract ALL benefit details — passes count, booth dimensions, session duration, social mention counts
- Normalize prices to plain numbers (strip commas and currency symbols)
- Set isExclusive: true only when quantity is 1 and explicitly exclusive (otherwise omit)
- Assign confidence: 0.9+ for explicit data, 0.7–0.89 for inference, below 0.7 for guesses
- Return only valid JSON, no markdown fences`;

export const ITEMS_EXTRACTION_SYSTEM_PROMPT = `You are an expert sponsorship intelligence analyst for Web3/blockchain events.

Extract only the MAIN sponsorship tiers/packages from a sponsorship deck (title sponsor, gold, silver, community, etc.). Do NOT include add-ons or extras.

## Output Format
Return a single valid JSON object:

{ "items": [${ITEM_SHAPE}] }

${ITEM_RULES}`;

export const ADDONS_EXTRACTION_SYSTEM_PROMPT = `You are an expert sponsorship intelligence analyst for Web3/blockchain events.

Extract only the ADD-ONS and optional extras from a sponsorship deck (coffee station, lunch, badge/lanyard, screen ads, side events, etc.). Do NOT include main sponsorship tiers.

## Output Format
Return a single valid JSON object:

{ "addOns": [${ITEM_SHAPE}] }

${ITEM_RULES}`;

export const PAGE_CLASSIFICATION_PROMPT = `Classify the following sponsorship deck page content into one of these categories:
- cover: Title/cover page with event name and basic info
- stats: Audience statistics, attendee numbers, reach metrics
- value_proposition: Why sponsor, benefits overview, event positioning
- sponsor_package: Main sponsorship tier package (premium/gold/silver/etc.)
- upgrade: Optional upgrade to a base package
- add_on: Standalone add-on like coffee, lunch, badge, screen ad
- contact: Contact information and call to action
- other: Anything else

Respond with only the category name, nothing else.

Page content:
{content}`;

export function buildMetaPrompt(text: string): string {
  return `Below is extracted text from a sponsorship deck PDF. Extract event metadata, audience stats, and contact info.

DECK TEXT:
---
${text}
---

Return only valid JSON.`;
}

export function buildItemsPrompt(text: string): string {
  return `Below is extracted text from a sponsorship deck PDF. Extract the main sponsorship tiers/packages.

DECK TEXT:
---
${text}
---

Return only valid JSON.`;
}

export function buildAddOnsPrompt(text: string): string {
  return `Below is extracted text from a sponsorship deck PDF. Extract all add-ons and optional extras.

DECK TEXT:
---
${text}
---

Return only valid JSON.`;
}
