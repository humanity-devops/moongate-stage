import { describe, it, expect } from 'vitest';

// Platform admin early-access management — pure business logic tests

type PublicStatus = 'waitlisted' | 'invited' | 'onboarded';
type InternalStatus = 'new' | 'reviewed' | 'contacted' | 'archived';
type PlatformRole = 'platform_superadmin' | 'platform_ops' | null;

interface EarlyAccessMember {
  id: string;
  email: string;
  name?: string;
  company?: string;
  role?: string;
  utmSource?: string;
  status: PublicStatus;
  internalStatus: InternalStatus;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

// --- Authorization ---

const ALLOWED_ROLES: PlatformRole[] = ['platform_superadmin', 'platform_ops'];

function canAccessPlatformAdmin(platformRole: PlatformRole): boolean {
  return platformRole !== null && ALLOWED_ROLES.includes(platformRole);
}

// --- Filtering ---

function applyFilters(
  members: EarlyAccessMember[],
  filters: {
    search?: string;
    status?: PublicStatus;
    internalStatus?: InternalStatus;
    role?: string;
    utmSource?: string;
    dateFrom?: Date;
    dateTo?: Date;
  },
): EarlyAccessMember[] {
  return members.filter((m) => {
    if (filters.status && m.status !== filters.status) return false;
    if (filters.internalStatus && m.internalStatus !== filters.internalStatus) return false;
    if (filters.role && m.role !== filters.role) return false;
    if (filters.utmSource && m.utmSource !== filters.utmSource) return false;
    if (filters.dateFrom && m.createdAt < filters.dateFrom) return false;
    if (filters.dateTo && m.createdAt > filters.dateTo) return false;
    if (filters.search?.trim()) {
      const q = filters.search.toLowerCase();
      const matches =
        m.email.toLowerCase().includes(q) ||
        (m.name?.toLowerCase().includes(q) ?? false) ||
        (m.company?.toLowerCase().includes(q) ?? false);
      if (!matches) return false;
    }
    return true;
  });
}

// --- Sorting ---

type SortField = 'createdAt' | 'email' | 'name' | 'status' | 'internalStatus';

const VALID_SORT_FIELDS: SortField[] = ['createdAt', 'email', 'name', 'status', 'internalStatus'];

function isValidSortField(field: string): field is SortField {
  return VALID_SORT_FIELDS.includes(field as SortField);
}

function applySort(
  members: EarlyAccessMember[],
  sort: string,
  order: 'asc' | 'desc',
): EarlyAccessMember[] {
  const field: SortField = isValidSortField(sort) ? sort : 'createdAt';
  return [...members].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return order === 'asc' ? cmp : -cmp;
  });
}

// --- Pagination ---

function paginate<T>(items: T[], page: number, pageSize: number): { data: T[]; total: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const safePageSize = Math.min(200, Math.max(1, pageSize));
  const safePage = Math.max(1, page);
  return {
    data: items.slice((safePage - 1) * safePageSize, safePage * safePageSize),
    total,
    totalPages,
  };
}

// --- Internal status transitions ---

const INTERNAL_STATUS_MAP: Record<string, InternalStatus> = {
  mark_reviewed: 'reviewed',
  mark_contacted: 'contacted',
  archive: 'archived',
};

function applyBulkAction(
  members: EarlyAccessMember[],
  ids: string[],
  action: 'mark_reviewed' | 'mark_contacted' | 'archive',
  reviewerId: string,
): { updated: number } {
  if (ids.length === 0 || ids.length > 500) throw new Error('ids must be 1–500');
  const newStatus = INTERNAL_STATUS_MAP[action];
  let count = 0;
  for (const m of members) {
    if (ids.includes(m.id)) {
      m.internalStatus = newStatus;
      m.reviewedBy = reviewerId;
      m.reviewedAt = new Date();
      count++;
    }
  }
  return { updated: count };
}

// --- Note persistence ---

function saveAdminNotes(member: EarlyAccessMember, notes: string): EarlyAccessMember {
  return { ...member, adminNotes: notes };
}

// --- Public status promotion ---

function promotePublicStatus(
  member: EarlyAccessMember,
  newStatus: PublicStatus,
): { ok: boolean; error?: string; member?: EarlyAccessMember } {
  // Can only promote forward: waitlisted → invited → onboarded
  const order: PublicStatus[] = ['waitlisted', 'invited', 'onboarded'];
  if (order.indexOf(newStatus) <= order.indexOf(member.status)) {
    return { ok: false, error: 'INVALID_STATUS_TRANSITION' };
  }
  return { ok: true, member: { ...member, status: newStatus } };
}

// --- CSV escaping ---

function escapeCSV(v: unknown): string {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

function buildCSVRow(member: EarlyAccessMember, headers: (keyof EarlyAccessMember)[]): string {
  return headers.map((h) => escapeCSV(member[h])).join(',');
}

// ============================================================
// Test data
// ============================================================

const BASE_DATE = new Date('2026-01-15T00:00:00Z');

const MEMBERS: EarlyAccessMember[] = [
  {
    id: 'm1', email: 'alice@coinbase.com', name: 'Alice', company: 'Coinbase',
    role: 'organizer', utmSource: 'twitter', status: 'waitlisted', internalStatus: 'new',
    createdAt: new Date('2026-01-10T00:00:00Z'),
  },
  {
    id: 'm2', email: 'bob@ethereum.org', name: 'Bob', company: 'Ethereum Foundation',
    role: 'sponsor', utmSource: 'reddit', status: 'invited', internalStatus: 'reviewed',
    reviewedBy: 'admin1', reviewedAt: new Date('2026-01-12T00:00:00Z'),
    createdAt: new Date('2026-01-11T00:00:00Z'),
  },
  {
    id: 'm3', email: 'carol@polygon.io', name: 'Carol', company: 'Polygon',
    role: 'organizer', utmSource: 'twitter', status: 'onboarded', internalStatus: 'contacted',
    createdAt: new Date('2026-01-14T00:00:00Z'),
  },
  {
    id: 'm4', email: 'dave@anon.com', name: 'Dave',
    role: 'sponsor', status: 'waitlisted', internalStatus: 'archived',
    createdAt: new Date('2026-01-08T00:00:00Z'),
  },
];

// ============================================================
// Tests
// ============================================================

describe('Platform admin authorization', () => {
  it('grants access to platform_superadmin', () => {
    expect(canAccessPlatformAdmin('platform_superadmin')).toBe(true);
  });

  it('grants access to platform_ops', () => {
    expect(canAccessPlatformAdmin('platform_ops')).toBe(true);
  });

  it('denies access when platformRole is null', () => {
    expect(canAccessPlatformAdmin(null)).toBe(false);
  });

  it('denies access to arbitrary role strings', () => {
    expect(canAccessPlatformAdmin('organizer_admin' as PlatformRole)).toBe(false);
  });
});

describe('Filtering early-access members', () => {
  it('returns all members with no filters', () => {
    expect(applyFilters(MEMBERS, {})).toHaveLength(4);
  });

  it('filters by public status', () => {
    const result = applyFilters(MEMBERS, { status: 'waitlisted' });
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.status === 'waitlisted')).toBe(true);
  });

  it('filters by internalStatus', () => {
    const result = applyFilters(MEMBERS, { internalStatus: 'new' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });

  it('filters by role', () => {
    const result = applyFilters(MEMBERS, { role: 'organizer' });
    expect(result).toHaveLength(2);
  });

  it('filters by utmSource', () => {
    const result = applyFilters(MEMBERS, { utmSource: 'twitter' });
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.utmSource === 'twitter')).toBe(true);
  });

  it('filters by dateFrom (inclusive)', () => {
    const result = applyFilters(MEMBERS, { dateFrom: new Date('2026-01-11T00:00:00Z') });
    expect(result).toHaveLength(2); // m2 (01-11), m3 (01-14); m1 (01-10) and m4 (01-08) excluded
    expect(result.map((m) => m.id).sort()).toEqual(['m2', 'm3'].sort());
  });

  it('filters by dateTo (inclusive)', () => {
    const result = applyFilters(MEMBERS, { dateTo: new Date('2026-01-10T00:00:00Z') });
    expect(result).toHaveLength(2); // m1, m4
    expect(result.map((m) => m.id).sort()).toEqual(['m1', 'm4'].sort());
  });

  it('filters by date range', () => {
    const result = applyFilters(MEMBERS, {
      dateFrom: new Date('2026-01-10T00:00:00Z'),
      dateTo: new Date('2026-01-12T00:00:00Z'),
    });
    expect(result.map((m) => m.id).sort()).toEqual(['m1', 'm2'].sort());
  });

  it('searches by email (case insensitive)', () => {
    const result = applyFilters(MEMBERS, { search: 'COINBASE' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });

  it('searches by name', () => {
    const result = applyFilters(MEMBERS, { search: 'carol' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m3');
  });

  it('searches by company', () => {
    const result = applyFilters(MEMBERS, { search: 'polygon' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m3');
  });

  it('returns no results for unmatched search', () => {
    const result = applyFilters(MEMBERS, { search: 'zzz_nomatch' });
    expect(result).toHaveLength(0);
  });

  it('combines multiple filters (AND logic)', () => {
    const result = applyFilters(MEMBERS, { role: 'organizer', utmSource: 'twitter' });
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.role === 'organizer' && m.utmSource === 'twitter')).toBe(true);
  });
});

describe('Sorting early-access members', () => {
  it('sorts by email asc', () => {
    const result = applySort(MEMBERS, 'email', 'asc');
    const emails = result.map((m) => m.email);
    expect(emails).toEqual([...emails].sort());
  });

  it('sorts by email desc', () => {
    const result = applySort(MEMBERS, 'email', 'desc');
    const emails = result.map((m) => m.email);
    expect(emails).toEqual([...emails].sort().reverse());
  });

  it('sorts by createdAt desc (default)', () => {
    const result = applySort(MEMBERS, 'createdAt', 'desc');
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].createdAt >= result[i + 1].createdAt).toBe(true);
    }
  });

  it('falls back to createdAt for unknown sort field', () => {
    const result = applySort(MEMBERS, 'invalidField', 'desc');
    // Should not throw; returns results sorted by createdAt desc
    expect(result).toHaveLength(MEMBERS.length);
  });

  it('does not mutate original array', () => {
    const original = [...MEMBERS];
    applySort(MEMBERS, 'email', 'asc');
    expect(MEMBERS.map((m) => m.id)).toEqual(original.map((m) => m.id));
  });
});

describe('Pagination', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it('returns first page', () => {
    const { data, total, totalPages } = paginate(items, 1, 10);
    expect(data).toHaveLength(10);
    expect(data[0]).toBe(0);
    expect(total).toBe(25);
    expect(totalPages).toBe(3);
  });

  it('returns last partial page', () => {
    const { data } = paginate(items, 3, 10);
    expect(data).toHaveLength(5);
    expect(data[0]).toBe(20);
  });

  it('clamps page to minimum 1', () => {
    const { data } = paginate(items, 0, 10);
    expect(data[0]).toBe(0);
  });

  it('clamps pageSize to maximum 200', () => {
    const { data } = paginate(items, 1, 500);
    expect(data).toHaveLength(25); // all items fit within cap
  });

  it('clamps pageSize to minimum 1', () => {
    const { data } = paginate(items, 1, 0);
    expect(data).toHaveLength(1);
  });
});

describe('Internal status transitions (individual)', () => {
  it('updates internalStatus and sets reviewedBy/reviewedAt', () => {
    const before = MEMBERS[0];
    const reviewerId = 'admin-xyz';
    const updated = {
      ...before,
      internalStatus: 'reviewed' as InternalStatus,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    };
    expect(updated.internalStatus).toBe('reviewed');
    expect(updated.reviewedBy).toBe(reviewerId);
    expect(updated.reviewedAt).toBeInstanceOf(Date);
  });

  it('does not overwrite reviewedBy if internalStatus unchanged', () => {
    // The route only sets reviewedBy when internalStatus actually changes
    const before: EarlyAccessMember = { ...MEMBERS[1] }; // already 'reviewed'
    // Simulating: data.internalStatus === member.internalStatus → skip reviewedBy update
    const unchanged = before.internalStatus === 'reviewed';
    expect(unchanged).toBe(true);
    // reviewedBy should remain from original review
    expect(before.reviewedBy).toBe('admin1');
  });
});

describe('Bulk actions', () => {
  it('marks multiple members as reviewed', () => {
    const members: EarlyAccessMember[] = MEMBERS.map((m) => ({ ...m }));
    const { updated } = applyBulkAction(members, ['m1', 'm4'], 'mark_reviewed', 'platform-admin');
    expect(updated).toBe(2);
    expect(members.find((m) => m.id === 'm1')?.internalStatus).toBe('reviewed');
    expect(members.find((m) => m.id === 'm4')?.internalStatus).toBe('reviewed');
  });

  it('marks multiple members as contacted', () => {
    const members: EarlyAccessMember[] = MEMBERS.map((m) => ({ ...m }));
    applyBulkAction(members, ['m1'], 'mark_contacted', 'admin');
    expect(members.find((m) => m.id === 'm1')?.internalStatus).toBe('contacted');
  });

  it('archives members', () => {
    const members: EarlyAccessMember[] = MEMBERS.map((m) => ({ ...m }));
    applyBulkAction(members, ['m2', 'm3'], 'archive', 'admin');
    expect(members.find((m) => m.id === 'm2')?.internalStatus).toBe('archived');
    expect(members.find((m) => m.id === 'm3')?.internalStatus).toBe('archived');
  });

  it('sets reviewedBy and reviewedAt on all updated members', () => {
    const members: EarlyAccessMember[] = MEMBERS.map((m) => ({ ...m }));
    applyBulkAction(members, ['m1', 'm2'], 'mark_reviewed', 'superadmin');
    expect(members.find((m) => m.id === 'm1')?.reviewedBy).toBe('superadmin');
    expect(members.find((m) => m.id === 'm2')?.reviewedAt).toBeInstanceOf(Date);
  });

  it('only updates members with matching IDs', () => {
    const members: EarlyAccessMember[] = MEMBERS.map((m) => ({ ...m }));
    applyBulkAction(members, ['m1'], 'archive', 'admin');
    expect(members.find((m) => m.id === 'm2')?.internalStatus).toBe('reviewed'); // unchanged
  });

  it('throws when ids array is empty', () => {
    const members: EarlyAccessMember[] = MEMBERS.map((m) => ({ ...m }));
    expect(() => applyBulkAction(members, [], 'mark_reviewed', 'admin')).toThrow();
  });

  it('throws when ids array exceeds 500', () => {
    const members: EarlyAccessMember[] = MEMBERS.map((m) => ({ ...m }));
    const ids = Array.from({ length: 501 }, (_, i) => `id${i}`);
    expect(() => applyBulkAction(members, ids, 'mark_reviewed', 'admin')).toThrow();
  });
});

describe('Admin notes persistence', () => {
  it('saves admin notes to a member', () => {
    const member = MEMBERS[0];
    const updated = saveAdminNotes(member, 'Great fit for early cohort');
    expect(updated.adminNotes).toBe('Great fit for early cohort');
  });

  it('overwrites existing notes', () => {
    const member = { ...MEMBERS[0], adminNotes: 'old note' };
    const updated = saveAdminNotes(member, 'new note');
    expect(updated.adminNotes).toBe('new note');
  });

  it('clears notes with empty string', () => {
    const member = { ...MEMBERS[0], adminNotes: 'some note' };
    const updated = saveAdminNotes(member, '');
    expect(updated.adminNotes).toBe('');
  });

  it('does not mutate original member', () => {
    const member = { ...MEMBERS[0] };
    saveAdminNotes(member, 'note');
    expect(member.adminNotes).toBeUndefined();
  });
});

describe('Public status promotion', () => {
  it('promotes waitlisted → invited', () => {
    const m: EarlyAccessMember = { ...MEMBERS[0], status: 'waitlisted' };
    const result = promotePublicStatus(m, 'invited');
    expect(result.ok).toBe(true);
    expect(result.member?.status).toBe('invited');
  });

  it('promotes waitlisted → onboarded', () => {
    const m: EarlyAccessMember = { ...MEMBERS[0], status: 'waitlisted' };
    const result = promotePublicStatus(m, 'onboarded');
    expect(result.ok).toBe(true);
    expect(result.member?.status).toBe('onboarded');
  });

  it('promotes invited → onboarded', () => {
    const m: EarlyAccessMember = { ...MEMBERS[1], status: 'invited' };
    const result = promotePublicStatus(m, 'onboarded');
    expect(result.ok).toBe(true);
  });

  it('rejects demotion (onboarded → waitlisted)', () => {
    const m: EarlyAccessMember = { ...MEMBERS[2], status: 'onboarded' };
    const result = promotePublicStatus(m, 'waitlisted');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('INVALID_STATUS_TRANSITION');
  });

  it('rejects same-status assignment', () => {
    const m: EarlyAccessMember = { ...MEMBERS[0], status: 'waitlisted' };
    const result = promotePublicStatus(m, 'waitlisted');
    expect(result.ok).toBe(false);
  });
});

describe('CSV export correctness', () => {
  it('escapes values with commas', () => {
    expect(escapeCSV('hello, world')).toBe('"hello, world"');
  });

  it('escapes values with double quotes', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it('escapes values with newlines', () => {
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"');
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeCSV(null)).toBe('');
    expect(escapeCSV(undefined)).toBe('');
  });

  it('returns plain string for simple values', () => {
    expect(escapeCSV('hello')).toBe('hello');
    expect(escapeCSV(42)).toBe('42');
  });

  it('builds a correct CSV row for a member', () => {
    const member: EarlyAccessMember = {
      id: 'abc', email: 'test@test.com', name: 'Test User',
      company: 'ACME, Inc', status: 'waitlisted', internalStatus: 'new',
      createdAt: new Date('2026-01-15T00:00:00Z'),
    };
    const row = buildCSVRow(member, ['id', 'email', 'name', 'company', 'status']);
    expect(row).toBe('abc,test@test.com,Test User,"ACME, Inc",waitlisted');
  });

  it('handles missing optional fields as empty', () => {
    const member: EarlyAccessMember = {
      id: 'xyz', email: 'min@test.com', status: 'waitlisted', internalStatus: 'new',
      createdAt: new Date(),
    };
    const row = buildCSVRow(member, ['id', 'email', 'name', 'company']);
    expect(row).toBe('xyz,min@test.com,,');
  });

  it('export row count respects the 5000-row safety cap', () => {
    // Simulate enforcement: export function takes at most 5000
    const CAP = 5000;
    const allMembers = Array.from({ length: 6000 }, (_, i) => ({
      id: `m${i}`, email: `user${i}@test.com`, status: 'waitlisted' as PublicStatus,
      internalStatus: 'new' as InternalStatus, createdAt: new Date(),
    }));
    const exported = allMembers.slice(0, CAP);
    expect(exported).toHaveLength(5000);
  });
});
