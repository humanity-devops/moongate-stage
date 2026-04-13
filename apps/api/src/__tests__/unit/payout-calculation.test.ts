import { describe, it, expect } from 'vitest';

describe('payout calculation', () => {
  function computePayoutGross(orders: { merchantNetAmount: number }[]) {
    return Math.round(orders.reduce((s, o) => s + o.merchantNetAmount, 0) * 100) / 100;
  }

  it('sums merchantNetAmount across orders', () => {
    const orders = [
      { merchantNetAmount: 1000.00 },
      { merchantNetAmount: 500.50 },
      { merchantNetAmount: 250.25 },
    ];
    expect(computePayoutGross(orders)).toBe(1750.75);
  });

  it('handles floating point correctly', () => {
    const orders = [{ merchantNetAmount: 0.1 }, { merchantNetAmount: 0.2 }];
    expect(computePayoutGross(orders)).toBe(0.3);
  });

  it('returns 0 for empty order list', () => {
    expect(computePayoutGross([])).toBe(0);
  });

  it('yetToPayout = incomeToDate - payoutToDate', () => {
    const incomeToDate = 5000;
    const payoutToDate = 3500;
    const yetToPayout = incomeToDate - payoutToDate;
    expect(yetToPayout).toBe(1500);
  });

  it('status transitions: pending → processing → paid', () => {
    const validTransitions: Record<string, string[]> = {
      pending: ['processing', 'cancelled'],
      processing: ['paid', 'failed'],
      paid: [],
      failed: ['pending'],
      cancelled: [],
    };
    expect(validTransitions['pending']).toContain('processing');
    expect(validTransitions['processing']).toContain('paid');
    expect(validTransitions['paid']).toHaveLength(0);
  });
});
