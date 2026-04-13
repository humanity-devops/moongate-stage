import { describe, it, expect } from 'vitest';

// ============================================================
// Unit tests for sponsor application business logic
// ============================================================

type ApplicationStatus =
  | 'submitted'
  | 'email_verified'
  | 'approved'
  | 'rejected'
  | 'active';

interface Application {
  id: string;
  email: string;
  name: string;
  status: ApplicationStatus;
  termsAccepted: boolean;
  emailVerifiedAt: Date | null;
  emailVerifyToken: string | null;
  emailVerifyExpiry: Date | null;
}

// Simulate the status transition logic from the API route
function canTransition(current: ApplicationStatus, action: 'approve' | 'reject'): boolean {
  return ['email_verified', 'submitted'].includes(current);
}

function transitionStatus(
  current: ApplicationStatus,
  action: 'approve' | 'reject',
): ApplicationStatus | null {
  if (!canTransition(current, action)) return null;
  return action === 'approve' ? 'approved' : 'rejected';
}

// Simulate consent validation
function validateApplicationInput(data: {
  name: string;
  email: string;
  termsAccepted: boolean;
  role: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data.name || data.name.trim().length < 1) errors.push('Name is required');
  if (!data.email || !data.email.includes('@')) errors.push('Valid email is required');
  if (!data.termsAccepted) errors.push('Terms must be accepted');
  if (!['sponsor', 'both'].includes(data.role)) errors.push('Invalid role');
  return { valid: errors.length === 0, errors };
}

// Simulate idempotency check
function handleReapply(existing: Application | null): {
  shouldResendVerification: boolean;
  shouldReturn: boolean;
  errorMessage?: string;
} {
  if (!existing) return { shouldResendVerification: false, shouldReturn: false };

  if (existing.status === 'active') {
    return {
      shouldResendVerification: false,
      shouldReturn: true,
      errorMessage: 'An account with this email already exists. Please sign in.',
    };
  }

  if (existing.status === 'submitted' && !existing.emailVerifiedAt) {
    return { shouldResendVerification: true, shouldReturn: true };
  }

  return { shouldResendVerification: false, shouldReturn: true };
}

describe('Application status transitions', () => {
  it('submitted → approved transition is allowed', () => {
    expect(canTransition('submitted', 'approve')).toBe(true);
    expect(transitionStatus('submitted', 'approve')).toBe('approved');
  });

  it('submitted → rejected transition is allowed', () => {
    expect(canTransition('submitted', 'reject')).toBe(true);
    expect(transitionStatus('submitted', 'reject')).toBe('rejected');
  });

  it('email_verified → approved transition is allowed', () => {
    expect(canTransition('email_verified', 'approve')).toBe(true);
    expect(transitionStatus('email_verified', 'approve')).toBe('approved');
  });

  it('email_verified → rejected transition is allowed', () => {
    expect(canTransition('email_verified', 'reject')).toBe(true);
    expect(transitionStatus('email_verified', 'reject')).toBe('rejected');
  });

  it('approved cannot be transitioned further', () => {
    expect(canTransition('approved', 'approve')).toBe(false);
    expect(transitionStatus('approved', 'approve')).toBeNull();
  });

  it('rejected cannot be transitioned further', () => {
    expect(canTransition('rejected', 'reject')).toBe(false);
    expect(transitionStatus('rejected', 'reject')).toBeNull();
  });

  it('active cannot be transitioned', () => {
    expect(canTransition('active', 'approve')).toBe(false);
    expect(transitionStatus('active', 'approve')).toBeNull();
  });
});

describe('Consent validation', () => {
  it('accepts valid input with terms accepted', () => {
    const result = validateApplicationInput({
      name: 'Jane Smith',
      email: 'jane@company.com',
      termsAccepted: true,
      role: 'sponsor',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects when termsAccepted is false', () => {
    const result = validateApplicationInput({
      name: 'Jane Smith',
      email: 'jane@company.com',
      termsAccepted: false,
      role: 'sponsor',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Terms must be accepted');
  });

  it('rejects empty name', () => {
    const result = validateApplicationInput({
      name: '',
      email: 'jane@company.com',
      termsAccepted: true,
      role: 'sponsor',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Name is required');
  });

  it('rejects invalid email', () => {
    const result = validateApplicationInput({
      name: 'Jane',
      email: 'not-an-email',
      termsAccepted: true,
      role: 'sponsor',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Valid email is required');
  });

  it('accepts role=both', () => {
    const result = validateApplicationInput({
      name: 'Jane',
      email: 'jane@company.com',
      termsAccepted: true,
      role: 'both',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = validateApplicationInput({
      name: 'Jane',
      email: 'jane@company.com',
      termsAccepted: true,
      role: 'organizer',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid role');
  });
});

describe('Idempotent re-apply behavior', () => {
  it('allows fresh application when no existing record', () => {
    const result = handleReapply(null);
    expect(result.shouldReturn).toBe(false);
    expect(result.shouldResendVerification).toBe(false);
  });

  it('returns conflict error for active account', () => {
    const existing: Application = {
      id: '1',
      email: 'jane@company.com',
      name: 'Jane',
      status: 'active',
      termsAccepted: true,
      emailVerifiedAt: new Date(),
      emailVerifyToken: null,
      emailVerifyExpiry: null,
    };
    const result = handleReapply(existing);
    expect(result.shouldReturn).toBe(true);
    expect(result.errorMessage).toContain('already exists');
  });

  it('re-sends verification for unverified submitted application', () => {
    const existing: Application = {
      id: '1',
      email: 'jane@company.com',
      name: 'Jane',
      status: 'submitted',
      termsAccepted: true,
      emailVerifiedAt: null,
      emailVerifyToken: 'tok123',
      emailVerifyExpiry: new Date(Date.now() + 3600 * 1000),
    };
    const result = handleReapply(existing);
    expect(result.shouldReturn).toBe(true);
    expect(result.shouldResendVerification).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('returns without re-sending for verified applications', () => {
    const existing: Application = {
      id: '1',
      email: 'jane@company.com',
      name: 'Jane',
      status: 'email_verified',
      termsAccepted: true,
      emailVerifiedAt: new Date(),
      emailVerifyToken: null,
      emailVerifyExpiry: null,
    };
    const result = handleReapply(existing);
    expect(result.shouldReturn).toBe(true);
    expect(result.shouldResendVerification).toBe(false);
  });
});
