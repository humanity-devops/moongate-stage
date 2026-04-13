import { describe, it, expect } from 'vitest';

// ─── Deposit math helpers (mirrors checkout.ts + page.tsx) ─────────────────

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeDeposit(
  listPrice: number,
  depositEnabled: boolean,
  depositPercentage: number,
): { dueNow: number; balanceDue: number } {
  const safeDepositPct = Number.isFinite(depositPercentage) && depositPercentage > 0 ? depositPercentage : 30;
  const dueNow = depositEnabled ? roundMoney((listPrice * safeDepositPct) / 100) : listPrice;
  const balanceDue = roundMoney(listPrice - dueNow);
  return { dueNow, balanceDue };
}

/** Frontend page.tsx calculation (must match server) */
function frontendDueNow(listPrice: number, depositEnabled: boolean, depositPercentage: number): number {
  return depositEnabled
    ? Math.round((listPrice * depositPercentage / 100) * 100) / 100
    : listPrice;
}

// ─── Reminder delay scheduling ──────────────────────────────────────────────

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function computeReminderDelay(finalPaymentDueAt: Date, now = Date.now()): number {
  const dueMs = finalPaymentDueAt.getTime();
  const reminderAt = dueMs - THREE_DAYS_MS;
  return Math.max(ONE_DAY_MS, reminderAt - now);
}

// ─── Order stage transitions ─────────────────────────────────────────────────

type PaymentStage = 'full' | 'deposit' | 'balance';
type OrderStatus = 'pending' | 'payment_pending' | 'partially_paid' | 'paid' | 'cancelled';

function detectPaymentType(
  paymentStage: PaymentStage,
  status: OrderStatus,
  balanceDueAmount: number,
): 'deposit' | 'balance' | 'full' {
  if (paymentStage === 'deposit' && balanceDueAmount > 0) return 'deposit';
  if (paymentStage === 'balance' && status === 'partially_paid') return 'balance';
  return 'full';
}

function nextStatus(current: OrderStatus, paymentType: 'deposit' | 'balance' | 'full'): OrderStatus {
  if (paymentType === 'deposit') return 'partially_paid';
  if (paymentType === 'balance' || paymentType === 'full') return 'paid';
  return current;
}

function nextStage(current: PaymentStage, paymentType: 'deposit' | 'balance' | 'full'): PaymentStage {
  if (paymentType === 'deposit') return 'balance';
  return current;
}

// ─── Route param builder ─────────────────────────────────────────────────────

function checkoutRoute(tenantSlug: string, eventSlug: string, itemSlug: string): string {
  return `/${tenantSlug}/${eventSlug}/checkout/${itemSlug}`;
}

function successRoute(tenantSlug: string, eventSlug: string, orderId: string): string {
  return `/${tenantSlug}/${eventSlug}/checkout/success?order=${orderId}`;
}

function eventRoute(tenantSlug: string, eventSlug: string): string {
  return `/${tenantSlug}/${eventSlug}`;
}

// ═══════════════════════════════════════════════════════════════════════════════

describe('Deposit amount calculations', () => {
  it('returns full price when deposit disabled', () => {
    const { dueNow, balanceDue } = computeDeposit(10000, false, 30);
    expect(dueNow).toBe(10000);
    expect(balanceDue).toBe(0);
  });

  it('computes 30% deposit correctly', () => {
    const { dueNow, balanceDue } = computeDeposit(10000, true, 30);
    expect(dueNow).toBe(3000);
    expect(balanceDue).toBe(7000);
  });

  it('computes 50% deposit correctly', () => {
    const { dueNow, balanceDue } = computeDeposit(8000, true, 50);
    expect(dueNow).toBe(4000);
    expect(balanceDue).toBe(4000);
  });

  it('rounds fractional deposit correctly', () => {
    const { dueNow, balanceDue } = computeDeposit(1000, true, 33);
    expect(dueNow).toBe(330);
    expect(balanceDue).toBe(670);
    expect(dueNow + balanceDue).toBe(1000);
  });

  it('falls back to 30% when percentage is invalid', () => {
    const { dueNow } = computeDeposit(1000, true, 0);
    expect(dueNow).toBe(300); // falls back to 30%
  });

  it('handles 100% deposit (pay now, nothing left)', () => {
    const { dueNow, balanceDue } = computeDeposit(5000, true, 100);
    expect(dueNow).toBe(5000);
    expect(balanceDue).toBe(0);
  });

  it('handles 1% deposit', () => {
    const { dueNow } = computeDeposit(10000, true, 1);
    expect(dueNow).toBe(100);
  });
});

describe('Frontend dueNow matches server calculation', () => {
  it.each([
    [10000, true, 30],
    [10000, true, 50],
    [7500, true, 25],
    [1000, true, 33],
    [10000, false, 30],
  ])('listPrice=%d depositEnabled=%s pct=%d', (listPrice, depositEnabled, pct) => {
    const serverResult = computeDeposit(listPrice, depositEnabled, pct);
    const frontendResult = frontendDueNow(listPrice, depositEnabled, pct);
    expect(frontendResult).toBe(serverResult.dueNow);
  });
});

describe('Payment type detection', () => {
  it('detects deposit payment', () => {
    expect(detectPaymentType('deposit', 'payment_pending', 7000)).toBe('deposit');
  });

  it('detects balance payment', () => {
    expect(detectPaymentType('balance', 'partially_paid', 7000)).toBe('balance');
  });

  it('detects full payment (no deposit)', () => {
    expect(detectPaymentType('full', 'payment_pending', 0)).toBe('full');
  });

  it('ignores balance amount 0 for deposit detection', () => {
    expect(detectPaymentType('deposit', 'payment_pending', 0)).toBe('full');
  });
});

describe('Order status transitions after payment', () => {
  it('deposit → partially_paid, stage → balance', () => {
    const payType = detectPaymentType('deposit', 'payment_pending', 7000);
    expect(nextStatus('payment_pending', payType)).toBe('partially_paid');
    expect(nextStage('deposit', payType)).toBe('balance');
  });

  it('balance payment → paid, stage stays balance', () => {
    const payType = detectPaymentType('balance', 'partially_paid', 7000);
    expect(nextStatus('partially_paid', payType)).toBe('paid');
    expect(nextStage('balance', payType)).toBe('balance');
  });

  it('full payment → paid', () => {
    const payType = detectPaymentType('full', 'payment_pending', 0);
    expect(nextStatus('payment_pending', payType)).toBe('paid');
  });
});

describe('Session expiry should not cancel partially_paid orders', () => {
  it('cancelled status allowed for payment_pending orders', () => {
    // Simulates the guard: don't cancel if partially_paid or paid
    function shouldCancel(status: OrderStatus): boolean {
      return status !== 'paid' && status !== 'partially_paid';
    }
    expect(shouldCancel('payment_pending')).toBe(true);
    expect(shouldCancel('partially_paid')).toBe(false); // deposit is secured
    expect(shouldCancel('paid')).toBe(false);
  });
});

describe('Reminder scheduling', () => {
  it('schedules reminder 3 days before due date', () => {
    const now = new Date('2026-04-08T00:00:00Z').getTime();
    const dueAt = new Date('2026-05-08T00:00:00Z'); // 30 days out
    const delay = computeReminderDelay(dueAt, now);
    const expectedDelay = (30 - 3) * 24 * 60 * 60 * 1000; // 27 days
    expect(delay).toBe(expectedDelay);
  });

  it('minimum delay is 1 day even if due date is imminent', () => {
    const now = new Date('2026-04-08T00:00:00Z').getTime();
    const dueAt = new Date('2026-04-09T00:00:00Z'); // 1 day out — reminder would be in -2 days
    const delay = computeReminderDelay(dueAt, now);
    expect(delay).toBe(ONE_DAY_MS); // clamped to 1 day
  });

  it('minimum delay is 1 day even if due date is past', () => {
    const now = new Date('2026-04-08T00:00:00Z').getTime();
    const dueAt = new Date('2026-04-01T00:00:00Z'); // already past
    const delay = computeReminderDelay(dueAt, now);
    expect(delay).toBe(ONE_DAY_MS);
  });
});

describe('Route param builders', () => {
  it('builds correct checkout route', () => {
    expect(checkoutRoute('ethglobal', 'eth-denver', 'title-sponsor')).toBe(
      '/ethglobal/eth-denver/checkout/title-sponsor',
    );
  });

  it('builds correct success route with orderId', () => {
    expect(successRoute('ethglobal', 'eth-denver', 'ord_123')).toBe(
      '/ethglobal/eth-denver/checkout/success?order=ord_123',
    );
  });

  it('browse event route does NOT include /sponsor suffix', () => {
    const route = eventRoute('ethglobal', 'ethmilan-2025');
    expect(route).toBe('/ethglobal/ethmilan-2025');
    expect(route).not.toContain('/sponsor');
  });
});

describe('Invoice line amounts for balance payment', () => {
  it('balance payment invoice covers full deal value', () => {
    const depositAmount = 3000;
    const balanceAmount = 7000;
    const fullAmount = depositAmount + balanceAmount;

    const lines = [
      { label: 'Package — Deposit (paid)', total: depositAmount },
      { label: 'Package — Final payment', total: balanceAmount },
    ];
    const invoiceTotal = lines.reduce((s, l) => s + l.total, 0);
    expect(invoiceTotal).toBe(fullAmount);
    expect(invoiceTotal).toBe(10000);
  });
});

describe('Deposit config validation (admin portal)', () => {
  function validateDepositConfig(
    depositEnabled: boolean,
    depositPercentage: number,
    finalPaymentDays: number | null,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (depositEnabled) {
      if (!Number.isFinite(depositPercentage) || depositPercentage < 1 || depositPercentage > 100) {
        errors.push('Deposit percentage must be between 1 and 100');
      }
      if (finalPaymentDays !== null && (!Number.isInteger(finalPaymentDays) || finalPaymentDays < 1 || finalPaymentDays > 365)) {
        errors.push('Final payment days must be between 1 and 365');
      }
    }
    return { valid: errors.length === 0, errors };
  }

  it('accepts valid 30% deposit with 14-day reminder', () => {
    expect(validateDepositConfig(true, 30, 14)).toEqual({ valid: true, errors: [] });
  });

  it('rejects 0% deposit percentage', () => {
    const { valid, errors } = validateDepositConfig(true, 0, 14);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/1 and 100/);
  });

  it('rejects 101% deposit percentage', () => {
    expect(validateDepositConfig(true, 101, 14).valid).toBe(false);
  });

  it('accepts disabled deposit with any percentage (percentage ignored)', () => {
    expect(validateDepositConfig(false, 999, null)).toEqual({ valid: true, errors: [] });
  });

  it('accepts null finalPaymentDays (no scheduled reminder)', () => {
    expect(validateDepositConfig(true, 30, null)).toEqual({ valid: true, errors: [] });
  });
});
