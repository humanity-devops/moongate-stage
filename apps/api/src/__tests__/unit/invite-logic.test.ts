import { describe, it, expect } from 'vitest';

// Invite redemption logic — pure business rules, no DB

type MemberStatus = 'waitlisted' | 'invited' | 'onboarded';
type ContactStatus = 'new' | 'contacted' | 'responded' | 'converted' | 'archived';

interface EarlyAccessMember {
  status: MemberStatus;
  inviteCode: string;
}

interface OutreachContact {
  status: ContactStatus;
  inviteCode: string;
  inviteSentAt?: Date;
}

// Simulate the redemption logic from invites.ts
function redeemEarlyAccess(member: EarlyAccessMember, code: string): { ok: boolean; error?: string; newStatus?: MemberStatus } {
  if (member.inviteCode !== code) return { ok: false, error: 'INVITE_NOT_FOUND' };
  if (member.status === 'onboarded') return { ok: false, error: 'ALREADY_REDEEMED' };
  return { ok: true, newStatus: 'onboarded' };
}

function redeemOutreachContact(contact: OutreachContact, code: string): { ok: boolean; error?: string; newStatus?: ContactStatus } {
  if (contact.inviteCode !== code) return { ok: false, error: 'INVITE_NOT_FOUND' };
  if (contact.status === 'converted') return { ok: false, error: 'ALREADY_REDEEMED' };
  return { ok: true, newStatus: 'converted' };
}

// Determine which status an outreach contact should transition to when invite is sent
function inviteSentStatus(current: ContactStatus): ContactStatus {
  return current === 'new' ? 'contacted' : current;
}

describe('Early access invite redemption', () => {
  const member: EarlyAccessMember = { status: 'waitlisted', inviteCode: 'abc123' };

  it('redeems a valid invite code', () => {
    const result = redeemEarlyAccess(member, 'abc123');
    expect(result.ok).toBe(true);
    expect(result.newStatus).toBe('onboarded');
  });

  it('rejects wrong invite code', () => {
    const result = redeemEarlyAccess(member, 'wrongcode');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('INVITE_NOT_FOUND');
  });

  it('rejects already onboarded member', () => {
    const onboarded: EarlyAccessMember = { status: 'onboarded', inviteCode: 'abc123' };
    const result = redeemEarlyAccess(onboarded, 'abc123');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('ALREADY_REDEEMED');
  });
});

describe('Outreach contact invite redemption', () => {
  const contact: OutreachContact = { status: 'contacted', inviteCode: 'xyz789' };

  it('redeems a valid invite code and marks converted', () => {
    const result = redeemOutreachContact(contact, 'xyz789');
    expect(result.ok).toBe(true);
    expect(result.newStatus).toBe('converted');
  });

  it('rejects wrong invite code', () => {
    const result = redeemOutreachContact(contact, 'badcode');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('INVITE_NOT_FOUND');
  });

  it('rejects already converted contact', () => {
    const converted: OutreachContact = { status: 'converted', inviteCode: 'xyz789' };
    const result = redeemOutreachContact(converted, 'xyz789');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('ALREADY_REDEEMED');
  });
});

describe('Invite sent status transitions', () => {
  it('transitions new → contacted when invite is sent', () => {
    expect(inviteSentStatus('new')).toBe('contacted');
  });

  it('leaves non-new status unchanged when invite is sent', () => {
    expect(inviteSentStatus('responded')).toBe('responded');
    expect(inviteSentStatus('contacted')).toBe('contacted');
    expect(inviteSentStatus('converted')).toBe('converted');
    expect(inviteSentStatus('archived')).toBe('archived');
  });
});
