import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireAuth } from '../../plugins/auth.js';

export async function organizerDashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  fastify.get('/', async (request, reply) => {
    const user = request.user!;
    const tenantId = user.tenantId!;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      activeEvents, draftEvents,
      pendingProposals, pendingApprovals, kycPending,
      weeklyAnalytics, weeklySignups,
      invitesSent, invitesAccepted,
      recentBids, recentActivity,
      paidAgg, pendingAgg,
    ] = await Promise.all([
      prisma.event.count({ where: { tenantId, status: 'published' } }),
      prisma.event.count({ where: { tenantId, status: 'draft' } }),
      prisma.proposal.count({ where: { tenantId, status: { in: ['submitted', 'under_review'] } } }),
      prisma.crowdfundCampaign.count({ where: { tenantId, approvalStatus: 'pending' } }),
      prisma.kycSubmission.count({ where: { tenantId, status: { in: ['submitted', 'needs_more_info'] } } }),
      prisma.analyticsEvent.count({ where: { tenantId, createdAt: { gte: weekAgo } } }),
      prisma.membership.count({ where: { tenantId, createdAt: { gte: weekAgo } } }),
      prisma.outreachContact.count({ where: { tenantId, inviteSentAt: { not: null } } }),
      prisma.outreachContact.count({ where: { tenantId, status: 'converted' } }),
      prisma.bid.findMany({
        where: { tenantId, status: 'submitted', createdAt: { gte: weekAgo } },
        take: 5, orderBy: { createdAt: 'desc' },
        select: { id: true, companyName: true, proposedBudget: true, currency: true, createdAt: true },
      }),
      prisma.activityFeedEntry.findMany({
        where: { tenantId, createdAt: { gte: weekAgo } },
        take: 8, orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, title: true, createdAt: true, eventId: true },
      }),
      prisma.order.aggregate({
        where: { tenantId, status: 'paid' },
        _sum: { total: true, merchantNetAmount: true },
      }),
      prisma.order.aggregate({
        where: { tenantId, status: { in: ['pending', 'payment_pending'] } },
        _sum: { total: true },
      }),
    ]);

    const analyticsLast7 = await prisma.analyticsEvent.findMany({
      where: { tenantId, createdAt: { gte: weekAgo } },
      select: { createdAt: true },
    });
    const dailyTrend: Record<string, number> = {};
    for (const ev of analyticsLast7) {
      const day = ev.createdAt.toISOString().slice(0, 10);
      dailyTrend[day] = (dailyTrend[day] ?? 0) + 1;
    }

    // Compute true last-activity timestamp from DB
    const [[latestOrder], [latestBid], [latestKyc]] = await Promise.all([
      prisma.order.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { updatedAt: true },
      }),
      prisma.bid.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { updatedAt: true },
      }),
      prisma.kycSubmission.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { updatedAt: true },
      }),
    ]);

    const candidates = [latestOrder?.updatedAt, latestBid?.updatedAt, latestKyc?.updatedAt]
      .filter(Boolean) as Date[];
    const lastUpdated = candidates.length > 0
      ? new Date(Math.max(...candidates.map(d => d.getTime()))).toISOString()
      : new Date().toISOString();

    return reply.send({
      data: {
        kpis: { activeEvents, draftEvents, pendingProposals, pendingApprovals, kycPending, weeklyAnalytics, weeklySignups, invitesSent, invitesAccepted },
        revenue: {
          paidOrdersTotal: Number(paidAgg._sum.total ?? 0),
          merchantNetTotal: Number(paidAgg._sum.merchantNetAmount ?? 0),
          pendingOrdersTotal: Number(pendingAgg._sum.total ?? 0),
        },
        urgentQueue: [
          ...(pendingProposals > 0 ? [{ type: 'proposals', label: `${pendingProposals} pending proposal${pendingProposals !== 1 ? 's' : ''}`, href: 'proposals' }] : []),
          ...(pendingApprovals > 0 ? [{ type: 'approvals', label: `${pendingApprovals} fundraising approval${pendingApprovals !== 1 ? 's' : ''} waiting`, href: 'approvals' }] : []),
          ...(kycPending > 0 ? [{ type: 'kyc', label: `${kycPending} KYC submission${kycPending !== 1 ? 's' : ''} to review`, href: 'kyc' }] : []),
        ],
        recentBids,
        recentActivity,
        weeklyTrend: Object.entries(dailyTrend).map(([date, count]) => ({ date, count })),
        lastUpdated,
      },
    });
  });
}
