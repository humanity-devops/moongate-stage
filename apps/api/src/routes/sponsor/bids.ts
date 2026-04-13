import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireSponsorAuth } from '../../plugins/auth.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';

export async function sponsorBidRoutes(fastify: FastifyInstance) {
  // List all bids by this sponsor's email
  fastify.get('/', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const bids = await prisma.bid.findMany({
      where: { email: user.email },
      orderBy: { updatedAt: 'desc' },
      include: {
        event: { select: { id: true, name: true, slug: true, startDate: true, city: true, country: true } },
        item: { select: { id: true, publicTitle: true, category: true, listPrice: true, currency: true } },
        tenant: { select: { slug: true, name: true } },
        counterOffers: { orderBy: { createdAt: 'desc' }, take: 1 },
        messages: { where: { isInternal: false }, orderBy: { createdAt: 'desc' }, take: 1 },
        order: { select: { id: true, status: true, total: true } },
      },
    });

    return reply.send({ data: bids });
  });

  // Get a single bid detail
  fastify.get('/:bidId', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { bidId } = request.params as { bidId: string };

    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        event: { select: { id: true, name: true, slug: true, startDate: true, endDate: true, city: true, country: true } },
        item: {
          select: {
            id: true, publicTitle: true, category: true, listPrice: true, currency: true,
            minimumBid: true, maximumBid: true,
            shortDescription: true, benefits: { select: { label: true, value: true, quantity: true } },
          },
        },
        tenant: { select: { slug: true, name: true } },
        counterOffers: { orderBy: { createdAt: 'desc' } },
        messages: { where: { isInternal: false }, orderBy: { createdAt: 'asc' } },
        order: { select: { id: true, status: true, total: true, currency: true } },
      },
    });

    if (!bid) throw new NotFoundError('Bid not found');
    if (bid.email !== user.email) throw new ForbiddenError('Access denied');

    return reply.send({ data: bid });
  });

  // Accept a counter-offer — creates order at the counter's offeredPrice
  fastify.post('/:bidId/accept-counter', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { bidId } = request.params as { bidId: string };

    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        item: { select: { id: true, publicTitle: true } },
        counterOffers: { orderBy: { createdAt: 'desc' }, take: 1 },
        order: { select: { id: true } },
      },
    });
    if (!bid) throw new NotFoundError('Bid not found');
    if (bid.email !== user.email) throw new ForbiddenError('Access denied');

    if (bid.status === 'accepted') {
      // Idempotent — already accepted
      return reply.send({ data: { ok: true, orderId: bid.order?.id } });
    }

    const latestCounter = bid.counterOffers[0];
    if (!latestCounter || latestCounter.status !== 'pending') {
      return reply.status(400).send({ error: 'No pending counter-offer to accept' });
    }

    // Create order at the counter's offered price in a single transaction
    const agreedPrice = latestCounter.offeredPrice;
    const currency = latestCounter.currency;

    const order = await prisma.$transaction(async (tx) => {
      // Mark counter accepted + bid accepted
      await tx.counterOffer.update({
        where: { id: latestCounter.id },
        data: { status: 'accepted', respondedAt: new Date() },
      });

      await tx.bid.update({
        where: { id: bidId },
        data: { status: 'accepted' },
      });

      // Create order at counter's offered price
      return tx.order.create({
        data: {
          tenantId: bid.tenantId,
          eventId: bid.eventId,
          bidId: bid.id,
          sponsorCompanyId: bid.sponsorCompanyId,
          sponsorContactId: bid.sponsorContactId,
          status: 'pending',
          currency,
          subtotal: agreedPrice,
          total: agreedPrice,
          lines: {
            create: {
              itemId: bid.itemId,
              quantity: 1,
              unitPrice: agreedPrice,
              total: agreedPrice,
              label: bid.item.publicTitle,
            },
          },
        },
      });
    });

    return reply.send({ data: { ok: true, orderId: order.id } });
  });

  // Reject a counter-offer
  fastify.post('/:bidId/reject-counter', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { bidId } = request.params as { bidId: string };

    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: { counterOffers: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!bid) throw new NotFoundError('Bid not found');
    if (bid.email !== user.email) throw new ForbiddenError('Access denied');

    const latestCounter = bid.counterOffers[0];
    if (!latestCounter || latestCounter.status !== 'pending') {
      return reply.status(400).send({ error: 'No pending counter-offer to reject' });
    }

    await prisma.$transaction([
      prisma.counterOffer.update({ where: { id: latestCounter.id }, data: { status: 'rejected', respondedAt: new Date() } }),
      prisma.bid.update({ where: { id: bidId }, data: { status: 'under_review' } }),
    ]);

    return reply.send({ data: { ok: true } });
  });

  // Withdraw a bid
  fastify.post('/:bidId/withdraw', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { bidId } = request.params as { bidId: string };

    const bid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) throw new NotFoundError('Bid not found');
    if (bid.email !== user.email) throw new ForbiddenError('Access denied');

    const withdrawable = ['submitted', 'under_review', 'countered'];
    if (!withdrawable.includes(bid.status)) {
      return reply.status(400).send({ error: 'Bid cannot be withdrawn in its current state' });
    }

    await prisma.bid.update({ where: { id: bidId }, data: { status: 'withdrawn' } });

    return reply.send({ data: { ok: true } });
  });

  // Post a message on a bid
  fastify.post('/:bidId/messages', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { bidId } = request.params as { bidId: string };
    const { content } = request.body as { content: string };

    const bid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid) throw new NotFoundError('Bid not found');
    if (bid.email !== user.email) throw new ForbiddenError('Access denied');

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
