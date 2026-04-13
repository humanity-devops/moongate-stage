/**
 * Tests for bid price validation logic:
 * - min/max bid enforcement on submission
 * - state transition guards (organizer accept/counter)
 * - sponsor accept-counter order creation
 * - seed idempotency for campaigns
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Bid price range validation (mirrors public/bids.ts logic)
// ---------------------------------------------------------------------------

function validateBidBudget(
  proposedBudget: number,
  minimumBid: number | null,
  maximumBid: number | null,
  currency: string,
): { ok: boolean; error?: string } {
  if (minimumBid !== null && proposedBudget < minimumBid) {
    return {
      ok: false,
      error: `Offer amount must be at least ${currency} ${minimumBid.toLocaleString()} for this package`,
    };
  }
  if (maximumBid !== null && proposedBudget > maximumBid) {
    return {
      ok: false,
      error: `Offer amount cannot exceed ${currency} ${maximumBid.toLocaleString()} for this package`,
    };
  }
  return { ok: true };
}

describe('bid price range validation', () => {
  describe('no constraints', () => {
    it('accepts any positive amount when no min/max set', () => {
      expect(validateBidBudget(1, null, null, 'USD').ok).toBe(true);
      expect(validateBidBudget(999999, null, null, 'USD').ok).toBe(true);
    });
  });

  describe('minimumBid only', () => {
    it('accepts budget equal to minimum', () => {
      expect(validateBidBudget(15000, 15000, null, 'USD').ok).toBe(true);
    });
    it('accepts budget above minimum', () => {
      expect(validateBidBudget(20000, 15000, null, 'USD').ok).toBe(true);
    });
    it('rejects budget below minimum', () => {
      const result = validateBidBudget(9999, 15000, null, 'USD');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('15,000');
      expect(result.error).toContain('at least');
    });
  });

  describe('maximumBid only', () => {
    it('accepts budget equal to maximum', () => {
      expect(validateBidBudget(65000, null, 65000, 'USD').ok).toBe(true);
    });
    it('accepts budget below maximum', () => {
      expect(validateBidBudget(40000, null, 65000, 'USD').ok).toBe(true);
    });
    it('rejects budget above maximum', () => {
      const result = validateBidBudget(70000, null, 65000, 'USD');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('65,000');
      expect(result.error).toContain('cannot exceed');
    });
  });

  describe('both min and max set', () => {
    it('accepts budget within range', () => {
      expect(validateBidBudget(40000, 40000, 65000, 'USD').ok).toBe(true);
      expect(validateBidBudget(52000, 40000, 65000, 'USD').ok).toBe(true);
      expect(validateBidBudget(65000, 40000, 65000, 'USD').ok).toBe(true);
    });
    it('rejects budget below minimum', () => {
      const result = validateBidBudget(39999, 40000, 65000, 'USD');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('at least');
    });
    it('rejects budget above maximum', () => {
      const result = validateBidBudget(65001, 40000, 65000, 'USD');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('cannot exceed');
    });
    it('checks minimum before maximum', () => {
      // Edge: amount below both should report minimum violation
      const result = validateBidBudget(100, 40000, 65000, 'USD');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('at least');
    });
  });

  describe('currency formatting in errors', () => {
    it('includes currency code in error', () => {
      const result = validateBidBudget(500, 1000, null, 'EUR');
      expect(result.error).toContain('EUR');
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Bid state transition guards (mirrors organizer/bids.ts logic)
// ---------------------------------------------------------------------------

const TERMINAL_BID_STATES = new Set(['accepted', 'rejected', 'expired', 'withdrawn']);
const COUNTERABLE_STATES = new Set(['submitted', 'under_review', 'countered']);
const ACCEPTABLE_STATES = new Set(['submitted', 'under_review', 'countered']);

function canCounter(bidStatus: string): { allowed: boolean; reason?: string } {
  if (!COUNTERABLE_STATES.has(bidStatus)) {
    return { allowed: false, reason: `Cannot counter a bid in '${bidStatus}' state` };
  }
  return { allowed: true };
}

function canAccept(bidStatus: string): { allowed: boolean; reason?: string } {
  if (!ACCEPTABLE_STATES.has(bidStatus)) {
    return { allowed: false, reason: `Cannot accept a bid in '${bidStatus}' state` };
  }
  return { allowed: true };
}

function canUpdateStatus(currentStatus: string, newStatus: string): { allowed: boolean; reason?: string } {
  if (TERMINAL_BID_STATES.has(currentStatus)) {
    return { allowed: false, reason: `Bid is already in terminal state '${currentStatus}'` };
  }
  if (newStatus === 'accepted') {
    return { allowed: false, reason: 'Use the /accept endpoint to accept a bid' };
  }
  return { allowed: true };
}

describe('organizer bid state transition guards', () => {
  describe('counter-offer', () => {
    it('allows counter on submitted bid', () => {
      expect(canCounter('submitted').allowed).toBe(true);
    });
    it('allows counter on under_review bid', () => {
      expect(canCounter('under_review').allowed).toBe(true);
    });
    it('allows counter on already-countered bid', () => {
      expect(canCounter('countered').allowed).toBe(true);
    });
    it('blocks counter on accepted bid', () => {
      expect(canCounter('accepted').allowed).toBe(false);
    });
    it('blocks counter on rejected bid', () => {
      expect(canCounter('rejected').allowed).toBe(false);
    });
    it('blocks counter on withdrawn bid', () => {
      expect(canCounter('withdrawn').allowed).toBe(false);
    });
  });

  describe('accept', () => {
    it('allows accept on submitted bid', () => {
      expect(canAccept('submitted').allowed).toBe(true);
    });
    it('allows accept on under_review bid', () => {
      expect(canAccept('under_review').allowed).toBe(true);
    });
    it('allows accept on countered bid (organizer can accept after countering)', () => {
      expect(canAccept('countered').allowed).toBe(true);
    });
    it('blocks accept on already-accepted bid', () => {
      expect(canAccept('accepted').allowed).toBe(false);
    });
    it('blocks accept on rejected bid', () => {
      expect(canAccept('rejected').allowed).toBe(false);
    });
  });

  describe('PATCH status guard', () => {
    it('blocks any update on terminal bid', () => {
      for (const terminal of ['accepted', 'rejected', 'expired', 'withdrawn']) {
        expect(canUpdateStatus(terminal, 'under_review').allowed).toBe(false);
      }
    });
    it('blocks direct "accepted" status update (must use /accept endpoint)', () => {
      expect(canUpdateStatus('submitted', 'accepted').allowed).toBe(false);
      expect(canUpdateStatus('under_review', 'accepted').allowed).toBe(false);
    });
    it('allows rejection on non-terminal bid', () => {
      expect(canUpdateStatus('submitted', 'rejected').allowed).toBe(true);
      expect(canUpdateStatus('under_review', 'rejected').allowed).toBe(true);
    });
    it('allows under_review transition', () => {
      expect(canUpdateStatus('submitted', 'under_review').allowed).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Sponsor counter-offer acceptance — order creation logic
// ---------------------------------------------------------------------------

function computeOrderFromCounter(
  bid: { proposedBudget: number; currency: string },
  counter: { offeredPrice: number; currency: string; status: string } | null,
): { ok: boolean; agreedPrice?: number; currency?: string; error?: string } {
  if (!counter || counter.status !== 'pending') {
    return { ok: false, error: 'No pending counter-offer to accept' };
  }
  return {
    ok: true,
    agreedPrice: counter.offeredPrice,
    currency: counter.currency,
  };
}

describe('sponsor accept-counter order creation', () => {
  const bid = { proposedBudget: 25000, currency: 'USD' };

  it('creates order at counter price, not original bid price', () => {
    const counter = { offeredPrice: 30000, currency: 'USD', status: 'pending' };
    const result = computeOrderFromCounter(bid, counter);
    expect(result.ok).toBe(true);
    expect(result.agreedPrice).toBe(30000);
    expect(result.agreedPrice).not.toBe(bid.proposedBudget);
  });

  it('uses counter currency, not bid currency', () => {
    const counter = { offeredPrice: 27500, currency: 'USD', status: 'pending' };
    const result = computeOrderFromCounter(bid, counter);
    expect(result.currency).toBe('USD');
  });

  it('rejects if counter is not pending', () => {
    const counter = { offeredPrice: 30000, currency: 'USD', status: 'accepted' };
    const result = computeOrderFromCounter(bid, counter);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No pending counter-offer');
  });

  it('rejects if no counter exists', () => {
    const result = computeOrderFromCounter(bid, null);
    expect(result.ok).toBe(false);
  });

  it('rejects superseded counter', () => {
    const counter = { offeredPrice: 30000, currency: 'USD', status: 'superseded' };
    const result = computeOrderFromCounter(bid, counter);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Seed idempotency for crowdfunding campaigns
// ---------------------------------------------------------------------------

function getCampaignSeedIds(itemSlugs: string[]): string[] {
  const ids: string[] = [];
  for (const slug of itemSlugs) {
    ids.push(`demo-campaign-${slug}-1`);
    ids.push(`demo-campaign-${slug}-2`);
  }
  return ids;
}

describe('campaign seed idempotency', () => {
  const slugs = ['community-sponsor', 'newsletter-sponsor', 'badge-sponsor'];

  it('generates stable deterministic IDs for each item', () => {
    const ids = getCampaignSeedIds(slugs);
    expect(ids).toHaveLength(6);
    expect(ids).toContain('demo-campaign-community-sponsor-1');
    expect(ids).toContain('demo-campaign-community-sponsor-2');
    expect(ids).toContain('demo-campaign-newsletter-sponsor-1');
    expect(ids).toContain('demo-campaign-badge-sponsor-2');
  });

  it('produces no duplicate IDs', () => {
    const ids = getCampaignSeedIds(slugs);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('produces same IDs on repeated calls (idempotent)', () => {
    const first = getCampaignSeedIds(slugs);
    const second = getCampaignSeedIds(slugs);
    expect(first).toEqual(second);
  });

  it('seeds 2 campaigns per item', () => {
    for (const slug of slugs) {
      const itemIds = getCampaignSeedIds([slug]);
      expect(itemIds).toHaveLength(2);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Package pricing display logic (mirrors BidForm rendering decisions)
// ---------------------------------------------------------------------------

function getPriceRangeLabel(
  minimumBid: number | null,
  maximumBid: number | null,
  currency: string,
  fmt: (n: number) => string,
): string | null {
  if (minimumBid !== null && maximumBid !== null) {
    return `Accepted range: ${fmt(minimumBid)} – ${fmt(maximumBid)}`;
  }
  if (minimumBid !== null) {
    return `Minimum offer: ${fmt(minimumBid)}`;
  }
  if (maximumBid !== null) {
    return `Maximum offer: ${fmt(maximumBid)}`;
  }
  return null;
}

const fmt = (n: number) => `$${n.toLocaleString()}`;

describe('price range display label', () => {
  it('returns null when no constraints', () => {
    expect(getPriceRangeLabel(null, null, 'USD', fmt)).toBeNull();
  });
  it('shows range when both set', () => {
    const label = getPriceRangeLabel(40000, 65000, 'USD', fmt);
    expect(label).toContain('Accepted range');
    expect(label).toContain('40,000');
    expect(label).toContain('65,000');
  });
  it('shows minimum only label', () => {
    const label = getPriceRangeLabel(15000, null, 'USD', fmt);
    expect(label).toContain('Minimum offer');
    expect(label).toContain('15,000');
    expect(label).not.toContain('Maximum');
  });
  it('shows maximum only label', () => {
    const label = getPriceRangeLabel(null, 100000, 'USD', fmt);
    expect(label).toContain('Maximum offer');
    expect(label).toContain('100,000');
    expect(label).not.toContain('Minimum');
  });
});
