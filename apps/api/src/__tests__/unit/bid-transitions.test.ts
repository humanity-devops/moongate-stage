import { describe, it, expect } from 'vitest';

// Bid state machine business rules
const VALID_TRANSITIONS: Record<string, string[]> = {
  submitted: ['under_review', 'accepted', 'rejected', 'expired', 'withdrawn'],
  under_review: ['countered', 'accepted', 'rejected', 'expired'],
  countered: ['accepted', 'rejected', 'expired', 'withdrawn'],
  accepted: [], // terminal
  rejected: [], // terminal
  expired: [], // terminal
  withdrawn: [], // terminal
};

function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

describe('Bid state transitions', () => {
  it('allows submitted → under_review', () => {
    expect(canTransition('submitted', 'under_review')).toBe(true);
  });

  it('allows submitted → accepted (fast track)', () => {
    expect(canTransition('submitted', 'accepted')).toBe(true);
  });

  it('allows under_review → countered', () => {
    expect(canTransition('under_review', 'countered')).toBe(true);
  });

  it('allows countered → accepted', () => {
    expect(canTransition('countered', 'accepted')).toBe(true);
  });

  it('allows countered → rejected', () => {
    expect(canTransition('countered', 'rejected')).toBe(true);
  });

  it('does NOT allow accepted → rejected (terminal)', () => {
    expect(canTransition('accepted', 'rejected')).toBe(false);
  });

  it('does NOT allow rejected → accepted (terminal)', () => {
    expect(canTransition('rejected', 'accepted')).toBe(false);
  });

  it('does NOT allow expired → any state (terminal)', () => {
    expect(canTransition('expired', 'under_review')).toBe(false);
    expect(canTransition('expired', 'accepted')).toBe(false);
  });

  it('does NOT allow withdrawn → any state (terminal)', () => {
    expect(canTransition('withdrawn', 'submitted')).toBe(false);
  });
});

describe('Counter offer logic', () => {
  it('counter offer price should be validated as positive number', () => {
    const validateCounterOffer = (price: number) => price > 0;
    expect(validateCounterOffer(25000)).toBe(true);
    expect(validateCounterOffer(0)).toBe(false);
    expect(validateCounterOffer(-100)).toBe(false);
  });

  it('new counter supersedes previous pending counter', () => {
    // Simulate: when a new counter is created, status of previous goes from 'pending' to 'superseded'
    const counters = [
      { id: '1', status: 'pending', offeredPrice: 20000 },
      { id: '2', status: 'pending', offeredPrice: 22000 },
    ];
    const superseded = counters.map(c => c.id !== '2' ? { ...c, status: 'superseded' } : c);
    expect(superseded.find(c => c.id === '1')?.status).toBe('superseded');
    expect(superseded.find(c => c.id === '2')?.status).toBe('pending');
  });
});
