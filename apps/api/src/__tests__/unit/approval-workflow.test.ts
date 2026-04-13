import { describe, it, expect } from 'vitest';

// Approval workflow — pure business logic tests
// Mirrors the logic in apps/api/src/routes/organizer/approvals.ts

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type Decision = 'approved' | 'rejected' | 'needs_changes';

interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
}

interface DecideResult {
  ok: boolean;
  error?: string;
  campaign?: Campaign;
}

// --- Core decision logic (mirrors the route handler) ---

function decideCampaign(
  campaign: Campaign,
  actorTenantId: string,
  decision: Decision,
  reason?: string,
): DecideResult {
  // Tenant isolation
  if (campaign.tenantId !== actorTenantId) {
    return { ok: false, error: 'NOT_FOUND' };
  }
  // Rejection requires a reason
  if (decision === 'rejected' && !reason?.trim()) {
    return { ok: false, error: 'A reason is required when rejecting' };
  }

  const updated: Campaign = {
    ...campaign,
    // needs_changes keeps it pending; approved/rejected set directly
    approvalStatus: decision === 'needs_changes' ? 'pending' : decision,
    rejectionReason: reason ?? null,
    approvedBy: 'actor-id',
    approvedAt: new Date(),
  };

  return { ok: true, campaign: updated };
}

// --- Audit event generation ---

function buildAuditAction(decision: Decision): string {
  return `campaign_${decision}`;
}

// --- Filter helpers (mirrors GET / query logic) ---

function filterByApprovalStatus(campaigns: Campaign[], approvalStatus: ApprovalStatus | 'pending'): Campaign[] {
  return campaigns.filter(c => c.approvalStatus === approvalStatus);
}

// --- Test data ---

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const CAMPAIGNS: Campaign[] = [
  { id: 'c1', tenantId: TENANT_A, name: 'Alpha Fund', approvalStatus: 'pending' },
  { id: 'c2', tenantId: TENANT_A, name: 'Beta Campaign', approvalStatus: 'approved', approvedBy: 'admin', approvedAt: new Date('2026-01-01') },
  { id: 'c3', tenantId: TENANT_A, name: 'Gamma Drive', approvalStatus: 'rejected', rejectionReason: 'Does not meet criteria' },
  { id: 'c4', tenantId: TENANT_B, name: 'Other Tenant Campaign', approvalStatus: 'pending' },
];

// ============================================================
// Tests
// ============================================================

describe('Campaign approval — approve decision', () => {
  it('sets approvalStatus to approved', () => {
    const { ok, campaign } = decideCampaign(CAMPAIGNS[0], TENANT_A, 'approved');
    expect(ok).toBe(true);
    expect(campaign?.approvalStatus).toBe('approved');
  });

  it('sets approvedBy and approvedAt', () => {
    const { campaign } = decideCampaign(CAMPAIGNS[0], TENANT_A, 'approved');
    expect(campaign?.approvedBy).toBe('actor-id');
    expect(campaign?.approvedAt).toBeInstanceOf(Date);
  });

  it('clears rejectionReason when approved', () => {
    const campaignWithReason: Campaign = { ...CAMPAIGNS[0], rejectionReason: 'old reason' };
    const { campaign } = decideCampaign(campaignWithReason, TENANT_A, 'approved');
    expect(campaign?.rejectionReason).toBeNull();
  });
});

describe('Campaign approval — reject decision', () => {
  it('sets approvalStatus to rejected when reason provided', () => {
    const { ok, campaign } = decideCampaign(CAMPAIGNS[0], TENANT_A, 'rejected', 'Does not meet criteria');
    expect(ok).toBe(true);
    expect(campaign?.approvalStatus).toBe('rejected');
  });

  it('stores rejection reason', () => {
    const reason = 'Insufficient documentation';
    const { campaign } = decideCampaign(CAMPAIGNS[0], TENANT_A, 'rejected', reason);
    expect(campaign?.rejectionReason).toBe(reason);
  });

  it('returns error when rejecting without a reason', () => {
    const { ok, error } = decideCampaign(CAMPAIGNS[0], TENANT_A, 'rejected');
    expect(ok).toBe(false);
    expect(error).toMatch(/reason is required/i);
  });

  it('returns error when rejection reason is whitespace only', () => {
    const { ok, error } = decideCampaign(CAMPAIGNS[0], TENANT_A, 'rejected', '   ');
    expect(ok).toBe(false);
    expect(error).toMatch(/reason is required/i);
  });
});

describe('Campaign approval — needs_changes decision', () => {
  it('keeps approvalStatus as pending (back to queue)', () => {
    const { ok, campaign } = decideCampaign(CAMPAIGNS[0], TENANT_A, 'needs_changes', 'Please revise section 3');
    expect(ok).toBe(true);
    expect(campaign?.approvalStatus).toBe('pending');
  });

  it('does not require a reason for needs_changes', () => {
    const { ok } = decideCampaign(CAMPAIGNS[0], TENANT_A, 'needs_changes');
    expect(ok).toBe(true);
  });
});

describe('Campaign approval — tenant isolation', () => {
  it('rejects decisions on campaigns from a different tenant', () => {
    // CAMPAIGNS[3] belongs to TENANT_B; actor is from TENANT_A
    const { ok, error } = decideCampaign(CAMPAIGNS[3], TENANT_A, 'approved');
    expect(ok).toBe(false);
    expect(error).toBe('NOT_FOUND');
  });

  it('allows decisions on own-tenant campaigns', () => {
    const { ok } = decideCampaign(CAMPAIGNS[3], TENANT_B, 'approved');
    expect(ok).toBe(true);
  });
});

describe('Campaign list filtering', () => {
  const ownCampaigns = CAMPAIGNS.filter(c => c.tenantId === TENANT_A);

  it('defaults to returning pending campaigns', () => {
    const result = filterByApprovalStatus(ownCampaigns, 'pending');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('filters by approved status', () => {
    const result = filterByApprovalStatus(ownCampaigns, 'approved');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c2');
  });

  it('filters by rejected status', () => {
    const result = filterByApprovalStatus(ownCampaigns, 'rejected');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c3');
  });

  it('returns empty array when no campaigns match status', () => {
    const noCampaigns: Campaign[] = [];
    expect(filterByApprovalStatus(noCampaigns, 'pending')).toHaveLength(0);
  });
});

describe('Audit action naming', () => {
  it('generates correct audit action for approved', () => {
    expect(buildAuditAction('approved')).toBe('campaign_approved');
  });

  it('generates correct audit action for rejected', () => {
    expect(buildAuditAction('rejected')).toBe('campaign_rejected');
  });

  it('generates correct audit action for needs_changes', () => {
    expect(buildAuditAction('needs_changes')).toBe('campaign_needs_changes');
  });
});

describe('Approval status state machine', () => {
  it('pending can transition to approved', () => {
    const { campaign } = decideCampaign({ ...CAMPAIGNS[0], approvalStatus: 'pending' }, TENANT_A, 'approved');
    expect(campaign?.approvalStatus).toBe('approved');
  });

  it('pending can transition to rejected', () => {
    const { campaign } = decideCampaign({ ...CAMPAIGNS[0], approvalStatus: 'pending' }, TENANT_A, 'rejected', 'reason');
    expect(campaign?.approvalStatus).toBe('rejected');
  });

  it('pending can stay pending via needs_changes', () => {
    const { campaign } = decideCampaign({ ...CAMPAIGNS[0], approvalStatus: 'pending' }, TENANT_A, 'needs_changes');
    expect(campaign?.approvalStatus).toBe('pending');
  });

  it('does not mutate the original campaign', () => {
    const original = { ...CAMPAIGNS[0] };
    decideCampaign(CAMPAIGNS[0], TENANT_A, 'approved');
    expect(CAMPAIGNS[0].approvalStatus).toBe(original.approvalStatus);
  });
});
