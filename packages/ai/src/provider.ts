import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type AIProvider = 'anthropic' | 'openai' | 'mock';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  inputTokens?: number;
  outputTokens?: number;
}

export type AIClient = {
  complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AIResponse>;
  provider: AIProvider;
};

export function createAnthropicClient(apiKey: string): AIClient {
  const client = new Anthropic({ apiKey });

  return {
    provider: 'anthropic',
    async complete(messages, options = {}) {
      // Use streaming to keep the connection alive and avoid network idle timeouts
      const stream = client.messages.stream({
        model: options.model ?? 'claude-sonnet-4-6',
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.2,
        system: options.system,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      });
      const response = await stream.finalMessage();
      const content = response.content[0];
      if (content.type !== 'text') throw new Error('Unexpected response type');
      return {
        content: content.text,
        model: response.model,
        provider: 'anthropic',
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    },
  };
}

export function createOpenAIClient(apiKey: string): AIClient {
  const client = new OpenAI({ apiKey });

  return {
    provider: 'openai',
    async complete(messages, options = {}) {
      const response = await client.chat.completions.create({
        model: options.model ?? 'gpt-4o',
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.2,
        messages: [
          ...(options.system ? [{ role: 'system' as const, content: options.system }] : []),
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
      });
      return {
        content: response.choices[0].message.content ?? '',
        model: response.model,
        provider: 'openai',
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      };
    },
  };
}

export function createMockClient(): AIClient {
  return {
    provider: 'mock',
    async complete(messages, options = {}) {
      // Return realistic mock extraction output
      return {
        content: JSON.stringify(MOCK_EXTRACTION_OUTPUT),
        model: 'mock-v1',
        provider: 'mock',
      };
    },
  };
}

export function createAIClient(
  provider: AIProvider = 'mock',
  apiKey?: string,
): AIClient {
  switch (provider) {
    case 'anthropic':
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY required');
      return createAnthropicClient(apiKey);
    case 'openai':
      if (!apiKey) throw new Error('OPENAI_API_KEY required');
      return createOpenAIClient(apiKey);
    case 'mock':
    default:
      return createMockClient();
  }
}

const MOCK_EXTRACTION_OUTPUT = {
  eventMeta: {
    name: 'ETHMilan 2025',
    tagline: 'The Premier Ethereum Conference in Southern Europe',
    city: 'Milan',
    country: 'Italy',
    startDate: '2025-09-18',
    endDate: '2025-09-19',
  },
  stats: {
    expectedAttendees: 800,
    onlineReach: 15000,
    mediaReach: 50000,
    newsletterSubs: 8500,
    internationalPct: 60,
    topicTags: ['Ethereum', 'DeFi', 'L2s', 'ZK', 'NFTs'],
  },
  items: [
    {
      publicTitle: 'Title Sponsor',
      category: 'title_sponsorship',
      mode: 'sealed_bid',
      listPrice: 50000,
      currency: 'USD',
      isExclusive: true,
      quantityTotal: 1,
      shortDescription: 'Maximum visibility with "Presented by" co-branding, keynote slot, and largest booth.',
      benefits: [
        { type: 'stage_access', label: 'Keynote slot', value: '30 minutes' },
        { type: 'booth_size', label: 'Booth', value: '6×6m premium corner' },
        { type: 'logo_placement', label: 'Logo', value: '"Presented by" — top of all materials' },
        { type: 'pass_count', label: 'Passes', quantity: 10 },
      ],
    },
    {
      publicTitle: 'Premium Sponsor',
      category: 'sponsor_pack',
      mode: 'fixed_price',
      listPrice: 30000,
      currency: 'USD',
      quantityTotal: 3,
      packageTier: 'premium',
      shortDescription: 'Main stage panel slot and 4×4m booth in the prime networking area.',
      benefits: [
        { type: 'stage_access', label: 'Panel slot', value: '45 minutes' },
        { type: 'booth_size', label: 'Booth', value: '4×4m' },
        { type: 'pass_count', label: 'Passes', quantity: 6 },
      ],
    },
    {
      publicTitle: 'Silver Sponsor',
      category: 'sponsor_pack',
      mode: 'hybrid',
      listPrice: 20000,
      minimumBid: 15000,
      currency: 'USD',
      quantityTotal: 5,
      packageTier: 'silver',
      shortDescription: 'Lightning talk slot and 3×2m booth.',
    },
    {
      publicTitle: 'Community Sponsor',
      category: 'sponsor_pack',
      mode: 'fixed_price',
      listPrice: 10000,
      currency: 'USD',
      quantityTotal: 10,
      packageTier: 'community',
      shortDescription: 'Logo placement and digital presence.',
    },
  ],
  addOns: [
    {
      publicTitle: 'Coffee Station Sponsor',
      category: 'food_beverage',
      mode: 'fixed_price',
      listPrice: 5000,
      quantityTotal: 2,
    },
    {
      publicTitle: 'Lunch Sponsor',
      category: 'food_beverage',
      mode: 'hybrid',
      listPrice: 12000,
      isExclusive: true,
      quantityTotal: 1,
    },
    {
      publicTitle: 'Badge / Lanyard Sponsor',
      category: 'badge',
      mode: 'fixed_price',
      listPrice: 7500,
      isExclusive: true,
      quantityTotal: 1,
    },
  ],
  contact: {
    email: 'sponsors@ethmilan.xyz',
    telegram: '@ethmilan_sponsors',
  },
};
