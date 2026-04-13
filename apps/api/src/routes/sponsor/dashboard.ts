import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireSponsorAuth } from '../../plugins/auth.js';

export async function sponsorDashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const [bids, orders, savedCount] = await Promise.all([
      prisma.bid.findMany({
        where: { email: user.email },
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { bid: { email: user.email } },
        select: { id: true, status: true, total: true, currency: true },
      }),
      prisma.savedItem.count({ where: { userId: user.userId } }),
    ]);

    const activeBids = bids.filter(b => ['submitted', 'under_review', 'countered'].includes(b.status)).length;
    const pendingActions = bids.filter(b => b.status === 'countered').length;
    const totalSpend = orders
      .filter(o => o.status === 'paid')
      .reduce((sum, o) => sum + Number(o.total), 0);

    const recentBids = await prisma.bid.findMany({
      where: { email: user.email },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        item: { select: { publicTitle: true } },
        event: { select: { name: true, slug: true } },
        tenant: { select: { slug: true, name: true } },
        counterOffers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    return reply.send({
      data: {
        kpis: { activeBids, pendingActions, totalSpend, savedCount },
        recentBids,
      },
    });
  });
}
