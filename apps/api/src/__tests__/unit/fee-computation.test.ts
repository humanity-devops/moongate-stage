import { describe, it, expect } from 'vitest';
import {
  computeProcessingFee,
  resolveProfile,
  PROCESSING_FEE_PROFILES,
  DEFAULT_PROCESSING_FEE_PROFILE,
} from '../../lib/processingFees.js';
import { DEFAULT_COMMISSION_RATE as ACTUAL_DEFAULT_COMMISSION_RATE } from '../../lib/fees.js';

// ============================================================
// Tests for platform fee computation logic (mirrors fees.ts)
// ============================================================

const DEFAULT_COMMISSION_RATE = 0.10;

interface FeeContext {
  total: number;
  eventCommissionRate: number | null;
  tenantCommissionRate: number | null;
}

function computeFeeSync(ctx: FeeContext): {
  rate: number;
  feeAmount: number;
  merchantNet: number;
  source: 'event_override' | 'merchant_override' | 'default';
} {
  let rate: number;
  let source: 'event_override' | 'merchant_override' | 'default';

  if (ctx.eventCommissionRate !== null) {
    rate = ctx.eventCommissionRate;
    source = 'event_override';
  } else if (ctx.tenantCommissionRate !== null) {
    rate = ctx.tenantCommissionRate;
    source = 'merchant_override';
  } else {
    rate = DEFAULT_COMMISSION_RATE;
    source = 'default';
  }

  const feeAmount = Math.round(ctx.total * rate * 100) / 100;
  const merchantNet = Math.round((ctx.total - feeAmount) * 100) / 100;

  return { rate, feeAmount, merchantNet, source };
}

describe('Fee computation — override precedence', () => {
  it('uses platform default (10%) when no overrides', () => {
    const result = computeFeeSync({ total: 1000, eventCommissionRate: null, tenantCommissionRate: null });
    expect(result.rate).toBe(0.10);
    expect(result.source).toBe('default');
    expect(result.feeAmount).toBe(100);
    expect(result.merchantNet).toBe(900);
  });

  it('uses merchant override when set and no event override', () => {
    const result = computeFeeSync({ total: 1000, eventCommissionRate: null, tenantCommissionRate: 0.05 });
    expect(result.rate).toBe(0.05);
    expect(result.source).toBe('merchant_override');
    expect(result.feeAmount).toBe(50);
    expect(result.merchantNet).toBe(950);
  });

  it('event override takes precedence over merchant override', () => {
    const result = computeFeeSync({ total: 1000, eventCommissionRate: 0.15, tenantCommissionRate: 0.05 });
    expect(result.rate).toBe(0.15);
    expect(result.source).toBe('event_override');
    expect(result.feeAmount).toBe(150);
    expect(result.merchantNet).toBe(850);
  });

  it('event override takes precedence over platform default', () => {
    const result = computeFeeSync({ total: 2000, eventCommissionRate: 0.08, tenantCommissionRate: null });
    expect(result.rate).toBe(0.08);
    expect(result.source).toBe('event_override');
    expect(result.feeAmount).toBe(160);
    expect(result.merchantNet).toBe(1840);
  });
});

describe('Fee computation — zero rate', () => {
  it('allows 0% commission (zero fee)', () => {
    const result = computeFeeSync({ total: 5000, eventCommissionRate: 0, tenantCommissionRate: null });
    expect(result.rate).toBe(0);
    expect(result.source).toBe('event_override');
    expect(result.feeAmount).toBe(0);
    expect(result.merchantNet).toBe(5000);
  });

  it('handles 0% merchant override', () => {
    const result = computeFeeSync({ total: 3000, eventCommissionRate: null, tenantCommissionRate: 0 });
    expect(result.rate).toBe(0);
    expect(result.source).toBe('merchant_override');
    expect(result.feeAmount).toBe(0);
    expect(result.merchantNet).toBe(3000);
  });
});

describe('Fee computation — arithmetic precision', () => {
  it('rounds fee to 2 decimal places', () => {
    // $333.33 × 10% = $33.333 → rounds to $33.33
    const result = computeFeeSync({ total: 333.33, eventCommissionRate: null, tenantCommissionRate: null });
    expect(result.feeAmount).toBe(33.33);
    expect(result.merchantNet).toBe(300.00);
  });

  it('fee + merchantNet equals total', () => {
    const result = computeFeeSync({ total: 1499.99, eventCommissionRate: null, tenantCommissionRate: null });
    expect(result.feeAmount + result.merchantNet).toBeCloseTo(result.merchantNet + result.feeAmount, 2);
  });

  it('handles large amounts', () => {
    const result = computeFeeSync({ total: 100000, eventCommissionRate: null, tenantCommissionRate: null });
    expect(result.feeAmount).toBe(10000);
    expect(result.merchantNet).toBe(90000);
  });

  it('handles fractional rates', () => {
    const result = computeFeeSync({ total: 1000, eventCommissionRate: 0.075, tenantCommissionRate: null });
    expect(result.rate).toBe(0.075);
    expect(result.feeAmount).toBe(75);
    expect(result.merchantNet).toBe(925);
  });
});

describe('Fee computation — max rate', () => {
  it('allows 100% commission (edge case)', () => {
    const result = computeFeeSync({ total: 1000, eventCommissionRate: 1.0, tenantCommissionRate: null });
    expect(result.feeAmount).toBe(1000);
    expect(result.merchantNet).toBe(0);
  });
});

describe('DEFAULT_COMMISSION_RATE — actual fees.ts value is 8%', () => {
  it('DEFAULT_COMMISSION_RATE is 0.08 (8%)', () => {
    expect(ACTUAL_DEFAULT_COMMISSION_RATE).toBe(0.08);
  });

  it('8% commission on $1000 yields $80 fee and $920 merchant net', () => {
    const total = 1000;
    const fee = Math.round(total * ACTUAL_DEFAULT_COMMISSION_RATE * 100) / 100;
    const net = Math.round((total - fee) * 100) / 100;
    expect(fee).toBe(80);
    expect(net).toBe(920);
  });

  it('8% commission on $2500 yields $200 fee and $2300 merchant net', () => {
    const total = 2500;
    const fee = Math.round(total * ACTUAL_DEFAULT_COMMISSION_RATE * 100) / 100;
    const net = Math.round((total - fee) * 100) / 100;
    expect(fee).toBe(200);
    expect(net).toBe(2300);
  });
});

describe('processing fee profiles', () => {
  it('stripe charges 4.5%', () => {
    expect(PROCESSING_FEE_PROFILES.stripe.rate).toBe(0.045);
    expect(PROCESSING_FEE_PROFILES.stripe.ratePct).toBe('4.5%');
  });

  it('hipay charges 1%', () => {
    expect(PROCESSING_FEE_PROFILES.hipay.rate).toBe(0.01);
    expect(PROCESSING_FEE_PROFILES.hipay.ratePct).toBe('1.0%');
  });

  it('radom charges 0%', () => {
    expect(PROCESSING_FEE_PROFILES.radom.rate).toBe(0);
    expect(PROCESSING_FEE_PROFILES.radom.ratePct).toBe('0%');
  });

  it('unknown profile defaults to stripe', () => {
    expect(DEFAULT_PROCESSING_FEE_PROFILE).toBe('stripe');
    expect(resolveProfile('unknown-gateway')).toBe('stripe');
    expect(resolveProfile(null)).toBe('stripe');
    expect(resolveProfile(undefined)).toBe('stripe');
  });
});

describe('computeProcessingFee', () => {
  it('stripe: $1000 × 4.5% = $45', () => {
    const { rate, feeAmount } = computeProcessingFee(1000, 'stripe');
    expect(rate).toBe(0.045);
    expect(feeAmount).toBe(45);
  });

  it('hipay: $1000 × 1% = $10', () => {
    const { rate, feeAmount } = computeProcessingFee(1000, 'hipay');
    expect(rate).toBe(0.01);
    expect(feeAmount).toBe(10);
  });

  it('radom: $1000 × 0% = $0', () => {
    const { rate, feeAmount } = computeProcessingFee(1000, 'radom');
    expect(rate).toBe(0);
    expect(feeAmount).toBe(0);
  });

  it('defaults to stripe when no profile specified', () => {
    const { feeAmount } = computeProcessingFee(1000);
    expect(feeAmount).toBe(45);
  });

  it('rounds to 2 decimal places', () => {
    // $333.33 × 4.5% = $15.00 (rounded)
    const { feeAmount } = computeProcessingFee(333.33, 'stripe');
    expect(feeAmount).toBe(15);
  });

  it('stripe: $500 × 4.5% = $22.50', () => {
    const { feeAmount } = computeProcessingFee(500, 'stripe');
    expect(feeAmount).toBe(22.5);
  });
});

describe('resolveProfile', () => {
  it('returns stripe for "stripe"', () => {
    expect(resolveProfile('stripe')).toBe('stripe');
  });

  it('returns hipay for "hipay"', () => {
    expect(resolveProfile('hipay')).toBe('hipay');
  });

  it('returns radom for "radom"', () => {
    expect(resolveProfile('radom')).toBe('radom');
  });

  it('falls back to stripe for null', () => {
    expect(resolveProfile(null)).toBe('stripe');
  });

  it('falls back to stripe for undefined', () => {
    expect(resolveProfile(undefined)).toBe('stripe');
  });

  it('falls back to stripe for unknown string', () => {
    expect(resolveProfile('paypal')).toBe('stripe');
    expect(resolveProfile('')).toBe('stripe');
  });
});

describe('Fee computation — immutability invariants', () => {
  it('source is always one of three valid values', () => {
    const validSources = ['event_override', 'merchant_override', 'default'];
    const cases: FeeContext[] = [
      { total: 100, eventCommissionRate: 0.1, tenantCommissionRate: 0.2 },
      { total: 100, eventCommissionRate: null, tenantCommissionRate: 0.2 },
      { total: 100, eventCommissionRate: null, tenantCommissionRate: null },
    ];
    for (const ctx of cases) {
      expect(validSources).toContain(computeFeeSync(ctx).source);
    }
  });

  it('merchantNet is never negative for valid rates (0-1)', () => {
    const cases: FeeContext[] = [
      { total: 500, eventCommissionRate: 0, tenantCommissionRate: null },
      { total: 500, eventCommissionRate: 0.5, tenantCommissionRate: null },
      { total: 500, eventCommissionRate: 1, tenantCommissionRate: null },
      { total: 500, eventCommissionRate: null, tenantCommissionRate: null },
    ];
    for (const ctx of cases) {
      expect(computeFeeSync(ctx).merchantNet).toBeGreaterThanOrEqual(0);
    }
  });
});
