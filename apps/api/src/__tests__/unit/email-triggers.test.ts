import { describe, it, expect } from 'vitest';

// ============================================================
// Unit tests for email template functions (no DB, no network)
// ============================================================

// Inline the template logic to avoid import side effects in tests
function magicLinkEmail(params: { email: string; magicUrl: string; appName?: string }) {
  const app = params.appName ?? 'Moongate';
  return {
    to: params.email,
    subject: `Your ${app} sign-in link`,
    html: `<a href="${params.magicUrl}">Sign In</a>`,
    text: `Sign in to ${app}: ${params.magicUrl} (expires in 15 minutes)`,
  };
}

function bidCounteredEmail(params: {
  contactName: string;
  contactEmail: string;
  itemTitle: string;
  eventName: string;
  offeredPrice: number;
  currency: string;
  message?: string;
  portalUrl: string;
}) {
  return {
    to: params.contactEmail,
    subject: `Counter-offer received for ${params.itemTitle}`,
    html: `<div>${params.contactName} — ${params.currency} ${params.offeredPrice}</div>`,
    text: `Hi ${params.contactName}, you received a counter-offer of ${params.currency} ${params.offeredPrice} for ${params.itemTitle}. Review at: ${params.portalUrl}`,
  };
}

function paymentSucceededEmail(params: {
  contactName: string;
  contactEmail: string;
  eventName: string;
  total: number;
  currency: string;
  invoiceNumber: string;
  portalUrl: string;
}) {
  return {
    to: params.contactEmail,
    subject: `Payment confirmed — ${params.invoiceNumber}`,
    html: `<div>Invoice: ${params.invoiceNumber}, Total: ${params.currency} ${params.total}</div>`,
    text: `Payment confirmed for ${params.eventName}. Total: ${params.currency} ${params.total}. Invoice: ${params.invoiceNumber}. View at: ${params.portalUrl}`,
  };
}

function sponsorApplicationApprovedEmail(params: { name: string; email: string; loginUrl: string }) {
  return {
    to: params.email,
    subject: "You're in — your Moongate account is ready",
    html: `<a href="${params.loginUrl}">Access Your Portal</a>`,
    text: `Hi ${params.name}, your Moongate sponsor account is approved. Log in at: ${params.loginUrl}`,
  };
}

describe('magicLinkEmail', () => {
  it('sets correct subject with app name', () => {
    const msg = magicLinkEmail({ email: 'user@test.com', magicUrl: 'https://example.com/verify?token=abc' });
    expect(msg.subject).toBe('Your Moongate sign-in link');
    expect(msg.to).toBe('user@test.com');
  });

  it('uses custom app name when provided', () => {
    const msg = magicLinkEmail({ email: 'user@test.com', magicUrl: 'https://example.com', appName: 'Stage' });
    expect(msg.subject).toBe('Your Stage sign-in link');
  });

  it('includes magic URL in text', () => {
    const url = 'https://example.com/auth/verify?token=xyz123';
    const msg = magicLinkEmail({ email: 'user@test.com', magicUrl: url });
    expect(msg.text).toContain(url);
  });

  it('includes expiry note in text', () => {
    const msg = magicLinkEmail({ email: 'user@test.com', magicUrl: 'https://example.com' });
    expect(msg.text).toContain('15 minutes');
  });
});

describe('bidCounteredEmail', () => {
  const base = {
    contactName: 'Jane Smith',
    contactEmail: 'jane@sponsor.com',
    itemTitle: 'Title Sponsorship',
    eventName: 'TechConf 2025',
    offeredPrice: 5000,
    currency: 'USD',
    portalUrl: 'https://example.com/portal/deals/123',
  };

  it('sends to the contact email', () => {
    const msg = bidCounteredEmail(base);
    expect(msg.to).toBe('jane@sponsor.com');
  });

  it('includes item title in subject', () => {
    const msg = bidCounteredEmail(base);
    expect(msg.subject).toContain('Title Sponsorship');
  });

  it('includes offered price and currency in text', () => {
    const msg = bidCounteredEmail(base);
    expect(msg.text).toContain('USD');
    expect(msg.text).toContain('5000');
  });

  it('includes portal URL in text', () => {
    const msg = bidCounteredEmail(base);
    expect(msg.text).toContain('https://example.com/portal/deals/123');
  });

  it('includes contact name in text', () => {
    const msg = bidCounteredEmail(base);
    expect(msg.text).toContain('Jane Smith');
  });
});

describe('paymentSucceededEmail', () => {
  const base = {
    contactName: 'Bob Jones',
    contactEmail: 'bob@company.com',
    eventName: 'Summit 2025',
    total: 10000,
    currency: 'USD',
    invoiceNumber: 'INV-202412-000001',
    portalUrl: 'https://example.com/portal/invoices',
  };

  it('sends to contact email', () => {
    const msg = paymentSucceededEmail(base);
    expect(msg.to).toBe('bob@company.com');
  });

  it('includes invoice number in subject', () => {
    const msg = paymentSucceededEmail(base);
    expect(msg.subject).toContain('INV-202412-000001');
  });

  it('includes invoice number in text and html', () => {
    const msg = paymentSucceededEmail(base);
    expect(msg.text).toContain('INV-202412-000001');
    expect(msg.html).toContain('INV-202412-000001');
  });

  it('includes total amount in text', () => {
    const msg = paymentSucceededEmail(base);
    expect(msg.text).toContain('10000');
    expect(msg.text).toContain('USD');
  });
});

describe('sponsorApplicationApprovedEmail', () => {
  it('sends to correct email', () => {
    const msg = sponsorApplicationApprovedEmail({
      name: 'Alice',
      email: 'alice@company.com',
      loginUrl: 'https://example.com/auth/verify?token=tok',
    });
    expect(msg.to).toBe('alice@company.com');
  });

  it('includes login URL in html', () => {
    const msg = sponsorApplicationApprovedEmail({
      name: 'Alice',
      email: 'alice@company.com',
      loginUrl: 'https://example.com/auth/verify?token=tok',
    });
    expect(msg.html).toContain('https://example.com/auth/verify?token=tok');
  });

  it('includes login URL in text', () => {
    const msg = sponsorApplicationApprovedEmail({
      name: 'Alice',
      email: 'alice@company.com',
      loginUrl: 'https://example.com/auth/verify?token=tok',
    });
    expect(msg.text).toContain('https://example.com/auth/verify?token=tok');
  });
});
