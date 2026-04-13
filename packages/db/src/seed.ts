import { PrismaClient } from '../generated/client';
import { slugify } from '@moongate/utils';
import { randomBytes, createHash } from 'crypto';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
}

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Moongate demo data...');

  // --- Tenant ---
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'ethglobal' },
    update: {},
    create: {
      slug: 'ethglobal',
      name: 'ETHGlobal',
      primaryColor: '#6366f1',
      accentColor: '#f59e0b',
      currency: 'USD',
    },
  });
  console.log('✓ Tenant:', tenant.slug);

  // --- Team members ---
  const teamMembers = [
    { email: 'admin@ethglobal.com',      name: 'Alex Rivera',    password: 'admin-2026',      role: 'organizer_owner',      bio: 'Co-founder of ETHGlobal. Building the global Ethereum community.',   company: 'ETHGlobal', jobTitle: 'Co-Founder & CEO',      location: 'San Francisco, CA', segment: 'builder' as const, tags: ['ethereum', 'events', 'community'] },
    { email: 'sales@ethglobal.com',      name: 'Sara Malik',     password: 'sales-2026',      role: 'organizer_sales',      bio: 'Head of Sponsorship. Connecting sponsors with the right events.',     company: 'ETHGlobal', jobTitle: 'Head of Sponsorship',   location: 'New York, NY',      segment: 'enterprise' as const, tags: ['sales', 'partnerships', 'defi'] },
    { email: 'ops@ethglobal.com',        name: 'James Park',     password: 'ops-2026',        role: 'organizer_ops',        bio: 'Operations lead ensuring every event runs flawlessly.',              company: 'ETHGlobal', jobTitle: 'Head of Operations',   location: 'Toronto, Canada',   segment: 'builder' as const, tags: ['ops', 'logistics'] },
    { email: 'growth@ethglobal.com',     name: 'Maya Patel',     password: 'growth-2026',     role: 'organizer_growth',     bio: 'Growth & outreach — expanding the ETHGlobal sponsor network.',       company: 'ETHGlobal', jobTitle: 'Growth Lead',           location: 'London, UK',        segment: 'community' as const, tags: ['growth', 'outreach', 'web3'] },
    { email: 'analytics@ethglobal.com',  name: 'Chris Wong',     password: 'analytics-2026',  role: 'organizer_analytics',  bio: 'Data & analytics — making sense of sponsor and attendee data.',      company: 'ETHGlobal', jobTitle: 'Data Analyst',          location: 'Singapore',         segment: 'builder' as const, tags: ['data', 'analytics'] },
    { email: 'compliance@ethglobal.com', name: 'Priya Sharma',   password: 'compliance-2026', role: 'organizer_compliance', bio: 'KYC & compliance, ensuring all sponsors meet our standards.',         company: 'ETHGlobal', jobTitle: 'Compliance Manager',    location: 'Dubai, UAE',        segment: 'enterprise' as const, tags: ['kyc', 'compliance', 'legal'] },
    { email: 'finance@ethglobal.com',    name: 'Tom Bradley',    password: 'finance-2026',    role: 'organizer_finance',    bio: 'Finance lead overseeing payments, invoicing, and reconciliation.',   company: 'ETHGlobal', jobTitle: 'Finance Manager',       location: 'Edinburgh, UK',     segment: 'enterprise' as const, tags: ['finance', 'payments'] },
    { email: 'viewer@ethglobal.com',     name: 'Dana Lee',       password: 'viewer-2026',     role: 'organizer_viewer',     bio: 'Advisor with read-only access for reporting purposes.',               company: 'ETHGlobal', jobTitle: 'Board Advisor',         location: 'Seoul, South Korea', segment: 'investor' as const, tags: ['advisory'] },
  ];

  const seededUsers: Record<string, { id: string }> = {};

  for (const member of teamMembers) {
    const passwordHash = hashPassword(member.password);
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: { passwordHash, name: member.name },
      create: { email: member.email, name: member.name, passwordHash, emailVerified: true },
    });
    seededUsers[member.email] = user;

    await prisma.membership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: {},
      create: { userId: user.id, tenantId: tenant.id, role: member.role, joinedAt: new Date() },
    });

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        tenantId: tenant.id,
        bio: member.bio,
        company: member.company,
        jobTitle: member.jobTitle,
        location: member.location,
        segment: member.segment,
        tags: member.tags,
      },
    });
  }

  const owner = seededUsers['admin@ethglobal.com'];
  const salesUser = seededUsers['sales@ethglobal.com'];
  console.log(`✓ Team members: ${teamMembers.length} accounts with passwords and profiles`);

  // --- Event ---
  const event = await prisma.event.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'ethmilan-2025' } },
    update: {},
    create: {
      tenantId: tenant.id,
      slug: 'ethmilan-2025',
      name: 'ETHMilan 2025',
      tagline: 'The Premier Ethereum Conference in Southern Europe',
      description: `ETHMilan 2025 brings together the brightest minds in Ethereum, DeFi, and Web3 for two days of talks, workshops, and networking in the heart of Milan. Join 800+ developers, founders, investors, and ecosystem builders shaping the future of decentralized technology.`,
      startDate: new Date('2025-09-18'),
      endDate: new Date('2025-09-19'),
      location: 'Base Milano, Via Bergognone 34',
      city: 'Milan',
      country: 'Italy',
      timezone: 'Europe/Rome',
      websiteUrl: 'https://ethmilan.xyz',
      status: 'published',
    },
  });

  // Branding
  await prisma.eventBranding.upsert({
    where: { eventId: event.id },
    update: {},
    create: {
      eventId: event.id,
      primaryColor: '#6366f1',
      accentColor: '#f59e0b',
      backgroundColor: '#0f0f1a',
      textColor: '#f8f9fa',
      heroImageUrl: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200',
      logoUrl: '/demo/ethmilan-logo.svg',
    },
  });

  // Stats
  await prisma.eventStats.upsert({
    where: { eventId: event.id },
    update: {},
    create: {
      eventId: event.id,
      expectedAttendees: 800,
      onlineReach: 15000,
      mediaReach: 50000,
      newsletterSubs: 8500,
      socialFollowers: { twitter: 12000, linkedin: 4500, farcaster: 3200 },
      internationalPct: 60,
      audienceProfile: 'Ethereum developers (45%), DeFi/protocol founders (20%), investors & VCs (15%), ecosystem builders (10%), media (10%)',
      topicTags: ['Ethereum', 'DeFi', 'L2s', 'ZK', 'NFT', 'DAOs', 'Web3'],
      previousEditions: 2,
      sponsorsLastEdition: 18,
    },
  });

  console.log('✓ Event:', event.name);

  // --- Helper: create item ---
  async function upsertItem(data: {
    slug: string;
    publicTitle: string;
    internalTitle?: string;
    shortDescription: string;
    longDescription?: string;
    category: string;
    mode: string;
    currency?: string;
    listPrice?: number;
    reservePrice?: number;
    minimumBid?: number;
    maximumBid?: number;
    bidAllowed?: boolean;
    quantityTotal?: number;
    isExclusive?: boolean;
    status?: string;
    featured?: boolean;
    packageTier?: string;
    sortOrder?: number;
    onRequest?: boolean;
    benefits?: Array<{ type: string; label: string; value?: string; quantity?: number; sortOrder: number }>;
  }) {
    const item = await prisma.sponsorItem.upsert({
      where: { eventId_slug: { eventId: event.id, slug: data.slug } },
      update: {},
      create: {
        eventId: event.id,
        tenantId: tenant.id,
        slug: data.slug,
        publicTitle: data.publicTitle,
        internalTitle: data.internalTitle,
        shortDescription: data.shortDescription,
        longDescription: data.longDescription,
        category: data.category,
        mode: data.mode,
        currency: data.currency ?? 'USD',
        listPrice: data.listPrice,
        reservePrice: data.reservePrice,
        minimumBid: data.minimumBid,
        maximumBid: data.maximumBid,
        bidAllowed: data.bidAllowed ?? false,
        quantityTotal: data.quantityTotal,
        isExclusive: data.isExclusive ?? false,
        status: data.status ?? 'published',
        featured: data.featured ?? false,
        packageTier: data.packageTier,
        sortOrder: data.sortOrder ?? 0,
        onRequest: data.onRequest ?? false,
        visibleToPublic: true,
        checkoutEnabled: data.mode === 'fixed_price' || data.mode === 'hybrid',
      },
    });

    if (data.benefits) {
      for (const benefit of data.benefits) {
        await prisma.sponsorItemBenefit.upsert({
          where: { id: `${item.id}-${benefit.sortOrder}` },
          update: {},
          create: {
            id: `${item.id}-${benefit.sortOrder}`,
            itemId: item.id,
            ...benefit,
          },
        });
      }
    }

    return item;
  }

  // --- Title Sponsor ---
  await upsertItem({
    slug: 'title-sponsor',
    publicTitle: 'Title Sponsor',
    shortDescription: 'Maximum visibility. Own the ETHMilan 2025 name, stage, and narrative.',
    longDescription: 'The Title Sponsor receives exclusive "Presented by" co-branding across all ETHMilan channels, the opening keynote slot, the largest booth on the event floor, and premiere logo placement everywhere from the venue entrance to livestream overlays.',
    category: 'title_sponsorship',
    mode: 'sealed_bid',
    currency: 'USD',
    listPrice: 50000,
    minimumBid: 40000,
    maximumBid: 65000,
    bidAllowed: true,
    quantityTotal: 1,
    isExclusive: true,
    featured: true,
    packageTier: 'title',
    sortOrder: 0,
    benefits: [
      { type: 'stage_access', label: 'Stage Access', value: 'Keynote slot (30 min)', sortOrder: 1 },
      { type: 'booth_size', label: 'Booth Size', value: '6×6m premium corner booth', sortOrder: 2 },
      { type: 'logo_placement', label: 'Logo Placement', value: 'Top of all materials — "Presented by"', sortOrder: 3 },
      { type: 'website_visibility', label: 'Website', value: 'Hero placement + dedicated sponsor page', sortOrder: 4 },
      { type: 'social_mentions', label: 'Social Mentions', value: '10+ posts across all channels', sortOrder: 5 },
      { type: 'newsletter_mentions', label: 'Newsletter Mentions', value: '4 issues (pre, during, post)', sortOrder: 6 },
      { type: 'pass_count', label: 'Passes', quantity: 10, sortOrder: 7 },
      { type: 'custom', label: 'MC Mentions', value: 'All stage transitions', sortOrder: 8 },
    ],
  });

  // --- Premium Pack ---
  await upsertItem({
    slug: 'premium-sponsor',
    publicTitle: 'Premium Sponsor',
    shortDescription: 'Major stage presence, prominent booth, and deep audience engagement.',
    longDescription: 'The Premium sponsorship package gives your brand a main stage panel slot, a 4×4m booth in the prime networking area, and prominent placement across all digital and physical channels throughout the event.',
    category: 'sponsor_pack',
    mode: 'fixed_price',
    currency: 'USD',
    listPrice: 30000,
    quantityTotal: 3,
    featured: true,
    packageTier: 'premium',
    sortOrder: 1,
    status: 'published',
    benefits: [
      { type: 'stage_access', label: 'Stage Access', value: 'Panel slot (45 min)', sortOrder: 1 },
      { type: 'booth_size', label: 'Booth Size', value: '4×4m booth', sortOrder: 2 },
      { type: 'logo_placement', label: 'Logo Placement', value: 'Top tier — all print and digital', sortOrder: 3 },
      { type: 'website_visibility', label: 'Website', value: 'Homepage + program page', sortOrder: 4 },
      { type: 'social_mentions', label: 'Social Mentions', value: '5+ posts', sortOrder: 5 },
      { type: 'newsletter_mentions', label: 'Newsletter Mentions', value: '2 issues', sortOrder: 6 },
      { type: 'pass_count', label: 'Passes', quantity: 6, sortOrder: 7 },
    ],
  });

  // --- Mid-Tier Pack ---
  await upsertItem({
    slug: 'silver-sponsor',
    publicTitle: 'Silver Sponsor',
    shortDescription: 'Strong brand visibility and networking access at a mid-tier investment.',
    longDescription: 'Silver sponsorship delivers solid brand exposure through logo placements, a 3×2m booth, a speaking lightning talk, and digital mentions — ideal for protocols and teams looking to build awareness in the European Ethereum community.',
    category: 'sponsor_pack',
    mode: 'hybrid',
    currency: 'USD',
    listPrice: 20000,
    minimumBid: 15000,
    bidAllowed: true,
    quantityTotal: 5,
    featured: false,
    packageTier: 'silver',
    sortOrder: 2,
    benefits: [
      { type: 'stage_access', label: 'Stage Access', value: 'Lightning talk (10 min)', sortOrder: 1 },
      { type: 'booth_size', label: 'Booth Size', value: '3×2m booth', sortOrder: 2 },
      { type: 'logo_placement', label: 'Logo Placement', value: 'Second tier', sortOrder: 3 },
      { type: 'website_visibility', label: 'Website', value: 'Program page', sortOrder: 4 },
      { type: 'social_mentions', label: 'Social Mentions', value: '3 posts', sortOrder: 5 },
      { type: 'newsletter_mentions', label: 'Newsletter Mentions', value: '1 issue', sortOrder: 6 },
      { type: 'pass_count', label: 'Passes', quantity: 4, sortOrder: 7 },
    ],
  });

  // --- Community Pack ---
  await upsertItem({
    slug: 'community-sponsor',
    publicTitle: 'Community Sponsor',
    shortDescription: 'Entry-level brand presence — perfect for ecosystem projects and DAOs.',
    longDescription: 'Community sponsorship is designed for smaller teams, ecosystems, and DAOs who want to show up at ETHMilan without the full-booth commitment. You get logo presence, digital mentions, and attendee passes.',
    category: 'sponsor_pack',
    mode: 'fixed_price',
    currency: 'USD',
    listPrice: 10000,
    quantityTotal: 10,
    packageTier: 'community',
    sortOrder: 3,
    benefits: [
      { type: 'logo_placement', label: 'Logo Placement', value: 'Third tier', sortOrder: 1 },
      { type: 'website_visibility', label: 'Website', value: 'Sponsors page', sortOrder: 2 },
      { type: 'social_mentions', label: 'Social Mentions', value: '1 mention', sortOrder: 3 },
      { type: 'pass_count', label: 'Passes', quantity: 2, sortOrder: 4 },
    ],
  });

  // --- Add-ons ---
  await upsertItem({
    slug: 'coffee-sponsor',
    publicTitle: 'Coffee Station Sponsor',
    shortDescription: 'Brand the coffee station serving 800 attendees all day.',
    category: 'food_beverage',
    mode: 'fixed_price',
    currency: 'USD',
    listPrice: 5000,
    quantityTotal: 2,
    sortOrder: 10,
    benefits: [
      { type: 'custom', label: 'Logo on coffee station', value: 'Full wrap', sortOrder: 1 },
      { type: 'custom', label: 'Branded cups', value: '1000 units', sortOrder: 2 },
      { type: 'pass_count', label: 'Passes', quantity: 1, sortOrder: 3 },
    ],
  });

  await upsertItem({
    slug: 'lunch-sponsor',
    publicTitle: 'Lunch Sponsor',
    shortDescription: 'Sponsor the networking lunch for 800 attendees — maximum dwell time.',
    category: 'food_beverage',
    mode: 'hybrid',
    currency: 'USD',
    listPrice: 12000,
    minimumBid: 9000,
    bidAllowed: true,
    quantityTotal: 1,
    isExclusive: true,
    sortOrder: 11,
    benefits: [
      { type: 'custom', label: 'Branded serving area', value: 'Full signage', sortOrder: 1 },
      { type: 'custom', label: 'MC announcement', value: 'Before and after lunch', sortOrder: 2 },
      { type: 'social_mentions', label: 'Social Mentions', value: '2 posts', sortOrder: 3 },
      { type: 'pass_count', label: 'Passes', quantity: 2, sortOrder: 4 },
    ],
  });

  await upsertItem({
    slug: 'badge-sponsor',
    publicTitle: 'Badge / Lanyard Sponsor',
    shortDescription: 'Your logo on every attendee badge and lanyard for maximum impressions.',
    category: 'badge',
    mode: 'fixed_price',
    currency: 'USD',
    listPrice: 7500,
    quantityTotal: 1,
    isExclusive: true,
    sortOrder: 12,
    benefits: [
      { type: 'custom', label: 'Badge logo placement', value: 'Front center', sortOrder: 1 },
      { type: 'custom', label: 'Lanyard branding', value: 'Full wrap print', sortOrder: 2 },
      { type: 'pass_count', label: 'Passes', quantity: 1, sortOrder: 3 },
    ],
  });

  await upsertItem({
    slug: 'side-stage-branding',
    publicTitle: 'Side Stage Branding Package',
    shortDescription: 'Brand the secondary stage used for workshops and breakout sessions.',
    category: 'stage',
    mode: 'fixed_price',
    currency: 'USD',
    listPrice: 8000,
    quantityTotal: 1,
    isExclusive: true,
    sortOrder: 13,
    benefits: [
      { type: 'stage_access', label: 'Stage Naming Rights', value: '"[Brand] Stage"', sortOrder: 1 },
      { type: 'custom', label: 'Stage backdrop branding', value: 'Full width', sortOrder: 2 },
      { type: 'custom', label: 'Standing banner × 2', sortOrder: 3 },
      { type: 'pass_count', label: 'Passes', quantity: 2, sortOrder: 4 },
    ],
  });

  await upsertItem({
    slug: 'screen-pack',
    publicTitle: 'Screen & Digital Ads Pack',
    shortDescription: 'Rotating brand ads on all venue screens during breaks and transitions.',
    category: 'ad_placement',
    mode: 'fixed_price',
    currency: 'USD',
    listPrice: 4500,
    quantityTotal: 4,
    sortOrder: 14,
    benefits: [
      { type: 'custom', label: 'Screen slots', value: '30s looping ad on all venue screens', sortOrder: 1 },
      { type: 'custom', label: 'Frequency', value: 'Every 5 min during breaks', sortOrder: 2 },
    ],
  });

  await upsertItem({
    slug: 'newsletter-sponsor',
    publicTitle: 'Newsletter Sponsor',
    shortDescription: 'Dedicated sponsor section in the ETHMilan newsletter (8,500 subs).',
    category: 'media',
    mode: 'fixed_price',
    currency: 'USD',
    listPrice: 3000,
    quantityTotal: 6,
    sortOrder: 15,
    benefits: [
      { type: 'newsletter_mentions', label: 'Newsletter placement', value: 'Full sponsor section', sortOrder: 1 },
      { type: 'custom', label: 'Subscribers', value: '8,500+', sortOrder: 2 },
    ],
  });

  await upsertItem({
    slug: 'custom-package',
    publicTitle: 'Custom Package',
    shortDescription: 'Design a package that fits your goals. Tell us what you need.',
    category: 'custom',
    mode: 'request_only',
    currency: 'USD',
    onRequest: true,
    sortOrder: 99,
    benefits: [],
  });

  console.log('✓ Sponsor items created');

  // --- Demo bid ---
  const demoCompany = await prisma.sponsorCompany.upsert({
    where: { id: 'demo-company-1' },
    update: {},
    create: {
      id: 'demo-company-1',
      tenantId: tenant.id,
      name: 'Acme Protocol',
      website: 'https://acme.xyz',
      industry: 'DeFi',
    },
  });

  // Sponsor portal user — logs in at /auth/login (Password tab, no org slug needed)
  await prisma.user.upsert({
    where: { email: 'alice@acme.xyz' },
    update: {},
    create: {
      email: 'alice@acme.xyz',
      name: 'Alice Chen',
      emailVerified: true,
      passwordHash: hashPassword('alice-2026'),
    },
  });

  const demoContact = await prisma.sponsorContact.upsert({
    where: { id: 'demo-contact-1' },
    update: {},
    create: {
      id: 'demo-contact-1',
      tenantId: tenant.id,
      sponsorCompanyId: demoCompany.id,
      name: 'Alice Chen',
      email: 'alice@acme.xyz',
      telegram: '@alicechen',
    },
  });

  const premiumItem = await prisma.sponsorItem.findFirst({
    where: { eventId: event.id, slug: 'premium-sponsor' },
  });

  if (premiumItem) {
    await prisma.bid.upsert({
      where: { id: 'demo-bid-1' },
      update: {},
      create: {
        id: 'demo-bid-1',
        tenantId: tenant.id,
        eventId: event.id,
        itemId: premiumItem.id,
        sponsorCompanyId: demoCompany.id,
        sponsorContactId: demoContact.id,
        status: 'under_review',
        companyName: 'Acme Protocol',
        contactName: 'Alice Chen',
        email: 'alice@acme.xyz',
        telegram: '@alicechen',
        proposedBudget: 25000,
        currency: 'USD',
        notes: 'We are very interested in the Premium package. We have been growing fast in the European market and ETHMilan is a perfect fit. Can we also discuss a speaking slot?',
        customAsks: 'Panel slot topic: "DeFi composability in 2025"',
        termsAccepted: true,
        internalNotes: 'Strong lead - follow up about panel topic',
        assignedToId: salesUser.id,
      },
    });

    console.log('✓ Demo bid created');
  }

  // ── Seed crowdfunding campaigns ───────────────────────────────────────────
  // Idempotent: uses fixed stable IDs to avoid duplicates on re-run

  const campaignItems = [
    { slug: 'community-sponsor' },
    { slug: 'newsletter-sponsor' },
    { slug: 'badge-sponsor' },
  ];

  for (const ci of campaignItems) {
    const item = await prisma.sponsorItem.findFirst({
      where: { eventId: event.id, slug: ci.slug },
    });
    if (!item) continue;

    // Each item gets 2 active demo campaigns with different entities
    const campaignDefs = [
      {
        id: `demo-campaign-${ci.slug}-1`,
        entityName: 'DecentraVerse Foundation',
        entityDescription: 'A non-profit advancing decentralised education and open-source tooling in the Ethereum ecosystem.',
        entityWebsite: 'https://decentraverse.org',
        contactName: 'Marco Fiori',
        contactEmail: 'marco@decentraverse.org',
        goalAmount: Number(item.listPrice ?? 15000),
        raisedAmount: Math.round(Number(item.listPrice ?? 15000) * 0.43),
        deadline: new Date('2026-07-01'),
        approvalStatus: 'approved' as const,
        approvedAt: new Date('2026-03-20'),
        approvedBy: owner?.id ?? null,
      },
      {
        id: `demo-campaign-${ci.slug}-2`,
        entityName: 'Protokol Labs',
        entityDescription: 'A developer collective building layer-2 tooling for EVM-compatible chains.',
        entityWebsite: 'https://protokollabs.xyz',
        contactName: 'Aisha Mensah',
        contactEmail: 'aisha@protokollabs.xyz',
        goalAmount: Number(item.listPrice ?? 15000),
        raisedAmount: Math.round(Number(item.listPrice ?? 15000) * 0.18),
        deadline: new Date('2026-07-15'),
        approvalStatus: 'approved' as const,
        approvedAt: new Date('2026-03-22'),
        approvedBy: owner?.id ?? null,
      },
    ];

    for (const cd of campaignDefs) {
      await prisma.crowdfundCampaign.upsert({
        where: { id: cd.id },
        update: {},
        create: {
          id: cd.id,
          tenantId: tenant.id,
          eventId: event.id,
          itemId: item.id,
          entityName: cd.entityName,
          entityDescription: cd.entityDescription,
          entityWebsite: cd.entityWebsite,
          contactName: cd.contactName,
          contactEmail: cd.contactEmail,
          goalAmount: cd.goalAmount,
          raisedAmount: cd.raisedAmount,
          currency: 'USD',
          deadline: cd.deadline,
          status: 'active',
          approvalStatus: cd.approvalStatus,
          approvedAt: cd.approvedAt,
          approvedBy: cd.approvedBy,
          verificationStatus: 'none',
        },
      });
    }
  }

  console.log('✓ Demo crowdfunding campaigns created');

  // ── Additional demo events ────────────────────────────────────────────────

  // Helper: seed a full event with items
  async function seedEvent(cfg: {
    slug: string;
    name: string;
    tagline: string;
    description: string;
    startDate: Date;
    endDate: Date;
    location: string;
    city: string;
    country: string;
    timezone: string;
    websiteUrl: string;
    primaryColor: string;
    accentColor: string;
    heroImageUrl: string;
    attendees: number;
    onlineReach: number;
    items: Array<{
      slug: string;
      publicTitle: string;
      shortDescription: string;
      category: string;
      mode: string;
      listPrice?: number;
      minimumBid?: number;
      bidAllowed?: boolean;
      quantityTotal?: number;
      isExclusive?: boolean;
      featured?: boolean;
      packageTier?: string;
      sortOrder: number;
      onRequest?: boolean;
      benefits: Array<{ type: string; label: string; value?: string; quantity?: number; sortOrder: number }>;
    }>;
  }) {
    const ev = await prisma.event.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: cfg.slug } },
      update: { status: 'published', accessMode: 'public' },
      create: {
        tenantId: tenant.id,
        slug: cfg.slug,
        name: cfg.name,
        tagline: cfg.tagline,
        description: cfg.description,
        startDate: cfg.startDate,
        endDate: cfg.endDate,
        location: cfg.location,
        city: cfg.city,
        country: cfg.country,
        timezone: cfg.timezone,
        websiteUrl: cfg.websiteUrl,
        status: 'published',
        accessMode: 'public',
      },
    });

    await prisma.eventBranding.upsert({
      where: { eventId: ev.id },
      update: {},
      create: {
        eventId: ev.id,
        primaryColor: cfg.primaryColor,
        accentColor: cfg.accentColor,
        backgroundColor: '#0f0f1a',
        textColor: '#f8f9fa',
        heroImageUrl: cfg.heroImageUrl,
      },
    });

    await prisma.eventStats.upsert({
      where: { eventId: ev.id },
      update: {},
      create: {
        eventId: ev.id,
        expectedAttendees: cfg.attendees,
        onlineReach: cfg.onlineReach,
        internationalPct: 55,
        topicTags: ['Ethereum', 'DeFi', 'L2s', 'ZK', 'Web3'],
      },
    });

    for (const item of cfg.items) {
      const si = await prisma.sponsorItem.upsert({
        where: { eventId_slug: { eventId: ev.id, slug: item.slug } },
        update: {},
        create: {
          eventId: ev.id,
          tenantId: tenant.id,
          slug: item.slug,
          publicTitle: item.publicTitle,
          shortDescription: item.shortDescription,
          category: item.category,
          mode: item.mode,
          currency: 'USD',
          listPrice: item.listPrice,
          minimumBid: item.minimumBid,
          bidAllowed: item.bidAllowed ?? false,
          quantityTotal: item.quantityTotal,
          isExclusive: item.isExclusive ?? false,
          featured: item.featured ?? false,
          packageTier: item.packageTier,
          sortOrder: item.sortOrder,
          onRequest: item.onRequest ?? false,
          visibleToPublic: true,
          checkoutEnabled: item.mode === 'fixed_price' || item.mode === 'hybrid',
          status: 'published',
        },
      });

      for (const b of item.benefits) {
        await prisma.sponsorItemBenefit.upsert({
          where: { id: `${si.id}-${b.sortOrder}` },
          update: {},
          create: { id: `${si.id}-${b.sortOrder}`, itemId: si.id, ...b },
        });
      }
    }

    console.log(`✓ Event: ${cfg.name}`);
    return ev;
  }

  // ── ETHMilan 2026 ─────────────────────────────────────────────────────────
  await seedEvent({
    slug: 'ethmilan-2026',
    name: 'ETHMilan 2026',
    tagline: 'Southern Europe\'s Flagship Ethereum Summit Returns',
    description: 'ETHMilan 2026 builds on the success of 2025 with a larger venue, 1,200+ attendees, and an expanded programme spanning three tracks: core protocol, DeFi & RWA, and consumer applications. Three days of talks, workshops, and the best networking in Southern Europe.',
    startDate: new Date('2026-09-24'),
    endDate: new Date('2026-09-26'),
    location: 'Superstudio Più, Via Tortona 27',
    city: 'Milan',
    country: 'Italy',
    timezone: 'Europe/Rome',
    websiteUrl: 'https://ethmilan.xyz',
    primaryColor: '#6366f1',
    accentColor: '#f59e0b',
    heroImageUrl: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200',
    attendees: 1200,
    onlineReach: 25000,
    items: [
      {
        slug: 'title-sponsor',
        publicTitle: 'Title Sponsor',
        shortDescription: '"Presented by" co-branding across the entire event — exclusive, one slot.',
        category: 'title_sponsorship', mode: 'sealed_bid',
        listPrice: 75000, minimumBid: 60000, bidAllowed: true,
        quantityTotal: 1, isExclusive: true, featured: true, packageTier: 'title', sortOrder: 0,
        benefits: [
          { type: 'stage_access', label: 'Stage Access', value: 'Opening keynote (45 min)', sortOrder: 1 },
          { type: 'booth_size', label: 'Booth', value: '8×8m corner booth', sortOrder: 2 },
          { type: 'logo_placement', label: 'Logo', value: '"Presented by" — all channels', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 15, sortOrder: 4 },
          { type: 'social_mentions', label: 'Social', value: '15+ posts', sortOrder: 5 },
        ],
      },
      {
        slug: 'platinum-sponsor',
        publicTitle: 'Platinum Sponsor',
        shortDescription: 'Top-tier presence: main stage panel, 6×4m booth, and premier digital placement.',
        category: 'sponsor_pack', mode: 'fixed_price',
        listPrice: 45000, quantityTotal: 2, featured: true, packageTier: 'platinum', sortOrder: 1,
        benefits: [
          { type: 'stage_access', label: 'Stage Access', value: 'Main stage panel (30 min)', sortOrder: 1 },
          { type: 'booth_size', label: 'Booth', value: '6×4m', sortOrder: 2 },
          { type: 'logo_placement', label: 'Logo', value: 'First tier — all placements', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 10, sortOrder: 4 },
          { type: 'social_mentions', label: 'Social', value: '8 posts', sortOrder: 5 },
        ],
      },
      {
        slug: 'gold-sponsor',
        publicTitle: 'Gold Sponsor',
        shortDescription: 'Strong stage presence with a 4×4m booth and side stage talk.',
        category: 'sponsor_pack', mode: 'fixed_price',
        listPrice: 30000, quantityTotal: 4, featured: true, packageTier: 'gold', sortOrder: 2,
        benefits: [
          { type: 'stage_access', label: 'Stage Access', value: 'Side stage talk (20 min)', sortOrder: 1 },
          { type: 'booth_size', label: 'Booth', value: '4×4m', sortOrder: 2 },
          { type: 'logo_placement', label: 'Logo', value: 'Second tier', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 6, sortOrder: 4 },
        ],
      },
      {
        slug: 'silver-sponsor',
        publicTitle: 'Silver Sponsor',
        shortDescription: 'Solid brand visibility with 3×2m booth and lightning talk.',
        category: 'sponsor_pack', mode: 'hybrid',
        listPrice: 18000, minimumBid: 14000, bidAllowed: true,
        quantityTotal: 8, packageTier: 'silver', sortOrder: 3,
        benefits: [
          { type: 'stage_access', label: 'Stage Access', value: 'Lightning talk (10 min)', sortOrder: 1 },
          { type: 'booth_size', label: 'Booth', value: '3×2m', sortOrder: 2 },
          { type: 'logo_placement', label: 'Logo', value: 'Third tier', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 4, sortOrder: 4 },
        ],
      },
      {
        slug: 'community-sponsor',
        publicTitle: 'Community Sponsor',
        shortDescription: 'Entry-level visibility — ideal for DAOs, protocols, and ecosystem projects.',
        category: 'sponsor_pack', mode: 'fixed_price',
        listPrice: 8000, quantityTotal: 15, packageTier: 'community', sortOrder: 4,
        benefits: [
          { type: 'logo_placement', label: 'Logo', value: 'Fourth tier', sortOrder: 1 },
          { type: 'pass_count', label: 'Passes', quantity: 2, sortOrder: 2 },
        ],
      },
      {
        slug: 'hackathon-sponsor',
        publicTitle: 'Hackathon Track Sponsor',
        shortDescription: 'Name and fund one of the ETHMilan 2026 hackathon tracks.',
        category: 'hackathon', mode: 'fixed_price',
        listPrice: 20000, quantityTotal: 3, isExclusive: false, sortOrder: 5,
        benefits: [
          { type: 'custom', label: 'Track naming rights', value: '"[Brand] Track"', sortOrder: 1 },
          { type: 'custom', label: 'Prize pool', value: 'You define it — minimum $5,000', sortOrder: 2 },
          { type: 'stage_access', label: 'Demo day judging', value: 'Keynote slot at closing', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 5, sortOrder: 4 },
        ],
      },
      {
        slug: 'badge-sponsor',
        publicTitle: 'Badge & Lanyard Sponsor',
        shortDescription: 'Your logo on every badge and lanyard worn by 1,200 attendees.',
        category: 'badge', mode: 'fixed_price',
        listPrice: 9000, quantityTotal: 1, isExclusive: true, sortOrder: 10,
        benefits: [
          { type: 'custom', label: 'Badge logo', value: 'Front center', sortOrder: 1 },
          { type: 'custom', label: 'Lanyard branding', value: 'Full wrap print', sortOrder: 2 },
          { type: 'pass_count', label: 'Passes', quantity: 2, sortOrder: 3 },
        ],
      },
      {
        slug: 'afterparty-sponsor',
        publicTitle: 'After-Party Sponsor',
        shortDescription: 'Headline the official ETHMilan 2026 after-party (300 guests, invite-only).',
        category: 'experience', mode: 'sealed_bid',
        listPrice: 25000, minimumBid: 20000, bidAllowed: true,
        quantityTotal: 1, isExclusive: true, featured: true, sortOrder: 6,
        benefits: [
          { type: 'custom', label: 'Venue branding', value: 'Naming rights + full decor', sortOrder: 1 },
          { type: 'custom', label: 'MC introduction', value: 'CEO/founder welcome speech', sortOrder: 2 },
          { type: 'pass_count', label: 'VIP passes', quantity: 20, sortOrder: 3 },
          { type: 'social_mentions', label: 'Social', value: '5 posts + event recap', sortOrder: 4 },
        ],
      },
    ],
  });

  // ── ETHBerlin 2026 ────────────────────────────────────────────────────────
  await seedEvent({
    slug: 'ethberlin-2026',
    name: 'ETHBerlin 2026',
    tagline: 'Where Cypherpunks Ship',
    description: 'ETHBerlin returns to the OHM venue for its sixth edition. Focused on privacy, decentralisation, and open-source values — ETHBerlin is the most hacker-centric Ethereum conference in Europe. Expect 900 developers, no suits, and 48 hours of building.',
    startDate: new Date('2026-05-08'),
    endDate: new Date('2026-05-10'),
    location: 'OHM, Am Postbahnhof 1',
    city: 'Berlin',
    country: 'Germany',
    timezone: 'Europe/Berlin',
    websiteUrl: 'https://ethberlin.org',
    primaryColor: '#10b981',
    accentColor: '#6366f1',
    heroImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200',
    attendees: 900,
    onlineReach: 20000,
    items: [
      {
        slug: 'lead-hacker-sponsor',
        publicTitle: 'Lead Hacker Sponsor',
        shortDescription: 'Top billing at the most hacker-focused Ethereum conference in Europe.',
        category: 'title_sponsorship', mode: 'sealed_bid',
        listPrice: 60000, minimumBid: 45000, bidAllowed: true,
        quantityTotal: 1, isExclusive: true, featured: true, packageTier: 'title', sortOrder: 0,
        benefits: [
          { type: 'custom', label: '"Powered by" branding', value: 'All venues and digital channels', sortOrder: 1 },
          { type: 'stage_access', label: 'Stage Access', value: 'Keynote (30 min)', sortOrder: 2 },
          { type: 'custom', label: 'Hackathon bounty banner', value: 'Featured across hacker hall', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 12, sortOrder: 4 },
        ],
      },
      {
        slug: 'bounty-sponsor-large',
        publicTitle: 'Bounty Sponsor — Large',
        shortDescription: 'Post $20K+ in bounties and have your challenges featured prominently at the hackathon.',
        category: 'hackathon', mode: 'request_only',
        onRequest: true, quantityTotal: 5, sortOrder: 1,
        benefits: [
          { type: 'custom', label: 'Bounty listing', value: 'Featured front-and-centre', sortOrder: 1 },
          { type: 'stage_access', label: 'Stage time', value: 'Bounty intro pitch (5 min)', sortOrder: 2 },
          { type: 'custom', label: 'Judging panel seat', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 4, sortOrder: 4 },
        ],
      },
      {
        slug: 'bounty-sponsor-small',
        publicTitle: 'Bounty Sponsor — Standard',
        shortDescription: 'Post $5K–20K in bounties and reach ETHBerlin\'s builder-first audience.',
        category: 'hackathon', mode: 'fixed_price',
        listPrice: 8000, quantityTotal: 10, sortOrder: 2,
        benefits: [
          { type: 'custom', label: 'Bounty listing', sortOrder: 1 },
          { type: 'custom', label: 'Bounty table in hacker hall', sortOrder: 2 },
          { type: 'pass_count', label: 'Passes', quantity: 2, sortOrder: 3 },
        ],
      },
      {
        slug: 'infrastructure-sponsor',
        publicTitle: 'Infrastructure Sponsor',
        shortDescription: 'Power the build — provide cloud credits, RPC endpoints, or dev tooling to 900 hackers.',
        category: 'in_kind', mode: 'request_only',
        onRequest: true, sortOrder: 3,
        benefits: [
          { type: 'logo_placement', label: 'Logo', value: 'On hacker welcome kit and portal', sortOrder: 1 },
          { type: 'custom', label: 'Integration talk', value: 'Workshop slot (45 min)', sortOrder: 2 },
          { type: 'pass_count', label: 'Passes', quantity: 4, sortOrder: 3 },
        ],
      },
      {
        slug: 'community-sponsor',
        publicTitle: 'Community Sponsor',
        shortDescription: 'Logo placement, a table at the networking area, and hacker passes.',
        category: 'sponsor_pack', mode: 'fixed_price',
        listPrice: 12000, quantityTotal: 8, packageTier: 'community', sortOrder: 4,
        benefits: [
          { type: 'logo_placement', label: 'Logo', value: 'Event materials + website', sortOrder: 1 },
          { type: 'custom', label: 'Networking table', value: 'Hacker floor area', sortOrder: 2 },
          { type: 'pass_count', label: 'Passes', quantity: 3, sortOrder: 3 },
        ],
      },
      {
        slug: 'food-sponsor',
        publicTitle: 'Hacker Fuel Sponsor',
        shortDescription: 'Keep 900 hackers energised — sponsor all meals and snacks across three days.',
        category: 'food_beverage', mode: 'hybrid',
        listPrice: 18000, minimumBid: 14000, bidAllowed: true,
        quantityTotal: 1, isExclusive: true, sortOrder: 5,
        benefits: [
          { type: 'custom', label: 'Branded serving area', sortOrder: 1 },
          { type: 'custom', label: 'MC acknowledgment', value: 'Every meal announcement', sortOrder: 2 },
          { type: 'pass_count', label: 'Passes', quantity: 3, sortOrder: 3 },
        ],
      },
    ],
  });

  // ── DevConnect Amsterdam 2026 ─────────────────────────────────────────────
  await seedEvent({
    slug: 'devconnect-amsterdam-2026',
    name: 'DevConnect Amsterdam 2026',
    tagline: 'A Week of Ethereum Deep Dives',
    description: 'DevConnect is a week-long gathering of Ethereum developers, researchers, and builders split across independent co-located events. Amsterdam hosts the 2026 edition — 2,000+ attendees, 20+ events across the city, and unprecedented access to the people shaping the protocol.',
    startDate: new Date('2026-11-09'),
    endDate: new Date('2026-11-15'),
    location: 'Multiple venues across Amsterdam',
    city: 'Amsterdam',
    country: 'Netherlands',
    timezone: 'Europe/Amsterdam',
    websiteUrl: 'https://devconnect.org',
    primaryColor: '#8b5cf6',
    accentColor: '#f97316',
    heroImageUrl: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?w=1200',
    attendees: 2000,
    onlineReach: 50000,
    items: [
      {
        slug: 'week-lead-sponsor',
        publicTitle: 'Week Lead Sponsor',
        shortDescription: 'Headline sponsor of the entire DevConnect Amsterdam week — maximum reach across all events.',
        category: 'title_sponsorship', mode: 'sealed_bid',
        listPrice: 100000, minimumBid: 80000, bidAllowed: true,
        quantityTotal: 1, isExclusive: true, featured: true, packageTier: 'title', sortOrder: 0,
        benefits: [
          { type: 'logo_placement', label: 'Logo', value: '"Presented by" — all week materials', sortOrder: 1 },
          { type: 'stage_access', label: 'Stage Access', value: 'Opening plenary keynote (30 min)', sortOrder: 2 },
          { type: 'custom', label: 'Branded lounge', value: 'Dedicated sponsor lounge for the week', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 20, sortOrder: 4 },
          { type: 'social_mentions', label: 'Social', value: '20+ posts across all channels', sortOrder: 5 },
        ],
      },
      {
        slug: 'track-sponsor',
        publicTitle: 'Track Sponsor',
        shortDescription: 'Sponsor one of the five thematic co-located events and own that topic.',
        category: 'sponsor_pack', mode: 'fixed_price',
        listPrice: 40000, quantityTotal: 5, featured: true, packageTier: 'premium', sortOrder: 1,
        benefits: [
          { type: 'custom', label: 'Track naming rights', value: '"[Brand] Day"', sortOrder: 1 },
          { type: 'stage_access', label: 'Stage Access', value: 'Track keynote (30 min)', sortOrder: 2 },
          { type: 'logo_placement', label: 'Logo', value: 'Top of track materials', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 8, sortOrder: 4 },
        ],
      },
      {
        slug: 'networking-sponsor',
        publicTitle: 'Networking Event Sponsor',
        shortDescription: 'Host one of the official DevConnect networking nights for 400+ attendees.',
        category: 'experience', mode: 'hybrid',
        listPrice: 30000, minimumBid: 25000, bidAllowed: true,
        quantityTotal: 3, isExclusive: false, featured: false, sortOrder: 2,
        benefits: [
          { type: 'custom', label: 'Venue branding', value: 'Full naming rights', sortOrder: 1 },
          { type: 'stage_access', label: 'Stage Access', value: 'Welcome remarks (10 min)', sortOrder: 2 },
          { type: 'pass_count', label: 'Passes', quantity: 10, sortOrder: 3 },
        ],
      },
      {
        slug: 'research-sponsor',
        publicTitle: 'Research Day Sponsor',
        shortDescription: 'Co-present the Ethereum research programme with EF researchers and academics.',
        category: 'sponsor_pack', mode: 'fixed_price',
        listPrice: 25000, quantityTotal: 2, sortOrder: 3,
        benefits: [
          { type: 'stage_access', label: 'Stage Access', value: 'Research panel slot (20 min)', sortOrder: 1 },
          { type: 'logo_placement', label: 'Logo', value: 'Research Day programme', sortOrder: 2 },
          { type: 'pass_count', label: 'Passes', quantity: 5, sortOrder: 3 },
        ],
      },
      {
        slug: 'community-sponsor',
        publicTitle: 'Community Sponsor',
        shortDescription: 'Visibility across the DevConnect week for smaller teams and protocols.',
        category: 'sponsor_pack', mode: 'fixed_price',
        listPrice: 15000, quantityTotal: 20, packageTier: 'community', sortOrder: 4,
        benefits: [
          { type: 'logo_placement', label: 'Logo', value: 'Week programme and website', sortOrder: 1 },
          { type: 'pass_count', label: 'Passes', quantity: 3, sortOrder: 2 },
        ],
      },
      {
        slug: 'childcare-sponsor',
        publicTitle: 'Childcare & Inclusion Sponsor',
        shortDescription: 'Fund on-site childcare so parents can attend — a stand-out values statement.',
        category: 'inclusion', mode: 'fixed_price',
        listPrice: 10000, quantityTotal: 2, sortOrder: 10,
        benefits: [
          { type: 'custom', label: 'Dedicated acknowledgment', value: 'Stage shoutout + website feature', sortOrder: 1 },
          { type: 'pass_count', label: 'Passes', quantity: 2, sortOrder: 2 },
        ],
      },
    ],
  });

  // ── ETHLisbon 2026 ────────────────────────────────────────────────────────
  await seedEvent({
    slug: 'ethlisbon-2026',
    name: 'ETHLisbon 2026',
    tagline: 'The Atlantic Gateway to Ethereum',
    description: 'ETHLisbon 2026 brings 600 builders, investors, and creators to Lisbon\'s LX Factory for two days of talks, workshops, and side events. Known for its warm culture and thriving startup scene, Lisbon is one of Web3\'s favourite European hubs.',
    startDate: new Date('2026-10-15'),
    endDate: new Date('2026-10-16'),
    location: 'LX Factory, Rua Rodrigues de Faria 103',
    city: 'Lisbon',
    country: 'Portugal',
    timezone: 'Europe/Lisbon',
    websiteUrl: 'https://ethlisbon.org',
    primaryColor: '#ef4444',
    accentColor: '#f59e0b',
    heroImageUrl: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200',
    attendees: 600,
    onlineReach: 12000,
    items: [
      {
        slug: 'headline-sponsor',
        publicTitle: 'Headline Sponsor',
        shortDescription: 'Exclusive co-branding across ETHLisbon — 600 attendees, one partner.',
        category: 'title_sponsorship', mode: 'sealed_bid',
        listPrice: 40000, minimumBid: 30000, bidAllowed: true,
        quantityTotal: 1, isExclusive: true, featured: true, packageTier: 'title', sortOrder: 0,
        benefits: [
          { type: 'stage_access', label: 'Keynote', value: '30 minutes on main stage', sortOrder: 1 },
          { type: 'booth_size', label: 'Booth', value: '5×5m feature booth', sortOrder: 2 },
          { type: 'logo_placement', label: 'Logo', value: '"Presented by" all channels', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 8, sortOrder: 4 },
        ],
      },
      {
        slug: 'gold-sponsor',
        publicTitle: 'Gold Sponsor',
        shortDescription: 'Stage access, 4×3m booth, and strong digital presence.',
        category: 'sponsor_pack', mode: 'fixed_price',
        listPrice: 20000, quantityTotal: 3, featured: true, packageTier: 'gold', sortOrder: 1,
        benefits: [
          { type: 'stage_access', label: 'Stage', value: 'Panel slot (20 min)', sortOrder: 1 },
          { type: 'booth_size', label: 'Booth', value: '4×3m', sortOrder: 2 },
          { type: 'logo_placement', label: 'Logo', value: 'First tier', sortOrder: 3 },
          { type: 'pass_count', label: 'Passes', quantity: 5, sortOrder: 4 },
        ],
      },
      {
        slug: 'silver-sponsor',
        publicTitle: 'Silver Sponsor',
        shortDescription: 'A 3×2m booth, a lightning talk, and growing presence in the Iberian Web3 scene.',
        category: 'sponsor_pack', mode: 'hybrid',
        listPrice: 12000, minimumBid: 9000, bidAllowed: true,
        quantityTotal: 5, packageTier: 'silver', sortOrder: 2,
        benefits: [
          { type: 'stage_access', label: 'Stage', value: 'Lightning talk (8 min)', sortOrder: 1 },
          { type: 'booth_size', label: 'Booth', value: '3×2m', sortOrder: 2 },
          { type: 'pass_count', label: 'Passes', quantity: 3, sortOrder: 3 },
        ],
      },
      {
        slug: 'community-sponsor',
        publicTitle: 'Community Sponsor',
        shortDescription: 'Entry-level visibility for DAOs, ecosystems, and early-stage projects.',
        category: 'sponsor_pack', mode: 'fixed_price',
        listPrice: 6000, quantityTotal: 10, packageTier: 'community', sortOrder: 3,
        benefits: [
          { type: 'logo_placement', label: 'Logo', value: 'Website and programme', sortOrder: 1 },
          { type: 'pass_count', label: 'Passes', quantity: 2, sortOrder: 2 },
        ],
      },
      {
        slug: 'workshop-sponsor',
        publicTitle: 'Workshop Room Sponsor',
        shortDescription: 'Name and run a 90-minute hands-on workshop for 60 developers.',
        category: 'stage', mode: 'fixed_price',
        listPrice: 8000, quantityTotal: 4, sortOrder: 4,
        benefits: [
          { type: 'custom', label: 'Workshop room naming', value: '"[Brand] Workshop"', sortOrder: 1 },
          { type: 'stage_access', label: 'Workshop slot', value: '90 min, 60-seat room', sortOrder: 2 },
          { type: 'pass_count', label: 'Passes', quantity: 2, sortOrder: 3 },
        ],
      },
      {
        slug: 'azulejos-dinner',
        publicTitle: 'Speakers\' Dinner Sponsor',
        shortDescription: 'Host 60 speakers and VIPs at a private dinner in a traditional Lisbon restaurant.',
        category: 'experience', mode: 'fixed_price',
        listPrice: 15000, quantityTotal: 1, isExclusive: true, sortOrder: 5,
        benefits: [
          { type: 'custom', label: 'Venue branding', value: 'Dinner naming rights', sortOrder: 1 },
          { type: 'custom', label: 'Guest list control', value: '5 seats of your choice', sortOrder: 2 },
          { type: 'pass_count', label: 'Passes', quantity: 5, sortOrder: 3 },
        ],
      },
    ],
  });

  // --- Platform superadmin ---
  await prisma.user.upsert({
    where: { email: 'platform@moongate.xyz' },
    update: {},
    create: {
      email: 'platform@moongate.xyz',
      name: 'Platform Admin',
      emailVerified: true,
      platformRole: 'platform_superadmin',
      passwordHash: hashPassword('moongate-admin-2026'),
    },
  });
  console.log('✓ Platform superadmin: platform@moongate.xyz');

  // --- Early access waitlist members ---
  const earlyAccessMembers = [
    {
      email: 'sarah.chen@polygon.technology',
      name: 'Sarah Chen',
      company: 'Polygon Labs',
      role: 'organizer',
      referrer: 'twitter',
      utmSource: 'twitter',
      utmMedium: 'social',
      utmCampaign: 'launch',
      status: 'waitlisted',
      internalStatus: 'new',
      createdAt: new Date('2026-03-01T09:12:00Z'),
    },
    {
      email: 'marcus.rio@binance.com',
      name: 'Marcus Rio',
      company: 'Binance',
      role: 'sponsor',
      referrer: 'linkedin',
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: 'launch',
      status: 'waitlisted',
      internalStatus: 'reviewed',
      adminNotes: 'Strong fit — Binance sponsors 10+ events per year. Follow up with deck.',
      createdAt: new Date('2026-03-02T14:30:00Z'),
    },
    {
      email: 'priya.nair@ethglobal.com',
      name: 'Priya Nair',
      company: 'ETHGlobal',
      role: 'organizer',
      utmSource: 'direct',
      status: 'invited',
      internalStatus: 'contacted',
      adminNotes: 'Invited to closed beta. Runs ETHIndia and ETHTokyo.',
      inviteCode: 'BETA-PRIYA-001',
      invitedAt: new Date('2026-03-10T10:00:00Z'),
      createdAt: new Date('2026-03-03T08:00:00Z'),
    },
    {
      email: 'tom.walker@a16z.com',
      name: 'Tom Walker',
      company: 'a16z crypto',
      role: 'sponsor',
      referrer: 'referral',
      utmSource: 'referral',
      utmMedium: 'partner',
      status: 'onboarded',
      internalStatus: 'contacted',
      inviteCode: 'BETA-TOM-002',
      invitedAt: new Date('2026-03-08T09:00:00Z'),
      onboardedAt: new Date('2026-03-12T16:45:00Z'),
      createdAt: new Date('2026-03-04T11:20:00Z'),
    },
    {
      email: 'lena.hoffman@devcon.org',
      name: 'Lena Hoffmann',
      company: 'Ethereum Foundation / Devcon',
      role: 'organizer',
      utmSource: 'direct',
      status: 'waitlisted',
      internalStatus: 'new',
      createdAt: new Date('2026-03-05T15:00:00Z'),
    },
    {
      email: 'james.ko@coinbase.com',
      name: 'James Ko',
      company: 'Coinbase Ventures',
      role: 'sponsor',
      referrer: 'twitter',
      utmSource: 'twitter',
      utmMedium: 'social',
      utmCampaign: 'launch',
      status: 'waitlisted',
      internalStatus: 'reviewed',
      adminNotes: 'Replied to our DM. Interested in logo placement at 3 events minimum.',
      createdAt: new Date('2026-03-06T10:05:00Z'),
    },
    {
      email: 'ana.silva@solana.org',
      name: 'Ana Silva',
      company: 'Solana Foundation',
      role: 'sponsor',
      utmSource: 'conference',
      utmMedium: 'event',
      utmCampaign: 'ethdenver',
      status: 'waitlisted',
      internalStatus: 'archived',
      adminNotes: 'Not a fit right now — focused on Solana-native events only.',
      createdAt: new Date('2026-03-07T12:30:00Z'),
    },
    {
      email: 'dev@zkstartup.io',
      name: 'Dev Patel',
      company: 'ZKStartup',
      role: 'organizer',
      utmSource: 'producthunt',
      utmMedium: 'launch',
      status: 'waitlisted',
      internalStatus: 'new',
      createdAt: new Date('2026-03-09T07:45:00Z'),
    },
    {
      email: 'claire.dubois@ledger.com',
      name: 'Claire Dubois',
      company: 'Ledger',
      role: 'sponsor',
      referrer: 'linkedin',
      utmSource: 'linkedin',
      utmMedium: 'social',
      status: 'invited',
      internalStatus: 'contacted',
      adminNotes: 'Hardware wallet — great for in-person events. Invited to beta.',
      inviteCode: 'BETA-CLAIRE-003',
      invitedAt: new Date('2026-03-15T11:00:00Z'),
      createdAt: new Date('2026-03-10T09:10:00Z'),
    },
    {
      email: 'ryan.nguyen@alchemy.com',
      name: 'Ryan Nguyen',
      company: 'Alchemy',
      role: 'sponsor',
      utmSource: 'direct',
      status: 'waitlisted',
      internalStatus: 'reviewed',
      createdAt: new Date('2026-03-11T14:00:00Z'),
    },
    {
      email: 'mia.johansson@ethsweden.io',
      name: 'Mia Johansson',
      company: 'ETH Sweden',
      role: 'organizer',
      referrer: 'twitter',
      utmSource: 'twitter',
      utmMedium: 'social',
      status: 'waitlisted',
      internalStatus: 'new',
      createdAt: new Date('2026-03-12T08:30:00Z'),
    },
    {
      email: 'oliver.grant@uniswap.org',
      name: 'Oliver Grant',
      company: 'Uniswap Labs',
      role: 'sponsor',
      utmSource: 'referral',
      utmMedium: 'partner',
      status: 'onboarded',
      internalStatus: 'contacted',
      inviteCode: 'BETA-OLIVER-004',
      invitedAt: new Date('2026-03-13T10:00:00Z'),
      onboardedAt: new Date('2026-03-16T14:20:00Z'),
      createdAt: new Date('2026-03-13T09:00:00Z'),
    },
  ];

  for (const member of earlyAccessMembers) {
    await prisma.earlyAccessMember.upsert({
      where: { email: member.email },
      update: {},
      create: member as Parameters<typeof prisma.earlyAccessMember.create>[0]['data'],
    });
  }
  console.log(`✓ Early access members: ${earlyAccessMembers.length} records`);;

  // --- KYC config + submissions ---
  const kycConfig = await prisma.kycConfig.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      fields: [
        { key: 'company_name', label: 'Legal Company Name', type: 'text', required: true, placeholder: 'Acme Corp Ltd.' },
        { key: 'company_reg', label: 'Company Registration Number', type: 'text', required: true, placeholder: 'e.g. 12345678' },
        { key: 'company_type', label: 'Company Type', type: 'select', required: true, options: ['LLC', 'C-Corp', 'Foundation', 'DAO', 'Other'] },
        { key: 'country', label: 'Country of Incorporation', type: 'text', required: true, placeholder: 'United States' },
        { key: 'website', label: 'Company Website', type: 'url', required: true, placeholder: 'https://acme.xyz' },
        { key: 'contact_name', label: 'Primary Contact Name', type: 'text', required: true },
        { key: 'contact_title', label: 'Contact Title / Role', type: 'text', required: false },
        { key: 'tax_id', label: 'Tax ID / VAT Number', type: 'text', required: false, placeholder: 'EU123456789' },
        { key: 'billing_address', label: 'Billing Address', type: 'textarea', required: true },
        { key: 'invoice_email', label: 'Invoice Email', type: 'email', required: true },
      ],
    },
  });

  const kycSubmissions = [
    {
      id: 'kyc-sub-1',
      tenantId: tenant.id,
      kycConfigId: kycConfig.id,
      bidId: 'demo-bid-1',
      status: 'submitted',
      data: {
        company_name: 'Acme Protocol GmbH',
        company_reg: 'HRB 123456',
        company_type: 'LLC',
        country: 'Germany',
        website: 'https://acme.xyz',
        contact_name: 'Alice Chen',
        contact_title: 'Head of Partnerships',
        billing_address: 'Friedrichstraße 55, 10117 Berlin, Germany',
        invoice_email: 'finance@acme.xyz',
      },
    },
    {
      id: 'kyc-sub-2',
      tenantId: tenant.id,
      kycConfigId: kycConfig.id,
      status: 'approved',
      reviewNotes: 'All documents verified. Entity confirmed via Companies House.',
      reviewedAt: new Date('2026-03-10T14:30:00Z'),
      data: {
        company_name: 'Paradigm Operations LLC',
        company_reg: '7891234',
        company_type: 'LLC',
        country: 'United States',
        website: 'https://paradigm.xyz',
        contact_name: 'Matt Huang',
        contact_title: 'Partner',
        billing_address: '548 Market St #39536, San Francisco CA 94104',
        invoice_email: 'billing@paradigm.xyz',
      },
    },
    {
      id: 'kyc-sub-3',
      tenantId: tenant.id,
      kycConfigId: kycConfig.id,
      status: 'needs_more_info',
      reviewNotes: 'Please provide a valid VAT number and updated billing address for EU invoicing.',
      reviewedAt: new Date('2026-03-12T09:15:00Z'),
      data: {
        company_name: 'Uniswap Labs',
        company_reg: '5556677',
        company_type: 'LLC',
        country: 'United States',
        website: 'https://uniswap.org',
        contact_name: 'Hayden Adams',
        contact_title: 'CEO',
        billing_address: '130 West 42nd Street, New York NY 10036',
        invoice_email: 'ops@uniswap.org',
      },
    },
    {
      id: 'kyc-sub-4',
      tenantId: tenant.id,
      kycConfigId: kycConfig.id,
      status: 'not_started',
      data: null,
    },
    {
      id: 'kyc-sub-5',
      tenantId: tenant.id,
      kycConfigId: kycConfig.id,
      status: 'rejected',
      reviewNotes: 'Unable to verify entity registration. Company appears to be dissolved.',
      reviewedAt: new Date('2026-02-28T11:00:00Z'),
      data: {
        company_name: 'Defunct DAO LLC',
        company_reg: 'N/A',
        company_type: 'DAO',
        country: 'Cayman Islands',
        website: 'https://defunct.io',
        contact_name: 'Anonymous',
        billing_address: 'PO Box 1234, Grand Cayman',
        invoice_email: 'anon@defunct.io',
      },
    },
  ];

  for (const sub of kycSubmissions) {
    await prisma.kycSubmission.upsert({
      where: { id: sub.id },
      update: {},
      create: sub as Parameters<typeof prisma.kycSubmission.create>[0]['data'],
    });
  }
  console.log(`✓ KYC config + ${kycSubmissions.length} submissions`);

  // --- Outreach contacts ---
  const outreachContacts = [
    { tenantId: tenant.id, name: 'Stani Kulechov', email: 'stani@aave.com', company: 'Aave', title: 'Founder & CEO', status: 'converted', tags: ['defi', 'protocol'], notes: 'Confirmed Gold sponsor for ETHMilan 2025. Invoice sent.', convertedAt: new Date('2026-02-14T10:00:00Z'), linkedinUrl: 'https://linkedin.com/in/stanikulechov' },
    { tenantId: tenant.id, name: 'Kain Warwick', email: 'kain@synthetix.io', company: 'Synthetix', title: 'Founder', status: 'responded', tags: ['defi', 'derivatives'], notes: 'Interested in speaking slot + branding package. Follow up with deck.', linkedinUrl: 'https://linkedin.com/in/kainwarwick' },
    { tenantId: tenant.id, name: 'Illia Polosukhin', email: 'illia@near.org', company: 'NEAR Protocol', title: 'Co-Founder', status: 'contacted', tags: ['l1', 'protocol'], notes: 'First outreach sent 2026-03-01. No reply yet.', inviteSentAt: new Date('2026-03-01T08:00:00Z') },
    { tenantId: tenant.id, name: 'Emin Gün Sirer', email: 'emin@avax.network', company: 'Ava Labs', title: 'CEO', status: 'contacted', tags: ['l1', 'avalanche'], notes: 'Sent personalised deck highlighting L1 stage opportunity.', inviteSentAt: new Date('2026-03-05T09:30:00Z') },
    { tenantId: tenant.id, name: 'Robert Leshner', email: 'robert@compound.finance', company: 'Compound', title: 'Founder', status: 'new', tags: ['defi', 'lending'] },
    { tenantId: tenant.id, name: 'Sergey Nazarov', email: 'sergey@chain.link', company: 'Chainlink Labs', title: 'Co-Founder', status: 'new', tags: ['oracle', 'infrastructure'] },
    { tenantId: tenant.id, name: 'Linda Xie', email: 'linda@scalar.capital', company: 'Scalar Capital', title: 'Managing Director', status: 'responded', tags: ['vc', 'investor'], notes: 'Interested in VIP table + networking dinner access.' },
    { tenantId: tenant.id, name: 'Haseeb Qureshi', email: 'haseeb@dragonfly.xyz', company: 'Dragonfly Capital', title: 'Managing Partner', status: 'new', tags: ['vc', 'investor'] },
    { tenantId: tenant.id, name: 'Brady Dale', email: 'brady@axios.com', company: 'Axios', title: 'Crypto Reporter', status: 'contacted', tags: ['media', 'press'], notes: 'Comped press pass offer sent. Covering ETHMilan for Axios.', inviteSentAt: new Date('2026-03-08T11:00:00Z') },
    { tenantId: tenant.id, name: 'Laura Shin', email: 'laura@unchainedcrypto.com', company: 'Unchained Podcast', title: 'Host', status: 'archived', tags: ['media', 'podcast'], notes: 'Scheduling conflict — follow up for next edition.' },
    { tenantId: tenant.id, name: 'Camila Russo', email: 'camila@thedefiant.io', company: 'The Defiant', title: 'Founder', status: 'converted', tags: ['media', 'defi'], notes: 'Media partner confirmed. Co-marketing assets exchanged.', convertedAt: new Date('2026-02-20T14:00:00Z') },
    { tenantId: tenant.id, name: 'Mara Schmiedt', email: 'mara@alluvial.finance', company: 'Alluvial Finance', title: 'CEO', status: 'new', tags: ['staking', 'infrastructure'] },
  ];

  for (const contact of outreachContacts) {
    const existing = await prisma.outreachContact.findFirst({ where: { tenantId: tenant.id, email: contact.email } });
    if (!existing) {
      await prisma.outreachContact.create({ data: contact });
    }
  }
  console.log(`✓ Outreach contacts: ${outreachContacts.length} records`);

  // --- Access grants ---
  const accessEmails = [
    'vitalik@ethereum.org',
    'hayden@uniswap.org',
    'stani@aave.com',
    'kain@synthetix.io',
    'banteg@yearn.finance',
    'gauntlet@gauntlet.network',
    'paradigm@paradigm.xyz',
  ];

  for (const email of accessEmails) {
    const existing = await prisma.eventAccessGrant.findFirst({ where: { eventId: event.id, grantType: 'email', email } });
    if (!existing) {
      await prisma.eventAccessGrant.create({
        data: { eventId: event.id, grantType: 'email', email, createdBy: owner.id },
      });
    }
  }

  const tokenSeeds = [
    { token: 'ethmilan-vip-alpha-2025', expiresAt: new Date('2026-09-30'), usedAt: new Date('2026-03-10') },
    { token: 'ethmilan-press-beta-2025', expiresAt: new Date('2026-09-30'), usedAt: null },
    { token: 'ethmilan-partner-gamma-2025', expiresAt: null, usedAt: null },
    { token: 'ethmilan-speaker-delta-2025', expiresAt: new Date('2026-06-01'), usedAt: new Date('2026-02-20') },
    { token: 'ethmilan-sponsor-epsilon-2025', expiresAt: null, usedAt: null },
  ];

  for (const t of tokenSeeds) {
    const existing = await prisma.eventAccessGrant.findFirst({ where: { token: t.token } });
    if (!existing) {
      await prisma.eventAccessGrant.create({
        data: { eventId: event.id, grantType: 'token', token: t.token, expiresAt: t.expiresAt, usedAt: t.usedAt, createdBy: owner.id },
      });
    }
  }

  console.log(`✓ Access grants: ${accessEmails.length} email, ${tokenSeeds.length} tokens`);

  // ── Demo paid orders + payouts (populates merchant overview metrics) ────────

  const demoOrderSeeds = [
    { id: 'demo-order-1', company: 'Acme Protocol',    contact: 'Alice Chen',    email: 'alice@acme.xyz',   total: 25000, slug: 'premium-sponsor',    paidDaysAgo: 45 },
    { id: 'demo-order-2', company: 'Nexus Labs',       contact: 'Bob Tanaka',    email: 'bob@nexuslabs.io', total: 15000, slug: 'standard-sponsor',   paidDaysAgo: 30 },
    { id: 'demo-order-3', company: 'Stellar DeFi',     contact: 'Carol White',   email: 'carol@stellar.fi', total: 12000, slug: 'lunch-sponsor',      paidDaysAgo: 20 },
    { id: 'demo-order-4', company: 'ZeroKnowledge AG', contact: 'David Müller',  email: 'd@zk.ag',          total: 8000,  slug: 'badge-sponsor',      paidDaysAgo: 15 },
    { id: 'demo-order-5', company: 'Orbit Protocol',   contact: 'Emma Santos',   email: 'emma@orbit.io',    total: 7500,  slug: 'side-stage-branding', paidDaysAgo: 10 },
    { id: 'demo-order-6', company: 'Hydra Finance',    contact: 'Felix Okonkwo', email: 'f@hydra.fi',       total: 5000,  slug: 'coffee-sponsor',     paidDaysAgo: 5  },
  ];

  for (const od of demoOrderSeeds) {
    const item = await prisma.sponsorItem.findFirst({ where: { eventId: event.id, slug: od.slug } });
    if (!item) continue;

    const paidAt = new Date(Date.now() - od.paidDaysAgo * 86400 * 1000);
    const platformFeeRate = 0.08;
    const platformFeeAmount = Math.round(od.total * platformFeeRate * 100) / 100;
    const merchantNetAmount = Math.round((od.total - platformFeeAmount) * 100) / 100;

    const company = await prisma.sponsorCompany.upsert({
      where: { id: `seed-co-${od.id}` },
      update: {},
      create: { id: `seed-co-${od.id}`, tenantId: tenant.id, name: od.company, industry: 'Web3' },
    });

    const existingOrder = await prisma.order.findFirst({ where: { id: od.id } });
    if (!existingOrder) {
      const invoiceNum = `INV-DEMO-${od.id.toUpperCase()}`;
      await prisma.order.create({
        data: {
          id: od.id,
          tenantId: tenant.id,
          eventId: event.id,
          sponsorCompanyId: company.id,
          status: 'paid',
          currency: 'USD',
          subtotal: od.total,
          taxAmount: 0,
          discountAmount: 0,
          total: od.total,
          platformFeeRate,
          platformFeeAmount,
          merchantNetAmount,
          commissionSource: 'default',
          processingFeeProfile: 'stripe',
          processingFeeRate: 0.045,
          processingFeeAmount: Math.round(od.total * 0.045 * 100) / 100,
          invoiceNumber: invoiceNum,
          invoiceRequestedAt: paidAt,
          paidAt,
          lines: {
            create: [{
              itemId: item.id,
              quantity: 1,
              unitPrice: od.total,
              total: od.total,
              label: item.publicTitle,
            }],
          },
          payments: {
            create: [{
              provider: 'stripe',
              externalId: `pi_demo_${od.id}`,
              amount: od.total,
              currency: 'USD',
              status: 'succeeded',
            }],
          },
          invoice: {
            create: {
              tenantId: tenant.id,
              invoiceNumber: invoiceNum,
              billedToEmail: od.email,
              billedToName: od.contact,
              billedToCompany: od.company,
              subtotal: od.total,
              platformFee: platformFeeAmount,
              total: od.total,
              currency: 'USD',
              lines: [{ label: item.publicTitle, quantity: 1, unitPrice: od.total, total: od.total }],
              issuedAt: paidAt,
            },
          },
        },
      });
    }
  }

  console.log(`✓ Demo paid orders: ${demoOrderSeeds.length} orders ($72,500 total revenue)`);

  // Demo payout — covers the first 3 orders
  const existingPayout = await prisma.payout.findFirst({ where: { tenantId: tenant.id } });
  if (!existingPayout) {
    const payoutOrders = await prisma.order.findMany({
      where: { id: { in: ['demo-order-1', 'demo-order-2', 'demo-order-3'] }, payoutItem: null },
      select: { id: true, merchantNetAmount: true },
    });
    if (payoutOrders.length > 0) {
      const gross = Math.round(payoutOrders.reduce((s, o) => s + Number(o.merchantNetAmount ?? 0), 0) * 100) / 100;
      const payout = await prisma.payout.create({
        data: {
          tenantId: tenant.id,
          status: 'paid',
          currency: 'USD',
          grossAmount: gross,
          feeAmount: 0,
          netAmount: gross,
          periodStart: new Date(Date.now() - 50 * 86400 * 1000),
          periodEnd: new Date(Date.now() - 20 * 86400 * 1000),
          paidAt: new Date(Date.now() - 15 * 86400 * 1000),
          reference: 'WIRE-DEMO-001',
          notes: 'Demo payout — ETHMilan first batch',
          items: {
            create: payoutOrders.map(o => ({
              orderId: o.id,
              amount: Number(o.merchantNetAmount ?? 0),
            })),
          },
        },
      });
      console.log(`✓ Demo payout created (${payout.id}, net: $${gross})`);
    }
  }

  console.log('\n🎉 Seed complete!');
  console.log('\nDemo credentials:');
  console.log('  Organizer: admin@ethglobal.com (no password set — use magic link)');
  console.log('  Sales: sales@ethglobal.com');
  console.log('  Platform admin: platform@moongate.xyz / moongate-admin-2026');
  console.log('  Tenant slug: ethglobal');
  console.log('  Event slug: ethmilan-2025');
}

main()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
