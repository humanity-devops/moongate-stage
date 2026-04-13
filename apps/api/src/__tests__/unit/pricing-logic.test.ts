import { describe, it, expect } from 'vitest';

// Pricing and availability logic
function calculateInventoryAvailable(
  quantityTotal: number | null,
  quantitySold: number,
  quantityReserved: number,
): number | null {
  if (quantityTotal === null) return null; // unlimited
  return Math.max(0, quantityTotal - quantitySold - quantityReserved);
}

function isAvailable(
  status: string,
  quantityTotal: number | null,
  quantitySold: number,
  quantityReserved: number,
): boolean {
  if (status !== 'published') return false;
  const avail = calculateInventoryAvailable(quantityTotal, quantitySold, quantityReserved);
  if (avail === null) return true; // unlimited
  return avail > 0;
}

function isSoldOut(
  quantityTotal: number | null,
  quantitySold: number,
  quantityReserved: number,
): boolean {
  if (quantityTotal === null) return false;
  return quantitySold >= quantityTotal;
}

function isLimitedAvailability(
  quantityTotal: number | null,
  quantitySold: number,
  quantityReserved: number,
  threshold = 2,
): boolean {
  const avail = calculateInventoryAvailable(quantityTotal, quantitySold, quantityReserved);
  if (avail === null) return false;
  return avail <= threshold && avail > 0;
}

describe('Inventory calculations', () => {
  it('returns null for unlimited items', () => {
    expect(calculateInventoryAvailable(null, 0, 0)).toBeNull();
  });

  it('calculates remaining correctly', () => {
    expect(calculateInventoryAvailable(5, 2, 1)).toBe(2); // 5 - 2 - 1 = 2
  });

  it('never returns negative remaining', () => {
    expect(calculateInventoryAvailable(3, 5, 0)).toBe(0);
  });

  it('returns 0 when fully sold and reserved', () => {
    expect(calculateInventoryAvailable(3, 2, 1)).toBe(0);
  });
});

describe('Availability check', () => {
  it('unpublished items are not available', () => {
    expect(isAvailable('draft', null, 0, 0)).toBe(false);
    expect(isAvailable('archived', null, 0, 0)).toBe(false);
  });

  it('unlimited published items are available', () => {
    expect(isAvailable('published', null, 0, 0)).toBe(true);
  });

  it('published item with stock remaining is available', () => {
    expect(isAvailable('published', 5, 2, 1)).toBe(true);
  });

  it('published item with no stock is not available', () => {
    expect(isAvailable('published', 3, 3, 0)).toBe(false);
  });
});

describe('Sold out detection', () => {
  it('item is sold out when sold >= total', () => {
    expect(isSoldOut(3, 3, 0)).toBe(true);
    expect(isSoldOut(3, 4, 0)).toBe(true); // shouldn't happen but handles it
  });

  it('item is not sold out when stock remains', () => {
    expect(isSoldOut(3, 2, 0)).toBe(false);
  });

  it('unlimited items are never sold out', () => {
    expect(isSoldOut(null, 1000, 0)).toBe(false);
  });
});

describe('Limited availability', () => {
  it('flags items with <= 2 remaining as limited', () => {
    expect(isLimitedAvailability(5, 3, 0)).toBe(true); // 2 left
    expect(isLimitedAvailability(5, 4, 0)).toBe(true); // 1 left
  });

  it('does not flag items with > 2 remaining', () => {
    expect(isLimitedAvailability(5, 1, 0)).toBe(false); // 4 left
    expect(isLimitedAvailability(5, 2, 0)).toBe(false); // 3 left
  });

  it('does not flag sold out items as limited', () => {
    expect(isLimitedAvailability(5, 5, 0)).toBe(false);
  });

  it('does not flag unlimited items as limited', () => {
    expect(isLimitedAvailability(null, 0, 0)).toBe(false);
  });
});
