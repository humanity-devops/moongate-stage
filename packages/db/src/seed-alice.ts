/**
 * Fills Alice Chen (alice@acme.xyz) with rich example data across all portal sections.
 * Run with: npx tsx packages/db/src/seed-alice.ts
 */
import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

const ALICE_EMAIL = 'alice@acme.xyz';
const CONTACT_ID  = 'demo-contact-1';
const COMPANY_ID  = 'demo-company-1';

async function main() {
  // Look up all IDs dynamically so this script works after any fresh seed
  const aliceUser = await prisma.user.findUniqueOrThrow({ where: { email: ALICE_EMAIL } });
  const ALICE_USER_ID = aliceUser.id;

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'ethglobal' } });
  const TENANT_ID = tenant.id;

  const ethmilan2025 = await prisma.event.findFirstOrThrow({ where: { tenantId: TENANT_ID, slug: 'ethmilan-2025' } });
  const ETHMILAN_2025_ID = ethmilan2025.id;

  const ethmilan2026 = await prisma.event.findFirst({ where: { tenantId: TENANT_ID, slug: 'ethmilan-2026' } });
  const ETHMILAN_2026_ID = ethmilan2026?.id ?? '';

  const ethberlin2026 = await prisma.event.findFirst({ where: { tenantId: TENANT_ID, slug: 'ethberlin-2026' } });
  const ETHBERLIN_2026_ID = ethberlin2026?.id ?? '';

  const devconnect = await prisma.event.findFirst({ where: { tenantId: TENANT_ID, slug: 'devconnect-amsterdam-2026' } });
  const DEVCONNECT_ID = devconnect?.id ?? '';

  const token2049 = await prisma.event.findFirst({ where: { tenantId: TENANT_ID, slug: 'token2049' } });
  const TOKEN2049_ID = token2049?.id ?? '';

  const getItem = (slug: string) =>
    prisma.sponsorItem.findFirst({ where: { eventId: ETHMILAN_2025_ID, slug } });

  const [premiumItem, silverItem, communityItem, coffeeItem, badgeItem, lunchItem, screenItem, newsletterItem, sideStageItem] = await Promise.all([
    getItem('premium-sponsor'),
    getItem('silver-sponsor'),
    getItem('community-sponsor'),
    getItem('coffee-sponsor'),
    getItem('badge-sponsor'),
    getItem('lunch-sponsor'),
    getItem('screen-pack'),
    getItem('newsletter-sponsor'),
    getItem('side-stage-branding'),
  ]);

  const ITEM_PREMIUM    = premiumItem?.id    ?? '';
  const ITEM_SILVER     = silverItem?.id     ?? '';
  const ITEM_COMMUNITY  = communityItem?.id  ?? '';
  const ITEM_COFFEE     = coffeeItem?.id     ?? '';
  const ITEM_BADGE      = badgeItem?.id      ?? '';
  const ITEM_LUNCH      = lunchItem?.id      ?? '';
  const ITEM_SCREEN     = screenItem?.id     ?? '';
  const ITEM_NEWSLETTER = newsletterItem?.id ?? '';
  const ITEM_SIDE_STAGE = sideStageItem?.id  ?? '';
  console.log('🌱 Filling Alice Chen account with example data...');

  // ── 1. User: referralCode + referredByCode ────────────────────────────────
  await prisma.user.update({
    where: { id: ALICE_USER_ID },
    data: {
      name: 'Alice Chen',
      referralCode: 'ACME-ALICE',
      referredByCode: 'ETHGLOBAL-EARLY',
    },
  });

  // ── 2. SponsorContact: all fields ─────────────────────────────────────────
  await prisma.sponsorContact.update({
    where: { id: CONTACT_ID },
    data: {
      name: 'Alice Chen',
      title: 'Head of Partnerships',
      phone: '+1 (415) 555-0192',
      telegram: '@alicechen',
      whatsapp: '+14155550192',
      emailVerified: true,
    },
  });

  // ── 3. SponsorCompany: all fields ─────────────────────────────────────────
  await prisma.sponsorCompany.update({
    where: { id: COMPANY_ID },
    data: {
      name: 'Acme Protocol',
      website: 'https://acme.xyz',
      industry: 'DeFi / L2 Infrastructure',
      description: 'Acme Protocol is a leading Layer 2 scaling solution powering 12M+ weekly transactions. We partner with key events in the Ethereum ecosystem to grow developer and institutional awareness.',
      logoUrl: 'https://acme.xyz/logo.png',
    },
  });

  // ── 4. EarlyAccessMember ──────────────────────────────────────────────────
  await prisma.earlyAccessMember.upsert({
    where: { email: ALICE_EMAIL },
    update: { status: 'onboarded' },
    create: {
      email: ALICE_EMAIL,
      name: 'Alice Chen',
      company: 'Acme Protocol',
      websiteUrl: 'https://acme.xyz',
      role: 'sponsor',
      status: 'onboarded',
      referralCode: 'ACME-ALICE',
      referredByCode: 'ETHGLOBAL-EARLY',
    },
  });

  // ── 5. Existing bid (demo-bid-1): add messages ────────────────────────────
  await prisma.bidMessage.createMany({
    data: [
      {
        bidId: 'demo-bid-1',
        authorType: 'sponsor',
        authorId: ALICE_USER_ID,
        authorName: 'Alice Chen',
        content: "Hi! We're excited about the Premium Sponsor opportunity at ETHMilan. Acme Protocol has 12M weekly users and we'd love to discuss co-branding options.",
        isInternal: false,
        createdAt: new Date('2026-03-10T09:15:00Z'),
      },
      {
        bidId: 'demo-bid-1',
        authorType: 'organizer',
        authorName: 'Sara Malik',
        content: "Thanks Alice! We're reviewing your bid. A few questions: Can you share your target audience demographic, and are you interested in the networking dinner sponsorship add-on?",
        isInternal: false,
        createdAt: new Date('2026-03-11T14:30:00Z'),
      },
      {
        bidId: 'demo-bid-1',
        authorType: 'sponsor',
        authorId: ALICE_USER_ID,
        authorName: 'Alice Chen',
        content: "Our core audience is Ethereum devs and L2 ecosystem teams — exactly your crowd. Yes, very interested in the dinner add-on. Budget would be $25k + the dinner package.",
        isInternal: false,
        createdAt: new Date('2026-03-12T10:00:00Z'),
      },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Messages added to demo-bid-1');

  // ── 6. Bid: Silver Sponsor — countered (pending counter-offer) ────────────
  const bidSilver = await prisma.bid.upsert({
    where: { id: 'alice-bid-silver' },
    update: {},
    create: {
      id: 'alice-bid-silver',
      tenantId: TENANT_ID,
      eventId: ETHMILAN_2025_ID,
      itemId: ITEM_SILVER,
      sponsorCompanyId: COMPANY_ID,
      sponsorContactId: CONTACT_ID,
      status: 'countered',
      companyName: 'Acme Protocol',
      contactName: 'Alice Chen',
      email: ALICE_EMAIL,
      telegram: '@alicechen',
      proposedBudget: 17000,
      currency: 'USD',
      notes: 'Looking for a 15% discount given our multi-event commitment.',
      termsAccepted: true,
      createdAt: new Date('2026-02-20T08:00:00Z'),
      updatedAt: new Date('2026-03-01T12:00:00Z'),
    },
  });

  await prisma.counterOffer.upsert({
    where: { id: 'counter-silver-1' },
    update: {},
    create: {
      id: 'counter-silver-1',
      bidId: bidSilver.id,
      offeredPrice: 18500,
      currency: 'USD',
      message: "We can meet you at $18,500 — includes the Silver package plus one extra speaking slot. Valid for 7 days.",
      validUntil: new Date('2026-04-10T23:59:00Z'),
      status: 'pending',
      createdAt: new Date('2026-03-01T12:00:00Z'),
    },
  });

  await prisma.bidMessage.createMany({
    data: [
      {
        bidId: bidSilver.id,
        authorType: 'sponsor',
        authorId: ALICE_USER_ID,
        authorName: 'Alice Chen',
        content: "Submitting at $17k — we have budget constraints this quarter but strong interest in ETHMilan.",
        isInternal: false,
        createdAt: new Date('2026-02-20T08:05:00Z'),
      },
      {
        bidId: bidSilver.id,
        authorType: 'organizer',
        authorName: 'Sara Malik',
        content: "Thanks Alice. We can offer $18,500 with an extra speaking slot. Counter-offer sent — please review.",
        isInternal: false,
        createdAt: new Date('2026-03-01T12:05:00Z'),
      },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Silver Sponsor bid (countered) created');

  // ── 7. Bid: Coffee Station — accepted → paid order + invoice ──────────────
  const bidCoffee = await prisma.bid.upsert({
    where: { id: 'alice-bid-coffee' },
    update: {},
    create: {
      id: 'alice-bid-coffee',
      tenantId: TENANT_ID,
      eventId: ETHMILAN_2025_ID,
      itemId: ITEM_COFFEE,
      sponsorCompanyId: COMPANY_ID,
      sponsorContactId: CONTACT_ID,
      status: 'accepted',
      companyName: 'Acme Protocol',
      contactName: 'Alice Chen',
      email: ALICE_EMAIL,
      proposedBudget: 5000,
      currency: 'USD',
      notes: 'Happy to brand the coffee station — great touchpoint for developers.',
      termsAccepted: true,
      createdAt: new Date('2026-01-15T10:00:00Z'),
      updatedAt: new Date('2026-01-20T15:00:00Z'),
    },
  });

  await prisma.bidMessage.createMany({
    data: [
      {
        bidId: bidCoffee.id,
        authorType: 'organizer',
        authorName: 'Sara Malik',
        content: "Great news — your Coffee Station bid has been accepted! Payment link will follow shortly.",
        isInternal: false,
        createdAt: new Date('2026-01-20T15:00:00Z'),
      },
    ],
    skipDuplicates: true,
  });

  const orderCoffee = await prisma.order.upsert({
    where: { id: 'alice-order-coffee' },
    update: {},
    create: {
      id: 'alice-order-coffee',
      tenantId: TENANT_ID,
      eventId: ETHMILAN_2025_ID,
      bidId: bidCoffee.id,
      sponsorCompanyId: COMPANY_ID,
      sponsorContactId: CONTACT_ID,
      status: 'paid',
      currency: 'USD',
      subtotal: 5000,
      taxAmount: 0,
      discountAmount: 0,
      total: 5000,
      platformFeeRate: 0.10,
      platformFeeAmount: 500,
      merchantNetAmount: 4500,
      commissionSource: 'default',
      invoiceNumber: 'INV-202601-000042',
      paidAt: new Date('2026-01-22T11:30:00Z'),
      createdAt: new Date('2026-01-20T16:00:00Z'),
    },
  });

  await prisma.orderLine.upsert({
    where: { id: 'alice-orderline-coffee' },
    update: {},
    create: {
      id: 'alice-orderline-coffee',
      orderId: orderCoffee.id,
      itemId: ITEM_COFFEE,
      quantity: 1,
      unitPrice: 5000,
      total: 5000,
      label: 'Coffee Station Sponsor',
    },
  });

  await prisma.payment.upsert({
    where: { id: 'alice-payment-coffee' },
    update: {},
    create: {
      id: 'alice-payment-coffee',
      orderId: orderCoffee.id,
      provider: 'stripe',
      externalId: 'cs_test_acme_coffee_001',
      amount: 5000,
      currency: 'USD',
      status: 'succeeded',
      createdAt: new Date('2026-01-22T11:30:00Z'),
    },
  });

  await prisma.invoice.upsert({
    where: { id: 'alice-invoice-coffee' },
    update: {},
    create: {
      id: 'alice-invoice-coffee',
      orderId: orderCoffee.id,
      tenantId: TENANT_ID,
      invoiceNumber: 'INV-202601-000042',
      billedToEmail: ALICE_EMAIL,
      billedToName: 'Alice Chen',
      billedToCompany: 'Acme Protocol',
      subtotal: 5000,
      platformFee: 500,
      total: 5000,
      currency: 'USD',
      lines: [{ label: 'Coffee Station Sponsor', quantity: 1, unitPrice: 5000, total: 5000 }],
      issuedAt: new Date('2026-01-22T11:30:00Z'),
    },
  });
  console.log('✓ Coffee Station bid (accepted + paid + invoice) created');

  // ── 8. Bid: Badge/Lanyard — accepted, payment pending ─────────────────────
  const bidBadge = await prisma.bid.upsert({
    where: { id: 'alice-bid-badge' },
    update: {},
    create: {
      id: 'alice-bid-badge',
      tenantId: TENANT_ID,
      eventId: ETHMILAN_2025_ID,
      itemId: ITEM_BADGE,
      sponsorCompanyId: COMPANY_ID,
      sponsorContactId: CONTACT_ID,
      status: 'accepted',
      companyName: 'Acme Protocol',
      contactName: 'Alice Chen',
      email: ALICE_EMAIL,
      proposedBudget: 7500,
      currency: 'USD',
      notes: 'Badge/lanyard branding — 800 impressions all day.',
      termsAccepted: true,
      createdAt: new Date('2026-03-01T09:00:00Z'),
      updatedAt: new Date('2026-03-15T10:00:00Z'),
    },
  });

  const orderBadge = await prisma.order.upsert({
    where: { id: 'alice-order-badge' },
    update: {},
    create: {
      id: 'alice-order-badge',
      tenantId: TENANT_ID,
      eventId: ETHMILAN_2025_ID,
      bidId: bidBadge.id,
      sponsorCompanyId: COMPANY_ID,
      sponsorContactId: CONTACT_ID,
      status: 'payment_pending',
      currency: 'USD',
      subtotal: 7500,
      taxAmount: 0,
      discountAmount: 0,
      total: 7500,
      createdAt: new Date('2026-03-15T10:05:00Z'),
    },
  });

  await prisma.orderLine.upsert({
    where: { id: 'alice-orderline-badge' },
    update: {},
    create: {
      id: 'alice-orderline-badge',
      orderId: orderBadge.id,
      itemId: ITEM_BADGE,
      quantity: 1,
      unitPrice: 7500,
      total: 7500,
      label: 'Badge / Lanyard Sponsor',
    },
  });
  console.log('✓ Badge bid (accepted, payment pending) + order created');

  // ── 9. Bid: Lunch Sponsor — submitted (new) ───────────────────────────────
  await prisma.bid.upsert({
    where: { id: 'alice-bid-lunch' },
    update: {},
    create: {
      id: 'alice-bid-lunch',
      tenantId: TENANT_ID,
      eventId: ETHMILAN_2025_ID,
      itemId: ITEM_LUNCH,
      sponsorCompanyId: COMPANY_ID,
      sponsorContactId: CONTACT_ID,
      status: 'submitted',
      companyName: 'Acme Protocol',
      contactName: 'Alice Chen',
      email: ALICE_EMAIL,
      proposedBudget: 11000,
      currency: 'USD',
      notes: 'Interested in the networking lunch — great opportunity to meet ecosystem leads.',
      termsAccepted: true,
      createdAt: new Date('2026-03-28T14:00:00Z'),
      updatedAt: new Date('2026-03-28T14:00:00Z'),
    },
  });
  console.log('✓ Lunch Sponsor bid (submitted) created');

  // ── 10. Bid: Screen Ads — rejected ────────────────────────────────────────
  const bidScreen = await prisma.bid.upsert({
    where: { id: 'alice-bid-screen' },
    update: {},
    create: {
      id: 'alice-bid-screen',
      tenantId: TENANT_ID,
      eventId: ETHMILAN_2025_ID,
      itemId: ITEM_SCREEN,
      sponsorCompanyId: COMPANY_ID,
      sponsorContactId: CONTACT_ID,
      status: 'rejected',
      companyName: 'Acme Protocol',
      contactName: 'Alice Chen',
      email: ALICE_EMAIL,
      proposedBudget: 3000,
      currency: 'USD',
      notes: 'Digital ad placements across the venue screens.',
      termsAccepted: true,
      createdAt: new Date('2026-01-10T09:00:00Z'),
      updatedAt: new Date('2026-01-14T11:00:00Z'),
    },
  });

  await prisma.bidMessage.createMany({
    data: [
      {
        bidId: bidScreen.id,
        authorType: 'organizer',
        authorName: 'Sara Malik',
        content: "Thanks for your interest Alice. Unfortunately this slot has been allocated to an exclusive sponsor. We'd love to find another package that works for Acme.",
        isInternal: false,
        createdAt: new Date('2026-01-14T11:00:00Z'),
      },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Screen Ads bid (rejected) created');

  // ── 11. Bid: Newsletter — withdrawn ───────────────────────────────────────
  await prisma.bid.upsert({
    where: { id: 'alice-bid-newsletter' },
    update: {},
    create: {
      id: 'alice-bid-newsletter',
      tenantId: TENANT_ID,
      eventId: ETHMILAN_2025_ID,
      itemId: ITEM_NEWSLETTER,
      sponsorCompanyId: COMPANY_ID,
      sponsorContactId: CONTACT_ID,
      status: 'withdrawn',
      companyName: 'Acme Protocol',
      contactName: 'Alice Chen',
      email: ALICE_EMAIL,
      proposedBudget: 3000,
      currency: 'USD',
      notes: 'Newsletter slot — withdrawn due to budget reallocation.',
      termsAccepted: true,
      createdAt: new Date('2026-02-01T10:00:00Z'),
      updatedAt: new Date('2026-02-05T09:00:00Z'),
    },
  });
  console.log('✓ Newsletter bid (withdrawn) created');

  // ── 12. Second paid invoice — Side Stage (Token2049 event) ───────────────
  // Find a Token2049 item
  const token2049Item = await prisma.sponsorItem.findFirst({
    where: { eventId: TOKEN2049_ID },
  });

  if (token2049Item) {
    const bidSideStage = await prisma.bid.upsert({
      where: { id: 'alice-bid-sidestage-t2049' },
      update: {},
      create: {
        id: 'alice-bid-sidestage-t2049',
        tenantId: TENANT_ID,
        eventId: TOKEN2049_ID,
        itemId: token2049Item.id,
        sponsorCompanyId: COMPANY_ID,
        sponsorContactId: CONTACT_ID,
        status: 'accepted',
        companyName: 'Acme Protocol',
        contactName: 'Alice Chen',
        email: ALICE_EMAIL,
        proposedBudget: Number(token2049Item.listPrice ?? 10000),
        currency: 'USD',
        notes: 'Token2049 sponsorship — important for our Singapore market push.',
        termsAccepted: true,
        createdAt: new Date('2025-12-10T09:00:00Z'),
        updatedAt: new Date('2025-12-20T15:00:00Z'),
      },
    });

    const orderT2049 = await prisma.order.upsert({
      where: { id: 'alice-order-t2049' },
      update: {},
      create: {
        id: 'alice-order-t2049',
        tenantId: TENANT_ID,
        eventId: TOKEN2049_ID,
        bidId: bidSideStage.id,
        sponsorCompanyId: COMPANY_ID,
        status: 'paid',
        currency: 'USD',
        subtotal: Number(token2049Item.listPrice ?? 10000),
        taxAmount: 0,
        discountAmount: 0,
        total: Number(token2049Item.listPrice ?? 10000),
        platformFeeRate: 0.10,
        platformFeeAmount: Number(token2049Item.listPrice ?? 10000) * 0.1,
        merchantNetAmount: Number(token2049Item.listPrice ?? 10000) * 0.9,
        commissionSource: 'default',
        invoiceNumber: 'INV-202512-000019',
        paidAt: new Date('2025-12-22T14:00:00Z'),
        createdAt: new Date('2025-12-20T16:00:00Z'),
      },
    });

    await prisma.orderLine.upsert({
      where: { id: 'alice-orderline-t2049' },
      update: {},
      create: {
        id: 'alice-orderline-t2049',
        orderId: orderT2049.id,
        itemId: token2049Item.id,
        quantity: 1,
        unitPrice: Number(token2049Item.listPrice ?? 10000),
        total: Number(token2049Item.listPrice ?? 10000),
        label: token2049Item.publicTitle,
      },
    });

    await prisma.payment.upsert({
      where: { id: 'alice-payment-t2049' },
      update: {},
      create: {
        id: 'alice-payment-t2049',
        orderId: orderT2049.id,
        provider: 'stripe',
        externalId: 'cs_test_acme_t2049_001',
        amount: Number(token2049Item.listPrice ?? 10000),
        currency: 'USD',
        status: 'succeeded',
        createdAt: new Date('2025-12-22T14:00:00Z'),
      },
    });

    await prisma.invoice.upsert({
      where: { id: 'alice-invoice-t2049' },
      update: {},
      create: {
        id: 'alice-invoice-t2049',
        orderId: orderT2049.id,
        tenantId: TENANT_ID,
        invoiceNumber: 'INV-202512-000019',
        billedToEmail: ALICE_EMAIL,
        billedToName: 'Alice Chen',
        billedToCompany: 'Acme Protocol',
        subtotal: Number(token2049Item.listPrice ?? 10000),
        platformFee: Number(token2049Item.listPrice ?? 10000) * 0.1,
        total: Number(token2049Item.listPrice ?? 10000),
        currency: 'USD',
        lines: [{ label: token2049Item.publicTitle, quantity: 1, unitPrice: Number(token2049Item.listPrice ?? 10000), total: Number(token2049Item.listPrice ?? 10000) }],
        issuedAt: new Date('2025-12-22T14:00:00Z'),
      },
    });
    console.log('✓ Token2049 bid (accepted + paid + invoice) created');
  }

  // ── 13. Saved items ────────────────────────────────────────────────────────
  const savedItems = [
    { entityType: 'event', entityId: ETHMILAN_2026_ID },
    { entityType: 'event', entityId: ETHBERLIN_2026_ID },
    { entityType: 'event', entityId: DEVCONNECT_ID },
    { entityType: 'item',  entityId: ITEM_SIDE_STAGE },
    { entityType: 'item',  entityId: ITEM_COMMUNITY },
  ];

  for (const s of savedItems) {
    await prisma.savedItem.upsert({
      where: { userId_entityType_entityId: { userId: ALICE_USER_ID, entityType: s.entityType, entityId: s.entityId } },
      update: {},
      create: { userId: ALICE_USER_ID, entityType: s.entityType, entityId: s.entityId },
    });
  }
  console.log('✓ Saved items created (3 events, 2 packages)');

  console.log('\n🎉 Alice account fully populated!');
  console.log('   Login: alice@acme.xyz / alice-2026');
  console.log('   Portal: http://localhost:3000/portal');
  console.log('\n   Bids:');
  console.log('     demo-bid-1       Premium Sponsor     under_review  (with messages)');
  console.log('     alice-bid-silver Silver Sponsor       countered     (counter-offer pending action)');
  console.log('     alice-bid-badge  Badge/Lanyard        accepted      (payment pending)');
  console.log('     alice-bid-lunch  Lunch Sponsor        submitted');
  console.log('     alice-bid-screen Screen & Digital Ads rejected      (with message)');
  console.log('     alice-bid-nl     Newsletter           withdrawn');
  console.log('   Orders:  2 paid  (Coffee, Token2049), 1 payment_pending (Badge)');
  console.log('   Invoices: 2 (INV-202601-000042, INV-202512-000019)');
  console.log('   Saved:   3 events, 2 packages');
}

main().catch(console.error).finally(() => prisma.$disconnect());
