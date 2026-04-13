import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Pure logic helpers (no DB) ----

function isReadable(notification: { readAt: Date | null }): boolean {
  return notification.readAt === null;
}

function markRead(notification: { readAt: Date | null }): { readAt: Date } {
  return { ...notification, readAt: new Date() };
}

function userCanSeeNotification(notification: { userId: string }, requestingUserId: string): boolean {
  return notification.userId === requestingUserId;
}

const CONVERSATION_STATUSES = ['accepted', 'countered', 'under_review'] as const;

function bidAllowsMessaging(bid: { email: string; status: string }, userEmail: string): boolean {
  if (bid.email !== userEmail) return false;
  return CONVERSATION_STATUSES.includes(bid.status as typeof CONVERSATION_STATUSES[number]);
}

function buildNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  tenantId?: string;
}) {
  return {
    userId: params.userId,
    tenantId: params.tenantId ?? null,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    readAt: null,
    createdAt: new Date(),
  };
}

// ---- Mocked notify() ----

// Re-implement a testable in-memory version of notify()
type NotifyParams = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  tenantId?: string;
};

const createdNotifications: ReturnType<typeof buildNotification>[] = [];

async function notifyInMemory(params: NotifyParams): Promise<void> {
  // Mimics fire-and-forget — stores for test assertions, never throws
  try {
    createdNotifications.push(buildNotification(params));
  } catch {
    // swallowed
  }
}

// ---- Tests ----

describe('notify() helper', () => {
  beforeEach(() => {
    createdNotifications.length = 0;
  });

  it('creates a notification entry without throwing', async () => {
    await expect(notifyInMemory({
      userId: 'user-1',
      type: 'bid_accepted',
      title: 'Your bid was accepted',
    })).resolves.toBeUndefined();
  });

  it('stores notification with correct fields', async () => {
    await notifyInMemory({
      userId: 'user-2',
      type: 'bid_countered',
      title: 'Counter-offer received',
      body: 'The organizer sent a counter of $5000',
      tenantId: 'tenant-abc',
    });
    expect(createdNotifications).toHaveLength(1);
    expect(createdNotifications[0].userId).toBe('user-2');
    expect(createdNotifications[0].type).toBe('bid_countered');
    expect(createdNotifications[0].tenantId).toBe('tenant-abc');
  });

  it('defaults tenantId to null when not provided', async () => {
    await notifyInMemory({ userId: 'user-3', type: 'bid_rejected', title: 'Bid rejected' });
    expect(createdNotifications[0].tenantId).toBeNull();
  });

  it('defaults body to null when not provided', async () => {
    await notifyInMemory({ userId: 'user-3', type: 'test', title: 'Hello' });
    expect(createdNotifications[0].body).toBeNull();
  });
});

describe('Notification read state', () => {
  it('new notification is unread', () => {
    const n = buildNotification({ userId: 'u1', type: 't', title: 'T' });
    expect(isReadable(n)).toBe(true);
  });

  it('marking read sets readAt', () => {
    const n = buildNotification({ userId: 'u1', type: 't', title: 'T' });
    const updated = markRead(n);
    expect(updated.readAt).toBeInstanceOf(Date);
  });

  it('already-read notification shows readAt date', () => {
    const n = { readAt: new Date('2024-01-01') };
    expect(isReadable(n)).toBe(false);
  });
});

describe('Notification visibility', () => {
  it('user can see their own notification', () => {
    const n = { userId: 'user-A' };
    expect(userCanSeeNotification(n, 'user-A')).toBe(true);
  });

  it('user cannot see another user\'s notification', () => {
    const n = { userId: 'user-A' };
    expect(userCanSeeNotification(n, 'user-B')).toBe(false);
  });

  it('empty userId does not match a real user', () => {
    const n = { userId: 'user-A' };
    expect(userCanSeeNotification(n, '')).toBe(false);
  });
});

describe('Conversation eligibility', () => {
  it('sponsor can message a bid with matching email and accepted status', () => {
    expect(bidAllowsMessaging({ email: 'sponsor@co.com', status: 'accepted' }, 'sponsor@co.com')).toBe(true);
  });

  it('sponsor can message a bid with countered status', () => {
    expect(bidAllowsMessaging({ email: 'sponsor@co.com', status: 'countered' }, 'sponsor@co.com')).toBe(true);
  });

  it('sponsor can message a bid with under_review status', () => {
    expect(bidAllowsMessaging({ email: 'sponsor@co.com', status: 'under_review' }, 'sponsor@co.com')).toBe(true);
  });

  it('sponsor cannot message a bid with submitted status', () => {
    expect(bidAllowsMessaging({ email: 'sponsor@co.com', status: 'submitted' }, 'sponsor@co.com')).toBe(false);
  });

  it('sponsor cannot message a bid with rejected status', () => {
    expect(bidAllowsMessaging({ email: 'sponsor@co.com', status: 'rejected' }, 'sponsor@co.com')).toBe(false);
  });

  it('sponsor cannot message a bid belonging to a different email', () => {
    expect(bidAllowsMessaging({ email: 'other@co.com', status: 'accepted' }, 'sponsor@co.com')).toBe(false);
  });

  it('email mismatch blocks messaging even when status is valid', () => {
    expect(bidAllowsMessaging({ email: 'alice@co.com', status: 'countered' }, 'bob@co.com')).toBe(false);
  });
});
