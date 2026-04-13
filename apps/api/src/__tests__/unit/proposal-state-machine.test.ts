import { describe, it, expect } from 'vitest';

// Proposal state machine — same shape as bid-transitions.test.ts
const VALID_PROPOSAL_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'accepted', 'rejected'],
  under_review: ['accepted', 'rejected'],
  accepted: [],   // terminal
  rejected: [],   // terminal
};

function canTransition(from: string, to: string): boolean {
  return VALID_PROPOSAL_TRANSITIONS[from]?.includes(to) ?? false;
}

describe('Proposal state transitions', () => {
  it('allows draft → submitted', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
  });

  it('disallows draft → accepted (must be submitted first)', () => {
    expect(canTransition('draft', 'accepted')).toBe(false);
  });

  it('allows submitted → under_review', () => {
    expect(canTransition('submitted', 'under_review')).toBe(true);
  });

  it('allows submitted → accepted (fast track)', () => {
    expect(canTransition('submitted', 'accepted')).toBe(true);
  });

  it('allows submitted → rejected', () => {
    expect(canTransition('submitted', 'rejected')).toBe(true);
  });

  it('allows under_review → accepted', () => {
    expect(canTransition('under_review', 'accepted')).toBe(true);
  });

  it('allows under_review → rejected', () => {
    expect(canTransition('under_review', 'rejected')).toBe(true);
  });

  it('disallows accepted → rejected (terminal state)', () => {
    expect(canTransition('accepted', 'rejected')).toBe(false);
  });

  it('disallows rejected → accepted (terminal state)', () => {
    expect(canTransition('rejected', 'accepted')).toBe(false);
  });

  it('disallows unknown states', () => {
    expect(canTransition('pending', 'accepted')).toBe(false);
    expect(canTransition('submitted', 'unknown')).toBe(false);
  });
});

// Total budget calculation
describe('Proposal budget calculation', () => {
  interface Item { quantity: number; unitPrice: number; }

  function calcTotal(items: Item[]): number {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }

  it('sums single item correctly', () => {
    expect(calcTotal([{ quantity: 2, unitPrice: 5000 }])).toBe(10000);
  });

  it('sums multiple items correctly', () => {
    expect(calcTotal([
      { quantity: 1, unitPrice: 8000 },
      { quantity: 3, unitPrice: 1500 },
      { quantity: 2, unitPrice: 3000 },
    ])).toBe(8000 + 4500 + 6000);
  });

  it('returns 0 for empty items array', () => {
    expect(calcTotal([])).toBe(0);
  });

  it('handles zero-price items', () => {
    expect(calcTotal([{ quantity: 5, unitPrice: 0 }])).toBe(0);
  });
});
