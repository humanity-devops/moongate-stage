import { describe, it, expect } from 'vitest';

// ============================================================
// Unit tests for campaign contribution eligibility logic
// ============================================================

type CampaignStatus = 'active' | 'won' | 'lost' | 'expired' | 'cancelled';
type ContributionStatus = 'pending_payment' | 'confirmed' | 'refunded' | 'cancelled';

interface Campaign {
  id: string;
  status: CampaignStatus;
  approvalStatus: 'approved' | 'pending' | 'rejected';
  deadline: Date;
  goalAmount: number;
  raisedAmount: number;
  currency: string;
}

interface PendingContribution {
  id: string;
  userId: string;
  campaignId: string;
  status: ContributionStatus;
  amount: number;
  orderId: string | null;
}

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

function checkContributionEligibility(
  campaign: Campaign,
  amount: number,
  pendingContrib?: PendingContribution | null,
): EligibilityResult {
  if (campaign.approvalStatus !== 'approved') {
    return { eligible: false, reason: 'Campaign is not approved' };
  }

  if (campaign.status !== 'active') {
    return { eligible: false, reason: `Campaign is ${campaign.status}` };
  }

  if (new Date() > campaign.deadline) {
    return { eligible: false, reason: 'Campaign has expired' };
  }

  if (amount <= 0) {
    return { eligible: false, reason: 'Amount must be positive' };
  }

  if (pendingContrib && pendingContrib.status === 'pending_payment') {
    return { eligible: false, reason: 'You already have a pending contribution' };
  }

  return { eligible: true };
}

function simulateCampaignUpdate(
  campaign: Campaign,
  contributionAmount: number,
): { newStatus: CampaignStatus; won: boolean } {
  const newRaised = campaign.raisedAmount + contributionAmount;
  const won = newRaised >= campaign.goalAmount;
  return {
    newStatus: won ? 'won' : 'active',
    won,
  };
}

describe('Campaign contribution eligibility', () => {
  const baseCampaign: Campaign = {
    id: 'campaign1',
    status: 'active',
    approvalStatus: 'approved',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    goalAmount: 10000,
    raisedAmount: 2000,
    currency: 'USD',
  };

  it('accepts valid contribution to active campaign', () => {
    const result = checkContributionEligibility(baseCampaign, 500);
    expect(result.eligible).toBe(true);
  });

  it('rejects contribution to won campaign', () => {
    const wonCampaign: Campaign = { ...baseCampaign, status: 'won' };
    const result = checkContributionEligibility(wonCampaign, 500);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('won');
  });

  it('rejects contribution to lost campaign', () => {
    const lostCampaign: Campaign = { ...baseCampaign, status: 'lost' };
    const result = checkContributionEligibility(lostCampaign, 500);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('lost');
  });

  it('rejects contribution to expired campaign (status)', () => {
    const expiredCampaign: Campaign = { ...baseCampaign, status: 'expired' };
    const result = checkContributionEligibility(expiredCampaign, 500);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('rejects contribution when deadline has passed', () => {
    const pastDeadline: Campaign = {
      ...baseCampaign,
      deadline: new Date(Date.now() - 1000), // 1 second ago
    };
    const result = checkContributionEligibility(pastDeadline, 500);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('rejects non-approved campaign', () => {
    const pendingCampaign: Campaign = { ...baseCampaign, approvalStatus: 'pending' };
    const result = checkContributionEligibility(pendingCampaign, 500);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('not approved');
  });

  it('rejects zero amount', () => {
    const result = checkContributionEligibility(baseCampaign, 0);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('positive');
  });

  it('rejects negative amount', () => {
    const result = checkContributionEligibility(baseCampaign, -100);
    expect(result.eligible).toBe(false);
  });
});

describe('Duplicate pending contribution handling', () => {
  const baseCampaign: Campaign = {
    id: 'campaign1',
    status: 'active',
    approvalStatus: 'approved',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    goalAmount: 10000,
    raisedAmount: 2000,
    currency: 'USD',
  };

  it('blocks new contribution when pending one exists', () => {
    const pending: PendingContribution = {
      id: 'contrib1',
      userId: 'user1',
      campaignId: 'campaign1',
      status: 'pending_payment',
      amount: 200,
      orderId: 'order1',
    };
    const result = checkContributionEligibility(baseCampaign, 500, pending);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('pending contribution');
  });

  it('allows new contribution when previous is confirmed', () => {
    const confirmed: PendingContribution = {
      id: 'contrib1',
      userId: 'user1',
      campaignId: 'campaign1',
      status: 'confirmed',
      amount: 200,
      orderId: 'order1',
    };
    const result = checkContributionEligibility(baseCampaign, 500, confirmed);
    expect(result.eligible).toBe(true);
  });

  it('allows contribution when no prior contribution exists', () => {
    const result = checkContributionEligibility(baseCampaign, 500, null);
    expect(result.eligible).toBe(true);
  });
});

describe('Campaign won calculation', () => {
  const baseCampaign: Campaign = {
    id: 'campaign1',
    status: 'active',
    approvalStatus: 'approved',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    goalAmount: 10000,
    raisedAmount: 8000,
    currency: 'USD',
  };

  it('marks campaign as won when goal is exactly reached', () => {
    const result = simulateCampaignUpdate(baseCampaign, 2000);
    expect(result.won).toBe(true);
    expect(result.newStatus).toBe('won');
  });

  it('marks campaign as won when goal is exceeded', () => {
    const result = simulateCampaignUpdate(baseCampaign, 3000);
    expect(result.won).toBe(true);
    expect(result.newStatus).toBe('won');
  });

  it('keeps campaign active when goal not yet reached', () => {
    const result = simulateCampaignUpdate(baseCampaign, 1000);
    expect(result.won).toBe(false);
    expect(result.newStatus).toBe('active');
  });

  it('handles campaign at 0 raised', () => {
    const zeroCampaign: Campaign = { ...baseCampaign, raisedAmount: 0 };
    const result = simulateCampaignUpdate(zeroCampaign, 500);
    expect(result.won).toBe(false);
  });

  it('handles exact goal amount contribution from zero', () => {
    const zeroCampaign: Campaign = { ...baseCampaign, raisedAmount: 0 };
    const result = simulateCampaignUpdate(zeroCampaign, 10000);
    expect(result.won).toBe(true);
  });
});
