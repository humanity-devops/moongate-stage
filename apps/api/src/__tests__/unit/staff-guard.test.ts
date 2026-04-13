import { describe, it, expect } from 'vitest';

// Staff-only guard — pure logic tests
// Mirrors requireStaff in apps/api/src/routes/organizer/merchantMembership.ts

type PlatformRole = 'platform_superadmin' | 'platform_ops' | null | undefined;
type OrganizerRole =
  | 'organizer_owner' | 'organizer_admin' | 'organizer_sales' | 'organizer_finance'
  | 'organizer_viewer' | 'organizer_ops' | 'organizer_growth' | 'organizer_analytics'
  | 'organizer_compliance';

interface AuthUser {
  userId: string;
  platformRole?: PlatformRole;
  tenantId?: string | null;
  role?: OrganizerRole;
}

// Mirrors the guard: request.user?.platformRole === 'platform_superadmin'
function isStaff(user: AuthUser | undefined): boolean {
  return user?.platformRole === 'platform_superadmin';
}

// Mirrors requireStaff throwing ForbiddenError
function requireStaff(user: AuthUser | undefined): { allowed: boolean; error?: string } {
  if (!user) return { allowed: false, error: 'Unauthorized' };
  if (!isStaff(user)) return { allowed: false, error: 'Staff-only: platform superadmin required' };
  return { allowed: true };
}

// --- Bulk action validation (mirrors the bulk endpoint schema) ---

type BulkAction = 'mark_reviewed' | 'mark_contacted' | 'archive';

const INTERNAL_STATUS_MAP: Record<BulkAction, string> = {
  mark_reviewed: 'reviewed',
  mark_contacted: 'contacted',
  archive: 'archived',
};

function validateBulkRequest(ids: unknown, action: unknown): { ok: boolean; error?: string } {
  if (!Array.isArray(ids)) return { ok: false, error: 'ids must be an array' };
  if (ids.length === 0) return { ok: false, error: 'ids must contain at least 1 element' };
  if (ids.length > 500) return { ok: false, error: 'ids must contain at most 500 elements' };
  const validActions: BulkAction[] = ['mark_reviewed', 'mark_contacted', 'archive'];
  if (!validActions.includes(action as BulkAction)) return { ok: false, error: `Invalid action: ${action}` };
  return { ok: true };
}

// --- Patch payload validation ---

type InternalStatus = 'new' | 'reviewed' | 'contacted' | 'archived';
type PublicStatus = 'waitlisted' | 'invited' | 'onboarded';

interface PatchPayload {
  internalStatus?: InternalStatus;
  adminNotes?: string;
  status?: PublicStatus;
}

function validatePatch(body: unknown): { ok: boolean; data?: PatchPayload; error?: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Body must be an object' };
  const b = body as Record<string, unknown>;

  const validInternal: InternalStatus[] = ['new', 'reviewed', 'contacted', 'archived'];
  const validPublic: PublicStatus[] = ['waitlisted', 'invited', 'onboarded'];

  if (b.internalStatus !== undefined && !validInternal.includes(b.internalStatus as InternalStatus)) {
    return { ok: false, error: `Invalid internalStatus: ${b.internalStatus}` };
  }
  if (b.status !== undefined && !validPublic.includes(b.status as PublicStatus)) {
    return { ok: false, error: `Invalid status: ${b.status}` };
  }
  if (b.adminNotes !== undefined && typeof b.adminNotes === 'string' && b.adminNotes.length > 5000) {
    return { ok: false, error: 'adminNotes exceeds 5000 characters' };
  }

  return { ok: true, data: { internalStatus: b.internalStatus as InternalStatus, adminNotes: b.adminNotes as string, status: b.status as PublicStatus } };
}

// ============================================================
// Tests
// ============================================================

describe('requireStaff guard', () => {
  it('allows platform_superadmin', () => {
    const user: AuthUser = { userId: 'u1', platformRole: 'platform_superadmin' };
    const { allowed } = requireStaff(user);
    expect(allowed).toBe(true);
  });

  it('rejects platform_ops', () => {
    const user: AuthUser = { userId: 'u2', platformRole: 'platform_ops' };
    const { allowed, error } = requireStaff(user);
    expect(allowed).toBe(false);
    expect(error).toMatch(/staff-only/i);
  });

  it('rejects organizer_owner (no platformRole)', () => {
    const user: AuthUser = { userId: 'u3', tenantId: 'tenant-1', role: 'organizer_owner' };
    const { allowed } = requireStaff(user);
    expect(allowed).toBe(false);
  });

  it('rejects when platformRole is null', () => {
    const user: AuthUser = { userId: 'u4', platformRole: null };
    const { allowed } = requireStaff(user);
    expect(allowed).toBe(false);
  });

  it('rejects when platformRole is undefined', () => {
    const user: AuthUser = { userId: 'u5', platformRole: undefined };
    const { allowed } = requireStaff(user);
    expect(allowed).toBe(false);
  });

  it('rejects when no user is authenticated', () => {
    const { allowed, error } = requireStaff(undefined);
    expect(allowed).toBe(false);
    expect(error).toMatch(/unauthorized/i);
  });

  it('rejects all organizer roles', () => {
    const organizerRoles: OrganizerRole[] = [
      'organizer_owner', 'organizer_admin', 'organizer_sales', 'organizer_finance',
      'organizer_viewer', 'organizer_ops', 'organizer_growth', 'organizer_analytics',
      'organizer_compliance',
    ];
    for (const role of organizerRoles) {
      const user: AuthUser = { userId: 'u', tenantId: 't', role };
      expect(requireStaff(user).allowed).toBe(false);
    }
  });
});

describe('isStaff helper', () => {
  it('returns true only for platform_superadmin', () => {
    expect(isStaff({ userId: 'u', platformRole: 'platform_superadmin' })).toBe(true);
    expect(isStaff({ userId: 'u', platformRole: 'platform_ops' })).toBe(false);
    expect(isStaff({ userId: 'u' })).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
});

describe('Bulk action validation', () => {
  it('accepts valid request with single id', () => {
    const { ok } = validateBulkRequest(['id1'], 'mark_reviewed');
    expect(ok).toBe(true);
  });

  it('accepts valid request with 500 ids', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `id${i}`);
    const { ok } = validateBulkRequest(ids, 'archive');
    expect(ok).toBe(true);
  });

  it('rejects empty ids array', () => {
    const { ok, error } = validateBulkRequest([], 'mark_reviewed');
    expect(ok).toBe(false);
    expect(error).toMatch(/at least 1/i);
  });

  it('rejects 501 ids (over limit)', () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id${i}`);
    const { ok, error } = validateBulkRequest(ids, 'mark_reviewed');
    expect(ok).toBe(false);
    expect(error).toMatch(/at most 500/i);
  });

  it('rejects non-array ids', () => {
    const { ok } = validateBulkRequest('not-an-array', 'mark_reviewed');
    expect(ok).toBe(false);
  });

  it('rejects unknown action', () => {
    const { ok, error } = validateBulkRequest(['id1'], 'delete_all');
    expect(ok).toBe(false);
    expect(error).toMatch(/invalid action/i);
  });

  it('maps actions to correct internal statuses', () => {
    expect(INTERNAL_STATUS_MAP['mark_reviewed']).toBe('reviewed');
    expect(INTERNAL_STATUS_MAP['mark_contacted']).toBe('contacted');
    expect(INTERNAL_STATUS_MAP['archive']).toBe('archived');
  });
});

describe('Patch payload validation', () => {
  it('accepts valid internalStatus', () => {
    const validStatuses: InternalStatus[] = ['new', 'reviewed', 'contacted', 'archived'];
    for (const s of validStatuses) {
      const { ok } = validatePatch({ internalStatus: s });
      expect(ok).toBe(true);
    }
  });

  it('accepts valid public status', () => {
    const validStatuses: PublicStatus[] = ['waitlisted', 'invited', 'onboarded'];
    for (const s of validStatuses) {
      const { ok } = validatePatch({ status: s });
      expect(ok).toBe(true);
    }
  });

  it('rejects unknown internalStatus', () => {
    const { ok, error } = validatePatch({ internalStatus: 'spam' });
    expect(ok).toBe(false);
    expect(error).toMatch(/invalid internalstatus/i);
  });

  it('rejects unknown public status', () => {
    const { ok, error } = validatePatch({ status: 'banned' });
    expect(ok).toBe(false);
    expect(error).toMatch(/invalid status/i);
  });

  it('rejects adminNotes over 5000 chars', () => {
    const { ok, error } = validatePatch({ adminNotes: 'x'.repeat(5001) });
    expect(ok).toBe(false);
    expect(error).toMatch(/5000/);
  });

  it('accepts adminNotes at exactly 5000 chars', () => {
    const { ok } = validatePatch({ adminNotes: 'x'.repeat(5000) });
    expect(ok).toBe(true);
  });

  it('accepts empty patch body (all fields optional)', () => {
    const { ok } = validatePatch({});
    expect(ok).toBe(true);
  });

  it('rejects non-object body', () => {
    const { ok } = validatePatch('not-an-object');
    expect(ok).toBe(false);
  });
});
