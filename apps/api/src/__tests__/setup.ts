import { vi } from 'vitest';

// Mock Prisma client
vi.mock('@moongate/db', () => ({
  prisma: {
    tenant: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    session: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    membership: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    event: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    sponsorItem: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    bid: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    counterOffer: { create: vi.fn(), updateMany: vi.fn() },
    order: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    sponsorContact: { findFirst: vi.fn(), create: vi.fn() },
    sponsorCompany: { findFirst: vi.fn(), create: vi.fn() },
    sponsorLead: { create: vi.fn() },
    activityFeedEntry: { create: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    magicLink: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    sponsorshipDeck: { create: vi.fn(), findFirst: vi.fn() },
    extractionJob: { create: vi.fn(), update: vi.fn() },
    extractionSuggestion: { create: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));
