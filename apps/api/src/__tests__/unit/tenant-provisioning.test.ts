import { describe, it, expect } from 'vitest';

// ============================================================
// Unit tests for tenant provisioning logic
// ============================================================

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'www', 'app', 'mail', 'smtp', 'ftp', 'localhost',
  'moongate', 'platform', 'portal', 'auth', 'login', 'signup', 'join',
  'onboarding', 'settings', 'dashboard', 'browse', 'about', 'help',
  'support', 'billing', 'legal', 'terms', 'privacy', 'blog', 'docs',
]);

function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    return { valid: false, error: 'Slug must be 3–40 lowercase letters, numbers, or hyphens' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, error: 'This slug is reserved' };
  }
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'Slug cannot start or end with a hyphen' };
  }
  return { valid: true };
}

describe('validateSlug — valid slugs', () => {
  it('accepts simple lowercase slug', () => {
    expect(validateSlug('techconf').valid).toBe(true);
  });

  it('accepts slug with hyphens', () => {
    expect(validateSlug('tech-conf-events').valid).toBe(true);
  });

  it('accepts slug with numbers', () => {
    expect(validateSlug('event2025').valid).toBe(true);
  });

  it('accepts minimum length (3 chars)', () => {
    expect(validateSlug('abc').valid).toBe(true);
  });

  it('accepts maximum length (40 chars)', () => {
    expect(validateSlug('a'.repeat(40)).valid).toBe(true);
  });

  it('accepts slug with mixed hyphens and numbers', () => {
    expect(validateSlug('my-event-2025-singapore').valid).toBe(true);
  });
});

describe('validateSlug — invalid slugs', () => {
  it('rejects too short (< 3 chars)', () => {
    const result = validateSlug('ab');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3');
  });

  it('rejects too long (> 40 chars)', () => {
    const result = validateSlug('a'.repeat(41));
    expect(result.valid).toBe(false);
  });

  it('rejects uppercase letters', () => {
    expect(validateSlug('TechConf').valid).toBe(false);
  });

  it('rejects spaces', () => {
    expect(validateSlug('tech conf').valid).toBe(false);
  });

  it('rejects special characters', () => {
    expect(validateSlug('tech_conf').valid).toBe(false);
    expect(validateSlug('tech.conf').valid).toBe(false);
    expect(validateSlug('tech@conf').valid).toBe(false);
  });

  it('rejects slug starting with hyphen', () => {
    const result = validateSlug('-techconf');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hyphen');
  });

  it('rejects slug ending with hyphen', () => {
    const result = validateSlug('techconf-');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hyphen');
  });
});

describe('validateSlug — reserved slugs', () => {
  const reservedSlugs = ['admin', 'api', 'www', 'moongate', 'platform', 'portal',
    'auth', 'login', 'signup', 'join', 'onboarding', 'settings', 'dashboard',
    'browse', 'about', 'help', 'support', 'billing', 'legal', 'terms', 'privacy'];

  for (const slug of reservedSlugs) {
    it(`rejects reserved slug: ${slug}`, () => {
      const result = validateSlug(slug);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reserved');
    });
  }
});

describe('tenant provisioning simulation', () => {
  // Simulate provisionTenant without DB
  interface ProvisionResult {
    success: boolean;
    tenantId?: string;
    error?: string;
  }

  function simulateProvision(params: {
    tenantSlug: string;
    tenantName: string;
    existingSlugs?: string[];
  }): ProvisionResult {
    const validation = validateSlug(params.tenantSlug);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const existingSlugs = params.existingSlugs ?? [];
    if (existingSlugs.includes(params.tenantSlug)) {
      return { success: false, error: 'Organization slug is already taken' };
    }

    // Simulate creating tenant with generated id
    return { success: true, tenantId: `tenant_${Math.random().toString(36).slice(2)}` };
  }

  it('provisions successfully with valid slug', () => {
    const result = simulateProvision({ tenantSlug: 'my-org', tenantName: 'My Org' });
    expect(result.success).toBe(true);
    expect(result.tenantId).toBeDefined();
  });

  it('fails with duplicate slug', () => {
    const result = simulateProvision({
      tenantSlug: 'existing-org',
      tenantName: 'Existing Org',
      existingSlugs: ['existing-org'],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already taken');
  });

  it('fails with reserved slug', () => {
    const result = simulateProvision({ tenantSlug: 'admin', tenantName: 'Admin' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('reserved');
  });

  it('fails with invalid slug format', () => {
    const result = simulateProvision({ tenantSlug: 'My Org!', tenantName: 'My Org' });
    expect(result.success).toBe(false);
  });

  it('creates unique tenant IDs for separate provisions', () => {
    const r1 = simulateProvision({ tenantSlug: 'org-one', tenantName: 'Org One' });
    const r2 = simulateProvision({ tenantSlug: 'org-two', tenantName: 'Org Two' });
    expect(r1.tenantId).not.toBe(r2.tenantId);
  });
});
