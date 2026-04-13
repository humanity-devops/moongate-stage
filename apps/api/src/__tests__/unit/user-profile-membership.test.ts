import { describe, it, expect } from 'vitest';

// User profile & membership management — pure business logic tests
// Mirrors apps/api/src/routes/organizer/users.ts

// ============================================================
// Types
// ============================================================

type MembershipStatus = 'active' | 'invited' | 'suspended' | 'deactivated';
type MembershipEventType = 'role_changed' | 'activated' | 'suspended' | 'deactivated';
type Segment = 'investor' | 'builder' | 'protocol' | 'enterprise' | 'community';

interface UserProfile {
  id: string;
  userId: string;
  tenantId: string;
  bio?: string;
  phone?: string;
  telegram?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  timezone?: string;
  segment?: Segment;
  tags?: string[];
}

interface Membership {
  id: string;
  userId: string;
  tenantId: string;
  role: string;
  status: MembershipStatus;
  isActive: boolean;
  joinedAt: Date;
  createdAt: Date;
}

interface MembershipEvent {
  id: string;
  tenantId: string;
  userId: string;
  actorId: string;
  event: MembershipEventType;
  fromRole?: string | null;
  toRole?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  notes?: string | null;
  createdAt: Date;
}

// ============================================================
// Business logic helpers (mirrors route handler logic)
// ============================================================

// Which event type to emit for a status change
function getMembershipEventType(newStatus: MembershipStatus): MembershipEventType {
  if (newStatus === 'deactivated') return 'deactivated';
  if (newStatus === 'suspended') return 'suspended';
  return 'activated';
}

// Determine which events to create when patching membership
function computeMembershipEvents(
  before: Pick<Membership, 'role' | 'status'>,
  patch: { role?: string; status?: MembershipStatus; notes?: string },
  meta: { tenantId: string; userId: string; actorId: string },
): MembershipEvent[] {
  const events: MembershipEvent[] = [];
  const now = new Date();

  if (patch.role && patch.role !== before.role) {
    events.push({
      id: `evt-role-${Date.now()}`,
      tenantId: meta.tenantId,
      userId: meta.userId,
      actorId: meta.actorId,
      event: 'role_changed',
      fromRole: before.role,
      toRole: patch.role,
      notes: patch.notes ?? null,
      createdAt: now,
    });
  }

  if (patch.status && patch.status !== before.status) {
    events.push({
      id: `evt-status-${Date.now()}`,
      tenantId: meta.tenantId,
      userId: meta.userId,
      actorId: meta.actorId,
      event: getMembershipEventType(patch.status),
      fromStatus: before.status,
      toStatus: patch.status,
      notes: patch.notes ?? null,
      createdAt: now,
    });
  }

  return events;
}

// Profile patch validation (mirrors zod schema)
function validateProfilePatch(body: Record<string, unknown>): { ok: boolean; error?: string } {
  if (body.bio !== undefined && typeof body.bio === 'string' && body.bio.length > 1000) {
    return { ok: false, error: 'bio exceeds 1000 chars' };
  }
  if (body.phone !== undefined && typeof body.phone === 'string' && body.phone.length > 30) {
    return { ok: false, error: 'phone exceeds 30 chars' };
  }
  if (body.website !== undefined && body.website !== '' && typeof body.website === 'string') {
    try { new URL(body.website); } catch { return { ok: false, error: 'website must be a valid URL or empty string' }; }
  }
  const validSegments: Segment[] = ['investor', 'builder', 'protocol', 'enterprise', 'community'];
  if (body.segment !== undefined && !validSegments.includes(body.segment as Segment)) {
    return { ok: false, error: `invalid segment: ${body.segment}` };
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) return { ok: false, error: 'tags must be an array' };
    if ((body.tags as unknown[]).length > 20) return { ok: false, error: 'tags exceeds 20 items' };
  }
  return { ok: true };
}

// Membership status validation
function validateMembershipPatch(body: Record<string, unknown>): { ok: boolean; error?: string } {
  const validStatuses: MembershipStatus[] = ['active', 'invited', 'suspended', 'deactivated'];
  if (body.status !== undefined && !validStatuses.includes(body.status as MembershipStatus)) {
    return { ok: false, error: `invalid status: ${body.status}` };
  }
  if (body.notes !== undefined && typeof body.notes === 'string' && body.notes.length > 500) {
    return { ok: false, error: 'notes exceeds 500 chars' };
  }
  return { ok: true };
}

// Search/filter (mirrors in-memory filter in GET /)
function filterUsers(
  memberships: Array<{ userId: string; role: string; user: { email: string; name?: string } }>,
  search?: string,
  role?: string,
): typeof memberships {
  return memberships.filter(m => {
    if (role && m.role !== role) return false;
    if (search?.trim()) {
      const q = search.toLowerCase();
      if (!m.user.email.toLowerCase().includes(q) && !(m.user.name?.toLowerCase().includes(q) ?? false)) return false;
    }
    return true;
  });
}

// ============================================================
// Test data
// ============================================================

const TENANT = 'tenant-1';
const ACTOR = 'admin-user';

const MEMBERSHIPS = [
  { userId: 'u1', role: 'organizer_owner', user: { email: 'alice@acme.com', name: 'Alice' } },
  { userId: 'u2', role: 'organizer_sales', user: { email: 'bob@acme.com', name: 'Bob Smith' } },
  { userId: 'u3', role: 'organizer_analytics', user: { email: 'carol@acme.com' } },
  { userId: 'u4', role: 'organizer_ops', user: { email: 'dave@acme.com', name: 'Dave' } },
];

const BASE_MEMBERSHIP: Membership = {
  id: 'm1',
  userId: 'u1',
  tenantId: TENANT,
  role: 'organizer_sales',
  status: 'active',
  isActive: true,
  joinedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
};

// ============================================================
// Tests
// ============================================================

describe('User list filtering', () => {
  it('returns all users with no filters', () => {
    expect(filterUsers(MEMBERSHIPS)).toHaveLength(4);
  });

  it('filters by role', () => {
    const result = filterUsers(MEMBERSHIPS, undefined, 'organizer_sales');
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u2');
  });

  it('searches by email (case insensitive)', () => {
    const result = filterUsers(MEMBERSHIPS, 'ALICE');
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u1');
  });

  it('searches by name', () => {
    const result = filterUsers(MEMBERSHIPS, 'smith');
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u2');
  });

  it('returns no results for unmatched search', () => {
    expect(filterUsers(MEMBERSHIPS, 'zzz_nomatch')).toHaveLength(0);
  });

  it('combines role and search filters', () => {
    const result = filterUsers(MEMBERSHIPS, 'dave', 'organizer_ops');
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u4');
  });

  it('ignores whitespace-only search', () => {
    const result = filterUsers(MEMBERSHIPS, '   ');
    expect(result).toHaveLength(4);
  });
});

describe('Membership event generation — role change', () => {
  it('emits role_changed event when role changes', () => {
    const events = computeMembershipEvents(
      { role: 'organizer_sales', status: 'active' },
      { role: 'organizer_ops' },
      { tenantId: TENANT, userId: 'u1', actorId: ACTOR },
    );
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('role_changed');
    expect(events[0].fromRole).toBe('organizer_sales');
    expect(events[0].toRole).toBe('organizer_ops');
  });

  it('does not emit event when role is unchanged', () => {
    const events = computeMembershipEvents(
      { role: 'organizer_sales', status: 'active' },
      { role: 'organizer_sales' },
      { tenantId: TENANT, userId: 'u1', actorId: ACTOR },
    );
    expect(events).toHaveLength(0);
  });

  it('includes actor and tenant info in event', () => {
    const events = computeMembershipEvents(
      { role: 'organizer_viewer', status: 'active' },
      { role: 'organizer_admin' },
      { tenantId: TENANT, userId: 'u1', actorId: ACTOR },
    );
    expect(events[0].actorId).toBe(ACTOR);
    expect(events[0].tenantId).toBe(TENANT);
  });

  it('attaches notes to role_changed event', () => {
    const events = computeMembershipEvents(
      { role: 'organizer_viewer', status: 'active' },
      { role: 'organizer_admin', notes: 'Promoted after review' },
      { tenantId: TENANT, userId: 'u1', actorId: ACTOR },
    );
    expect(events[0].notes).toBe('Promoted after review');
  });
});

describe('Membership event generation — status change', () => {
  it('emits deactivated event when status changes to deactivated', () => {
    const events = computeMembershipEvents(
      { role: 'organizer_ops', status: 'active' },
      { status: 'deactivated' },
      { tenantId: TENANT, userId: 'u1', actorId: ACTOR },
    );
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('deactivated');
    expect(events[0].fromStatus).toBe('active');
    expect(events[0].toStatus).toBe('deactivated');
  });

  it('emits suspended event when status changes to suspended', () => {
    const events = computeMembershipEvents(
      { role: 'organizer_ops', status: 'active' },
      { status: 'suspended' },
      { tenantId: TENANT, userId: 'u1', actorId: ACTOR },
    );
    expect(events[0].event).toBe('suspended');
  });

  it('emits activated event when status changes to active', () => {
    const events = computeMembershipEvents(
      { role: 'organizer_ops', status: 'suspended' },
      { status: 'active' },
      { tenantId: TENANT, userId: 'u1', actorId: ACTOR },
    );
    expect(events[0].event).toBe('activated');
  });

  it('does not emit event when status is unchanged', () => {
    const events = computeMembershipEvents(
      { role: 'organizer_ops', status: 'active' },
      { status: 'active' },
      { tenantId: TENANT, userId: 'u1', actorId: ACTOR },
    );
    expect(events).toHaveLength(0);
  });
});

describe('Membership event generation — combined patch', () => {
  it('emits two events when both role and status change', () => {
    const events = computeMembershipEvents(
      { role: 'organizer_viewer', status: 'active' },
      { role: 'organizer_ops', status: 'invited' },
      { tenantId: TENANT, userId: 'u1', actorId: ACTOR },
    );
    expect(events).toHaveLength(2);
    const types = events.map(e => e.event);
    expect(types).toContain('role_changed');
    expect(types).toContain('activated');
  });

  it('emits no events when patch contains no changes', () => {
    const events = computeMembershipEvents(
      { role: 'organizer_ops', status: 'active' },
      {},
      { tenantId: TENANT, userId: 'u1', actorId: ACTOR },
    );
    expect(events).toHaveLength(0);
  });
});

describe('Profile patch validation', () => {
  it('accepts a valid bio under 1000 chars', () => {
    expect(validateProfilePatch({ bio: 'Hello!' })).toEqual({ ok: true });
  });

  it('rejects bio over 1000 chars', () => {
    const { ok, error } = validateProfilePatch({ bio: 'x'.repeat(1001) });
    expect(ok).toBe(false);
    expect(error).toMatch(/bio/i);
  });

  it('accepts a valid URL for website', () => {
    expect(validateProfilePatch({ website: 'https://example.com' })).toEqual({ ok: true });
  });

  it('accepts empty string for website', () => {
    expect(validateProfilePatch({ website: '' })).toEqual({ ok: true });
  });

  it('rejects an invalid URL for website', () => {
    const { ok, error } = validateProfilePatch({ website: 'not-a-url' });
    expect(ok).toBe(false);
    expect(error).toMatch(/url/i);
  });

  it('accepts valid segment values', () => {
    const segments: Segment[] = ['investor', 'builder', 'protocol', 'enterprise', 'community'];
    for (const s of segments) {
      expect(validateProfilePatch({ segment: s })).toEqual({ ok: true });
    }
  });

  it('rejects unknown segment', () => {
    const { ok } = validateProfilePatch({ segment: 'hacker' });
    expect(ok).toBe(false);
  });

  it('accepts tags array up to 20 items', () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    expect(validateProfilePatch({ tags })).toEqual({ ok: true });
  });

  it('rejects tags array over 20 items', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    const { ok, error } = validateProfilePatch({ tags });
    expect(ok).toBe(false);
    expect(error).toMatch(/20/);
  });

  it('rejects tags that is not an array', () => {
    const { ok } = validateProfilePatch({ tags: 'not-array' });
    expect(ok).toBe(false);
  });

  it('accepts empty patch (all fields optional)', () => {
    expect(validateProfilePatch({})).toEqual({ ok: true });
  });
});

describe('Membership patch validation', () => {
  it('accepts valid statuses', () => {
    const statuses: MembershipStatus[] = ['active', 'invited', 'suspended', 'deactivated'];
    for (const s of statuses) {
      expect(validateMembershipPatch({ status: s })).toEqual({ ok: true });
    }
  });

  it('rejects unknown status', () => {
    const { ok, error } = validateMembershipPatch({ status: 'banned' });
    expect(ok).toBe(false);
    expect(error).toMatch(/invalid status/i);
  });

  it('rejects notes over 500 chars', () => {
    const { ok, error } = validateMembershipPatch({ notes: 'x'.repeat(501) });
    expect(ok).toBe(false);
    expect(error).toMatch(/500/);
  });

  it('accepts notes at exactly 500 chars', () => {
    expect(validateMembershipPatch({ notes: 'x'.repeat(500) })).toEqual({ ok: true });
  });

  it('accepts empty patch (all fields optional)', () => {
    expect(validateMembershipPatch({})).toEqual({ ok: true });
  });
});

describe('getMembershipEventType', () => {
  it('maps deactivated status to deactivated event', () => {
    expect(getMembershipEventType('deactivated')).toBe('deactivated');
  });

  it('maps suspended status to suspended event', () => {
    expect(getMembershipEventType('suspended')).toBe('suspended');
  });

  it('maps active status to activated event', () => {
    expect(getMembershipEventType('active')).toBe('activated');
  });

  it('maps invited status to activated event', () => {
    expect(getMembershipEventType('invited')).toBe('activated');
  });
});
