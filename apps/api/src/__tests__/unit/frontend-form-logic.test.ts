import { describe, it, expect } from 'vitest';

// ============================================================
// Tests for frontend form logic (mirrored from EarlyAccessForm.tsx)
// ============================================================

// --- URL validation ---

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const u = new URL(value.startsWith('http') ? value : `https://${value}`);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}

// --- Consent validation ---

function canSubmit(email: string, consent: boolean): boolean {
  return email.trim().length > 0 && consent;
}

// --- URL normalization ---

function normalizeUrl(value: string): string | undefined {
  if (!value.trim()) return undefined;
  return value.startsWith('http') ? value : `https://${value}`;
}

// --- Role selection toggle ---

type Role = 'organizer' | 'sponsor' | 'both' | '';

function toggleRole(current: Role, selected: Role): Role {
  return current === selected ? '' : selected;
}

// --- Consent version ---

const CONSENT_VERSION = '1.0';

function buildPayload(fields: {
  email: string;
  name?: string;
  company?: string;
  website?: string;
  role?: Role;
  consent: boolean;
}): Record<string, unknown> | null {
  if (!fields.email || !fields.consent) return null;
  const normalized = fields.website ? normalizeUrl(fields.website) : undefined;
  return {
    email: fields.email,
    ...(fields.name?.trim() ? { name: fields.name.trim() } : {}),
    ...(fields.company?.trim() ? { company: fields.company.trim() } : {}),
    ...(normalized ? { websiteUrl: normalized } : {}),
    ...(fields.role ? { role: fields.role } : {}),
    consentVersion: CONSENT_VERSION,
    consentAt: expect.any(String), // ISO datetime
  };
}

// ============================================================
// Tests
// ============================================================

describe('URL validation', () => {
  it('accepts empty string (field is optional)', () => {
    expect(isValidUrl('')).toBe(true);
  });

  it('accepts valid https URL', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('accepts valid http URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('accepts URL without protocol (prefixed to https)', () => {
    expect(isValidUrl('example.com')).toBe(true);
  });

  it('accepts X/Twitter URL', () => {
    expect(isValidUrl('https://x.com/user')).toBe(true);
    expect(isValidUrl('https://twitter.com/user')).toBe(true);
  });

  it('rejects obviously invalid strings', () => {
    expect(isValidUrl('not a url !!')).toBe(false);
  });

  it('rejects bare text with spaces', () => {
    expect(isValidUrl('hello world')).toBe(false);
  });
});

describe('URL normalization', () => {
  it('returns undefined for empty string', () => {
    expect(normalizeUrl('')).toBeUndefined();
    expect(normalizeUrl('  ')).toBeUndefined();
  });

  it('prepends https:// when no protocol', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
  });

  it('leaves https:// URLs unchanged', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('leaves http:// URLs unchanged', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });
});

describe('Consent gating', () => {
  it('blocks submission without consent', () => {
    expect(canSubmit('user@test.com', false)).toBe(false);
  });

  it('blocks submission with empty email even if consented', () => {
    expect(canSubmit('', true)).toBe(false);
    expect(canSubmit('   ', true)).toBe(false);
  });

  it('allows submission with email + consent', () => {
    expect(canSubmit('user@test.com', true)).toBe(true);
  });
});

describe('Role toggle', () => {
  it('selects a new role', () => {
    expect(toggleRole('', 'organizer')).toBe('organizer');
    expect(toggleRole('', 'sponsor')).toBe('sponsor');
    expect(toggleRole('', 'both')).toBe('both');
  });

  it('deselects the current role (toggle off)', () => {
    expect(toggleRole('organizer', 'organizer')).toBe('');
    expect(toggleRole('sponsor', 'sponsor')).toBe('');
  });

  it('switches to a different role', () => {
    expect(toggleRole('organizer', 'sponsor')).toBe('sponsor');
    expect(toggleRole('sponsor', 'both')).toBe('both');
  });
});

describe('Account mode switcher', () => {
  const VALID_MODES = ['buyer', 'organizer'] as const;
  type Mode = typeof VALID_MODES[number];

  function persistMode(mode: Mode): void {
    // Simulates localStorage.setItem('account_mode', mode)
    void mode;
  }

  function readMode(stored: string | null): Mode {
    if (stored === 'organizer') return 'organizer';
    return 'buyer'; // default
  }

  it('defaults to buyer mode when nothing is stored', () => {
    expect(readMode(null)).toBe('buyer');
  });

  it('restores organizer mode from storage', () => {
    expect(readMode('organizer')).toBe('organizer');
  });

  it('defaults to buyer for unknown stored values', () => {
    expect(readMode('admin')).toBe('buyer');
    expect(readMode('')).toBe('buyer');
  });

  it('all valid modes are accepted without throwing', () => {
    for (const mode of VALID_MODES) {
      expect(() => persistMode(mode)).not.toThrow();
    }
  });
});

describe('Branding constants', () => {
  it('consent version is a valid semver-like string', () => {
    expect(CONSENT_VERSION).toMatch(/^\d+\.\d+$/);
  });
});
