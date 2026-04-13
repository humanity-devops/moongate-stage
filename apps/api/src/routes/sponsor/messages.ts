import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireSponsorAuth } from '../../plugins/auth.js';

export async function sponsorMessageRoutes(fastify: FastifyInstance) {
  // All message threads grouped by bid
  fastify.get('/', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const bids = await prisma.bid.findMany({
      where: {
        email: user.email,
        messages: { some: { isInternal: false } },
      },
      include: {
        event: { select: { name: true, slug: true } },
        tenant: { select: { slug: true } },
        item: { select: { publicTitle: true } },
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reply.send({ data: bids });
  });
}
