import { describe, it, expect } from 'vitest';

// ─── Pure access-check logic (mirrors bids.ts checkItemAccess) ───────────────

type AccessMode = 'public' | 'whitelist_only' | 'invite_only' | 'whitelist' | null;

interface FakeItem {
  id: string;
  eventId: string;
  itemAccessMode: AccessMode;
  event: { accessMode: AccessMode };
}

interface FakeGrant {
  itemId?: string;
  eventId?: string;
  email: string | null;
  token?: string | null;
}

function checkItemAccess(
  item: FakeItem | null,
  email: string,
  itemGrants: FakeGrant[],
  eventGrants: FakeGrant[],
): { allowed: boolean; reason?: string } {
  if (!item) return { allowed: false, reason: 'not_found' };

  const effectiveMode = item.itemAccessMode ?? item.event.accessMode;
  if (effectiveMode === 'public') return { allowed: true };

  // Check item-level whitelist grant
  const grant = itemGrants.find(
    g => g.itemId === item.id && g.email?.toLowerCase() === email.toLowerCase(),
  );
  if (grant) return { allowed: true };

  // Fallback to event-level grant
  const eventGrant = eventGrants.find(
    g => g.eventId === item.eventId && g.email?.toLowerCase() === email.toLowerCase(),
  );
  if (eventGrant) return { allowed: true };

  return { allowed: false, reason: 'not_whitelisted' };
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const baseItem = (overrides: Partial<FakeItem> = {}): FakeItem => ({
  id: 'item-1',
  eventId: 'event-1',
  itemAccessMode: null,
  event: { accessMode: 'public' },
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Package access: effective mode resolution', () => {
  it('item inherits event public mode when itemAccessMode is null', () => {
    const item = baseItem({ itemAccessMode: null, event: { accessMode: 'public' } });
    const result = checkItemAccess(item, 'user@example.com', [], []);
    expect(result.allowed).toBe(true);
  });

  it('item whitelist_only overrides event public mode', () => {
    const item = baseItem({ itemAccessMode: 'whitelist_only', event: { accessMode: 'public' } });
    const result = checkItemAccess(item, 'user@example.com', [], []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_whitelisted');
  });

  it('event whitelist_only with no item override denies access when no grant exists', () => {
    const item = baseItem({ itemAccessMode: null, event: { accessMode: 'whitelist_only' } });
    const result = checkItemAccess(item, 'user@example.com', [], []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_whitelisted');
  });

  it('item public overrides event whitelist_only mode', () => {
    const item = baseItem({ itemAccessMode: 'public', event: { accessMode: 'whitelist_only' } });
    const result = checkItemAccess(item, 'notwhitelisted@example.com', [], []);
    expect(result.allowed).toBe(true);
  });
});

describe('Package access: grant checks', () => {
  it('email grant allows access when item mode is whitelist_only', () => {
    const item = baseItem({ itemAccessMode: 'whitelist_only', event: { accessMode: 'public' } });
    const grants: FakeGrant[] = [{ itemId: 'item-1', email: 'allowed@example.com' }];
    const result = checkItemAccess(item, 'allowed@example.com', grants, []);
    expect(result.allowed).toBe(true);
  });

  it('email grant matching is case-insensitive', () => {
    const item = baseItem({ itemAccessMode: 'whitelist_only', event: { accessMode: 'public' } });
    const grants: FakeGrant[] = [{ itemId: 'item-1', email: 'User@Example.COM' }];
    const result = checkItemAccess(item, 'user@example.com', grants, []);
    expect(result.allowed).toBe(true);
  });

  it('event-level grant allows access when item inherits whitelist_only event mode', () => {
    const item = baseItem({ itemAccessMode: null, event: { accessMode: 'whitelist_only' } });
    const eventGrants: FakeGrant[] = [{ eventId: 'event-1', email: 'sponsor@company.com' }];
    const result = checkItemAccess(item, 'sponsor@company.com', [], eventGrants);
    expect(result.allowed).toBe(true);
  });

  it('item-level grant takes precedence and allows access even if event mode is invite_only', () => {
    const item = baseItem({ itemAccessMode: 'whitelist_only', event: { accessMode: 'invite_only' } });
    const itemGrants: FakeGrant[] = [{ itemId: 'item-1', email: 'vip@example.com' }];
    const result = checkItemAccess(item, 'vip@example.com', itemGrants, []);
    expect(result.allowed).toBe(true);
  });

  it('grant for a different item does not grant access', () => {
    const item = baseItem({ id: 'item-1', itemAccessMode: 'whitelist_only', event: { accessMode: 'public' } });
    const grants: FakeGrant[] = [{ itemId: 'item-2', email: 'user@example.com' }];
    const result = checkItemAccess(item, 'user@example.com', grants, []);
    expect(result.allowed).toBe(false);
  });

  it('event grant for a different event does not grant access', () => {
    const item = baseItem({ eventId: 'event-1', itemAccessMode: null, event: { accessMode: 'whitelist_only' } });
    const eventGrants: FakeGrant[] = [{ eventId: 'event-2', email: 'user@example.com' }];
    const result = checkItemAccess(item, 'user@example.com', [], eventGrants);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_whitelisted');
  });
});

describe('Package access: edge cases', () => {
  it('returns not_found when item is null', () => {
    const result = checkItemAccess(null, 'user@example.com', [], []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_found');
  });

  it('invite_only mode with no matching grant denies access', () => {
    const item = baseItem({ itemAccessMode: 'invite_only', event: { accessMode: 'public' } });
    const result = checkItemAccess(item, 'user@example.com', [], []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_whitelisted');
  });
});
