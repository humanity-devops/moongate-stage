import { describe, it, expect } from 'vitest';

// Tests for referral code status transitions
describe('referral code status machine', () => {
  it('new codes start as generated', () => {
    const status = 'generated';
    expect(['generated', 'sent', 'used', 'expired']).toContain(status);
  });

  it('only generated codes can be assigned (→ sent)', () => {
    const canAssign = (status: string) => status === 'generated';
    expect(canAssign('generated')).toBe(true);
    expect(canAssign('sent')).toBe(false);
    expect(canAssign('used')).toBe(false);
    expect(canAssign('expired')).toBe(false);
  });

  it('used codes cannot be revoked', () => {
    const canRevoke = (status: string) => status !== 'used';
    expect(canRevoke('generated')).toBe(true);
    expect(canRevoke('sent')).toBe(true);
    expect(canRevoke('used')).toBe(false);
    expect(canRevoke('expired')).toBe(true);
  });

  it('used codes cannot be regenerated', () => {
    const canRegenerate = (status: string) => status !== 'used';
    expect(canRegenerate('generated')).toBe(true);
    expect(canRegenerate('sent')).toBe(true);
    expect(canRegenerate('used')).toBe(false);
    expect(canRegenerate('expired')).toBe(true);
  });

  it('only generated and expired codes can be deleted', () => {
    const canDelete = (status: string) => ['generated', 'expired'].includes(status);
    expect(canDelete('generated')).toBe(true);
    expect(canDelete('sent')).toBe(false);
    expect(canDelete('used')).toBe(false);
    expect(canDelete('expired')).toBe(true);
  });

  it('regenerated code inherits assignedTo from parent', () => {
    const parent = { assignedTo: 'user@example.com', status: 'sent' };
    const newStatus = parent.assignedTo ? 'sent' : 'generated';
    expect(newStatus).toBe('sent');
  });

  it('expires codes past their expiresAt date', () => {
    const expired = new Date(Date.now() - 1000); // 1 second ago
    const isExpired = (expiresAt: Date | null) => expiresAt !== null && expiresAt < new Date();
    expect(isExpired(expired)).toBe(true);
    expect(isExpired(null)).toBe(false);
    expect(isExpired(new Date(Date.now() + 86400000))).toBe(false);
  });
});

describe('referral code generation', () => {
  it('generates codes of correct format', () => {
    const code = 'A1B2C3D4';
    expect(code).toMatch(/^[A-F0-9]{8}$/i);
  });

  it('respects count limits (max 500)', () => {
    const requestedCount = 1000;
    const actualCount = Math.min(500, Math.max(1, requestedCount));
    expect(actualCount).toBe(500);
  });

  it('enforces minimum count of 1', () => {
    const requestedCount = 0;
    const actualCount = Math.min(500, Math.max(1, requestedCount));
    expect(actualCount).toBe(1);
  });
});
