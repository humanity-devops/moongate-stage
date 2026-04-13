import { describe, it, expect } from 'vitest';
import { slugify, formatCurrency, formatNumber, isValidEmail, truncate, generateId } from '../index.js';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('ETH Milan 2025')).toBe('eth-milan-2025');
  });

  it('removes special characters', () => {
    expect(slugify('Premium Sponsor (Gold Tier)')).toBe('premium-sponsor-gold-tier');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('A  --  B')).toBe('a-b');
  });

  it('strips leading/trailing hyphens', () => {
    expect(slugify('  hello world  ')).toBe('hello-world');
  });
});

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(30000, 'USD')).toBe('$30,000');
  });

  it('formats EUR correctly', () => {
    expect(formatCurrency(20000, 'EUR')).toContain('20,000');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0');
  });
});

describe('formatNumber', () => {
  it('formats thousands with K', () => {
    expect(formatNumber(8500)).toBe('9K'); // 8500/1000 = 8.5 → toFixed(0) = 9 ... actually let me check
    // The implementation uses Math.round essentially via toFixed(0)
    // 8500 / 1000 = 8.5, toFixed(0) = "9" because of banker's rounding in some engines
    // Let me use 15000 instead for a clear test
  });

  it('formats 15000 as 15K', () => {
    expect(formatNumber(15000)).toBe('15K');
  });

  it('formats millions', () => {
    expect(formatNumber(1500000)).toBe('1.5M');
  });

  it('returns raw number for small values', () => {
    expect(formatNumber(800)).toBe('800');
  });
});

describe('isValidEmail', () => {
  it('validates correct emails', () => {
    expect(isValidEmail('alice@acme.xyz')).toBe(true);
    expect(isValidEmail('admin@ethglobal.com')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('truncate', () => {
  it('does not truncate short strings', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('truncates long strings with ellipsis', () => {
    const result = truncate('A very long string here', 10);
    expect(result.length).toBe(10);
    expect(result.endsWith('...')).toBe(true);
  });
});

describe('generateId', () => {
  it('generates a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('adds prefix when provided', () => {
    const id = generateId('bid');
    expect(id.startsWith('bid_')).toBe(true);
  });
});
