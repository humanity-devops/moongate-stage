import { z } from 'zod';
import type { AIClient } from './provider.js';
import {
  META_EXTRACTION_SYSTEM_PROMPT,
  ITEMS_EXTRACTION_SYSTEM_PROMPT,
  ADDONS_EXTRACTION_SYSTEM_PROMPT,
  buildMetaPrompt,
  buildItemsPrompt,
  buildAddOnsPrompt,
} from './prompts.js';

const BenefitSchema = z.object({
  type: z.string(),
  label: z.string(),
  value: z.string().nullish(),
  quantity: z.number().nullish(),
});

const ExtractedItemSchema = z.object({
  publicTitle: z.string(),
  internalTitle: z.string().nullish(),
  category: z.string().default('other'),
  mode: z.enum(['fixed_price', 'sealed_bid', 'hybrid', 'request_only']).default('fixed_price'),
  listPrice: z.number().nullish(),
  minimumBid: z.number().nullish(),
  currency: z.string().default('USD'),
  quantityTotal: z.number().nullish(),
  isExclusive: z.boolean().default(false),
  packageTier: z.string().nullish(),
  shortDescription: z.string().default(''),
  benefits: z.array(BenefitSchema).default([]),
  sourcePageHint: z.string().nullish(),
  confidence: z.number().min(0).max(1).default(0.5),
});

const ExtractionOutputSchema = z.object({
  eventMeta: z.object({
    name: z.string().nullish(),
    tagline: z.string().nullish(),
    city: z.string().nullish(),
    country: z.string().nullish(),
    startDate: z.string().nullish(),
    endDate: z.string().nullish(),
    location: z.string().nullish(),
    websiteUrl: z.string().nullish(),
  }).default({}),
  stats: z.object({
    expectedAttendees: z.number().nullish(),
    onlineReach: z.number().nullish(),
    mediaReach: z.number().nullish(),
    newsletterSubs: z.number().nullish(),
    internationalPct: z.number().nullish(),
    topicTags: z.array(z.string()).default([]),
    audienceProfile: z.string().nullish(),
  }).default({}),
  items: z.array(ExtractedItemSchema).default([]),
  addOns: z.array(ExtractedItemSchema).default([]),
  contact: z.object({
    email: z.string().nullish(),
    phone: z.string().nullish(),
    telegram: z.string().nullish(),
    contactName: z.string().nullish(),
  }).default({}),
});

export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

export interface ExtractionResult {
  output: ExtractionOutput;
  raw: string;
  model: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
}

const MetaOutputSchema = z.object({
  eventMeta: ExtractionOutputSchema.shape.eventMeta,
  stats: ExtractionOutputSchema.shape.stats,
  contact: ExtractionOutputSchema.shape.contact,
});

const ItemsOutputSchema = z.object({
  items: ExtractionOutputSchema.shape.items,
});

const AddOnsOutputSchema = z.object({
  addOns: ExtractionOutputSchema.shape.addOns,
});

// Split text into overlapping chunks so each AI call sees at most ~6K chars
// Small enough that even a dense deck with many packages won't approach the 8192 token output ceiling
const CHUNK_SIZE = 6000;
const CHUNK_OVERLAP = 600;

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + CHUNK_SIZE));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

function stripFences(text: string): string {
  return text
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();
}

function parseResponse<T>(label: string, content: string, schema: z.ZodType<T>): T {
  const text = stripFences(content);
  if (!text) throw new Error(`${label} returned empty content`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`${label} returned invalid JSON: ${e instanceof Error ? e.message : String(e)}\nRaw: ${text.slice(0, 200)}`);
  }
  try {
    return schema.parse(parsed);
  } catch (e) {
    throw new Error(`${label} failed schema validation: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function deduplicateItems(items: ExtractedItem[]): ExtractedItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.publicTitle.toLowerCase().trim().replace(/\s+/g, ' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function extractSponsorshipDeck(
  client: AIClient,
  deckText: string,
  options?: { maxTokens?: number },
): Promise<ExtractionResult> {
  const chunks = chunkText(deckText);
  const perCallTokens = options?.maxTokens ?? 8192;

  // Meta only needs the first chunk (event info is always near the top)
  // Items and addOns run on every chunk in parallel, then deduplicate
  const [metaResponse, ...chunkResponses] = await Promise.all([
    client.complete(
      [{ role: 'user', content: buildMetaPrompt(chunks[0]) }],
      { system: META_EXTRACTION_SYSTEM_PROMPT, maxTokens: 1024, temperature: 0.1 },
    ),
    ...chunks.flatMap((chunk, i) => [
      client.complete(
        [{ role: 'user', content: buildItemsPrompt(chunk) }],
        { system: ITEMS_EXTRACTION_SYSTEM_PROMPT, maxTokens: perCallTokens, temperature: 0.1 },
      ),
      client.complete(
        [{ role: 'user', content: buildAddOnsPrompt(chunk) }],
        { system: ADDONS_EXTRACTION_SYSTEM_PROMPT, maxTokens: perCallTokens, temperature: 0.1 },
      ),
    ]),
  ]);

  // Pair up items/addOns responses per chunk
  const itemsResponses = chunkResponses.filter((_, i) => i % 2 === 0);
  const addOnsResponses = chunkResponses.filter((_, i) => i % 2 === 1);

  let output: ExtractionOutput;
  try {
    const metaParsed = parseResponse('Meta call', metaResponse.content, MetaOutputSchema);

    const allItems = itemsResponses.flatMap((r, i) =>
      parseResponse(`Items call (chunk ${i + 1})`, r.content, ItemsOutputSchema).items
    );
    const allAddOns = addOnsResponses.flatMap((r, i) =>
      parseResponse(`AddOns call (chunk ${i + 1})`, r.content, AddOnsOutputSchema).addOns
    );

    output = ExtractionOutputSchema.parse({
      ...metaParsed,
      items: deduplicateItems(allItems),
      addOns: deduplicateItems(allAddOns),
    });
  } catch (e) {
    throw new Error(`Failed to parse AI extraction output: ${e instanceof Error ? e.message : String(e)}`);
  }

  const allResponses = [metaResponse, ...chunkResponses];
  return {
    output,
    raw: JSON.stringify(allResponses.map(r => r.content)),
    model: metaResponse.model,
    provider: metaResponse.provider,
    inputTokens: allResponses.reduce((s, r) => s + (r.inputTokens ?? 0), 0),
    outputTokens: allResponses.reduce((s, r) => s + (r.outputTokens ?? 0), 0),
  };
}

export function normalizeToDraftSuggestions(
  extraction: ExtractionOutput,
  jobId: string,
  deckId: string,
): Array<{
  jobId: string;
  deckId: string;
  type: string;
  suggestedData: Record<string, unknown>;
  confidence: number;
  sourcePageNumbers: number[];
}> {
  const suggestions = [];

  // Event meta
  if (extraction.eventMeta?.name) {
    suggestions.push({
      jobId,
      deckId,
      type: 'event_meta',
      confidence: 0.9,
      sourcePageNumbers: [1],
      suggestedData: extraction.eventMeta as Record<string, unknown>,
    });
  }

  // Stats
  if (extraction.stats?.expectedAttendees || extraction.stats?.topicTags?.length) {
    suggestions.push({
      jobId,
      deckId,
      type: 'stats',
      confidence: 0.85,
      sourcePageNumbers: [2],
      suggestedData: extraction.stats as Record<string, unknown>,
    });
  }

  // Sponsor items
  for (const item of extraction.items) {
    suggestions.push({
      jobId,
      deckId,
      type: 'sponsor_item',
      confidence: item.confidence,
      sourcePageNumbers: [],
      suggestedData: item as unknown as Record<string, unknown>,
    });
  }

  // Add-ons
  for (const addOn of extraction.addOns) {
    suggestions.push({
      jobId,
      deckId,
      type: 'add_on',
      confidence: addOn.confidence,
      sourcePageNumbers: [],
      suggestedData: addOn as unknown as Record<string, unknown>,
    });
  }

  // Contact
  if (extraction.contact?.email || extraction.contact?.telegram) {
    suggestions.push({
      jobId,
      deckId,
      type: 'contact',
      confidence: 0.8,
      sourcePageNumbers: [],
      suggestedData: extraction.contact as Record<string, unknown>,
    });
  }

  return suggestions;
}
