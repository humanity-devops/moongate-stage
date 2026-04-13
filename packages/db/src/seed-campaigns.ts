import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo crowdfund campaigns...');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'ethglobal' } });
  if (!tenant) throw new Error('Tenant not found — run the main seed first');

  const event = await prisma.event.findFirst({
    where: { tenantId: tenant.id, slug: 'ethmilan-2025' },
  });
  if (!event) throw new Error('Event not found');

  // ── Community Sponsor ($10,000) ── two competing campaigns
  const communityItem = await prisma.sponsorItem.findFirst({
    where: { eventId: event.id, slug: 'community-sponsor' },
  });

  // ── Coffee Station ($5,000) ── a won campaign
  const coffeeItem = await prisma.sponsorItem.findFirst({
    where: { eventId: event.id, slug: 'coffee-sponsor' },
  });

  // ── Silver Sponsor ($20,000) ── one early-stage campaign
  const silverItem = await prisma.sponsorItem.findFirst({
    where: { eventId: event.id, slug: 'silver-sponsor' },
  });

  if (!communityItem || !coffeeItem || !silverItem) {
    throw new Error('Sponsor items not found — run the main seed first');
  }

  // ── Helper ────────────────────────────────────────────────────────────────
  async function upsertCampaign(id: string, data: Parameters<typeof prisma.crowdfundCampaign.create>[0]['data']) {
    await prisma.crowdfundCampaign.deleteMany({ where: { id } });
    return prisma.crowdfundCampaign.create({ data: { id, ...data } });
  }

  async function addContributions(
    campaignId: string,
    contribs: { name: string; email: string; amount: number; message?: string; daysAgo: number }[],
    currency: string,
  ) {
    for (const c of contribs) {
      await prisma.crowdfundContribution.create({
        data: {
          campaignId,
          contributorName: c.name,
          contributorEmail: c.email,
          amount: c.amount,
          currency,
          message: c.message,
          status: 'confirmed',
          createdAt: new Date(Date.now() - c.daysAgo * 86400_000),
        },
      });
    }
  }

  // ── 1. Community Sponsor — Campaign A: "Ethereum Barcelona" (well-funded, active) ──
  const deadline14 = new Date(Date.now() + 14 * 86400_000);
  const campaignA = await upsertCampaign('demo-campaign-community-a', {
    tenantId: tenant.id,
    eventId: event.id,
    itemId: communityItem.id,
    entityName: 'Ethereum Barcelona',
    entityDescription:
      'The largest Spanish-speaking Ethereum community with 2,000+ members across Barcelona, Madrid, and Valencia. We run monthly meetups and a yearly hackathon. Sponsoring ETHMilan would let us bring 20 developers to the event and grow our cross-border presence in Southern Europe.',
    entityWebsite: 'https://ethereumbarcelona.com',
    contactName: 'Marta Vilanova',
    contactEmail: 'marta@ethereumbarcelona.com',
    goalAmount: 10000,
    raisedAmount: 6750,
    currency: 'USD',
    deadline: deadline14,
    status: 'active',
    approvalStatus: 'approved',
    approvedAt: new Date(),
  });

  await addContributions('demo-campaign-community-a', [
    { name: 'Pablo Ruiz', email: 'pablo@defi.es', amount: 1000, message: 'Proud to back the Barcelona community!', daysAgo: 6 },
    { name: 'Sofía Méndez', email: 'sofia@web3.cat', amount: 500, message: 'ETH BCN represents 🇪🇸', daysAgo: 5 },
    { name: 'Anonymous', email: 'anon1@pm.me', amount: 2000, daysAgo: 4 },
    { name: 'Carlos Ibáñez', email: 'carlos@protocol.xyz', amount: 750, message: 'Keep building!', daysAgo: 3 },
    { name: 'Laura Torres', email: 'laura@dao.eth', amount: 500, daysAgo: 2 },
    { name: 'Enric Puig', email: 'enric@blockcat.io', amount: 1000, message: 'Representing Catalonia at ETHMilan 🔥', daysAgo: 1 },
    { name: 'Noa Ferrer', email: 'noa@zk.dev', amount: 500, daysAgo: 0 },
    { name: 'Miquel Sala', email: 'miquel@l2.xyz', amount: 500, daysAgo: 0 },
  ], 'USD');

  console.log('✓ Campaign A (Ethereum Barcelona):', campaignA.id);

  // ── 2. Community Sponsor — Campaign B: "DeFi Rome" (newer, less funded, active) ──
  const deadline10 = new Date(Date.now() + 10 * 86400_000);
  const campaignB = await upsertCampaign('demo-campaign-community-b', {
    tenantId: tenant.id,
    eventId: event.id,
    itemId: communityItem.id,
    entityName: 'DeFi Rome',
    entityDescription:
      'Italy\'s fastest-growing DeFi community — 900 members in Rome, Florence, and Naples. We are close to home for ETHMilan and want to represent the Italian Ethereum scene on the big stage.',
    entityWebsite: 'https://defiro.me',
    contactName: 'Marco Fontana',
    contactEmail: 'marco@defiro.me',
    goalAmount: 10000,
    raisedAmount: 2200,
    currency: 'USD',
    deadline: deadline10,
    status: 'active',
    approvalStatus: 'approved',
    approvedAt: new Date(),
  });

  await addContributions('demo-campaign-community-b', [
    { name: 'Giulia Bianchi', email: 'giulia@rome.eth', amount: 500, message: 'Forza DeFi Rome!', daysAgo: 3 },
    { name: 'Luca Romano', email: 'luca@staking.it', amount: 500, daysAgo: 2 },
    { name: 'Alessandro Conti', email: 'ale@layer2.io', amount: 700, message: 'Italian devs represent 🇮🇹', daysAgo: 1 },
    { name: 'Francesca Riva', email: 'fran@nft.it', amount: 500, daysAgo: 0 },
  ], 'USD');

  console.log('✓ Campaign B (DeFi Rome):', campaignB.id);

  // ── 3. Coffee Station — Campaign WON: "zkSync Community Hub" ──
  const wonDeadline = new Date(Date.now() - 2 * 86400_000); // already past
  const campaignWon = await upsertCampaign('demo-campaign-coffee-won', {
    tenantId: tenant.id,
    eventId: event.id,
    itemId: coffeeItem.id,
    entityName: 'zkSync Community Hub',
    entityDescription:
      'The official zkSync community channel with 5,000+ developers. We funded the coffee station at ETHPrague and want to bring that same energy to Milan.',
    entityWebsite: 'https://zksync.community',
    contactName: 'Anna Kowalski',
    contactEmail: 'anna@zksync.community',
    goalAmount: 5000,
    raisedAmount: 5250,
    currency: 'USD',
    deadline: wonDeadline,
    status: 'won',
    wonAt: new Date(Date.now() - 3 * 86400_000),
    approvalStatus: 'approved',
    approvedAt: new Date(),
  });

  await addContributions('demo-campaign-coffee-won', [
    { name: 'Dev Mike', email: 'mike@zk.dev', amount: 1000, message: 'zkSync coffee ☕ let\'s go', daysAgo: 8 },
    { name: 'Priya Sharma', email: 'priya@rollup.xyz', amount: 500, daysAgo: 7 },
    { name: 'Tom Walsh', email: 'tom@evm.dev', amount: 750, message: 'Happy to fund good coffee', daysAgo: 6 },
    { name: 'Emma Liu', email: 'emma@zk.io', amount: 1000, daysAgo: 5 },
    { name: 'Felix König', email: 'felix@berlin.eth', amount: 500, message: 'Prost! ☕', daysAgo: 4 },
    { name: 'Yuki Tanaka', email: 'yuki@jpeth.dev', amount: 1000, message: 'Final push — goal reached!', daysAgo: 3 },
    { name: 'Chloe Martin', email: 'chloe@fr.eth', amount: 500, daysAgo: 3 },
  ], 'USD');

  console.log('✓ Campaign Won (zkSync Community Hub):', campaignWon.id);

  // ── 4. Silver Sponsor ($20,000) — Campaign: "Web3 Istanbul" (early stage) ──
  const deadline20 = new Date(Date.now() + 20 * 86400_000);
  const campaignSilver = await upsertCampaign('demo-campaign-silver-a', {
    tenantId: tenant.id,
    eventId: event.id,
    itemId: silverItem.id,
    entityName: 'Web3 Istanbul',
    entityDescription:
      'Turkey\'s premier Web3 community, representing 3,000+ builders across Istanbul, Ankara, and Izmir. We want to send a delegation to ETHMilan and showcase the growing Turkish Ethereum ecosystem to Southern Europe.',
    entityWebsite: 'https://web3istanbul.com',
    contactName: 'Emre Yıldız',
    contactEmail: 'emre@web3istanbul.com',
    goalAmount: 20000,
    raisedAmount: 3500,
    currency: 'USD',
    deadline: deadline20,
    status: 'active',
    approvalStatus: 'approved',
    approvedAt: new Date(),
  });

  await addContributions('demo-campaign-silver-a', [
    { name: 'Ayşe Kaya', email: 'ayse@tr.eth', amount: 1000, message: 'Turkey is building! 🇹🇷', daysAgo: 4 },
    { name: 'Burak Demir', email: 'burak@defi.istanbul', amount: 500, daysAgo: 3 },
    { name: 'Can Çelik', email: 'can@validator.net', amount: 1500, message: 'Istanbul → Milan 🔥', daysAgo: 2 },
    { name: 'Deniz Arslan', email: 'deniz@dao.tr', amount: 500, daysAgo: 1 },
  ], 'USD');

  console.log('✓ Campaign Silver (Web3 Istanbul):', campaignSilver.id);

  // Update raisedAmount to match contributions (in case of any precision issues)
  await prisma.crowdfundCampaign.update({ where: { id: 'demo-campaign-community-a' }, data: { raisedAmount: 6750 } });
  await prisma.crowdfundCampaign.update({ where: { id: 'demo-campaign-community-b' }, data: { raisedAmount: 2200 } });
  await prisma.crowdfundCampaign.update({ where: { id: 'demo-campaign-coffee-won' }, data: { raisedAmount: 5250 } });
  await prisma.crowdfundCampaign.update({ where: { id: 'demo-campaign-silver-a' }, data: { raisedAmount: 3500 } });

  console.log('\n✅ Demo campaigns seeded!');
  console.log('\nView them at:');
  console.log('  Community Sponsor: http://localhost:3000/ethglobal/ethmilan-2025/items/community-sponsor');
  console.log('  Coffee Station:    http://localhost:3000/ethglobal/ethmilan-2025/items/coffee-sponsor');
  console.log('  Silver Sponsor:    http://localhost:3000/ethglobal/ethmilan-2025/items/silver-sponsor');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
