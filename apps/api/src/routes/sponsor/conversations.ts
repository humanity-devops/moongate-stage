import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireSponsorAuth } from '../../plugins/auth.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { z } from 'zod';

const CONVERSATION_STATUSES = ['accepted', 'countered', 'under_review'] as const;

export async function sponsorConversationRoutes(fastify: FastifyInstance) {
  // GET /api/sponsor/conversations
  fastify.get('/conversations', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const bids = await prisma.bid.findMany({
      where: {
        email: user.email,
        status: { in: CONVERSATION_STATUSES as unknown as string[] },
      },
      include: {
        event: { select: { id: true, name: true, slug: true, startDate: true } },
        item: { select: { id: true, publicTitle: true, category: true } },
        tenant: { select: { slug: true, name: true } },
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reply.send({ data: bids });
  });

  // GET /api/sponsor/conversations/:bidId/messages
  fastify.get<{ Params: { bidId: string } }>('/conversations/:bidId/messages', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { bidId } = request.params;

    const bid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) throw new NotFoundError('Bid', bidId);
    if (bid.email !== user.email) throw new ForbiddenError('Access denied');

    const messages = await prisma.bidMessage.findMany({
      where: { bidId, isInternal: false },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send({ data: messages });
  });

  // POST /api/sponsor/conversations/:bidId/messages
  fastify.post<{ Params: { bidId: string }; Body: unknown }>('/conversations/:bidId/messages', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { bidId } = request.params;

    const bid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) throw new NotFoundError('Bid', bidId);
    if (bid.email !== user.email) throw new ForbiddenError('Access denied');

    if (!CONVERSATION_STATUSES.includes(bid.status as typeof CONVERSATION_STATUSES[number])) {
      return reply.status(400).send({ error: 'Messaging is only available for active bids (accepted, countered, or under_review)' });
    }

    const schema = z.object({
      content: z.string().min(1).max(2000),
    });
    const { content } = schema.parse(request.body);

    const message = await prisma.bidMessage.create({
      data: {
        bidId,
        authorType: 'sponsor',
        authorId: user.userId,
        authorName: user.email,
        content,
        isInternal: false,
      },
    });

    return reply.status(201).send({ data: message });
  });
}
