import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { createKycSubmissionForBid } from './kyc.js';
import { sendEmail } from '../../lib/email.js';
import { bidCounteredEmail, bidAcceptedEmail, bidRejectedEmail } from '@moongate/emails';
import { env } from '../../lib/env.js';
import { notify } from '../../lib/notify.js';

// Terminal states that cannot be transitioned out of by the organizer
const TERMINAL_BID_STATES = new Set(['accepted', 'rejected', 'expired', 'withdrawn']);
// States from which a counter-offer is valid
const COUNTERABLE_STATES = new Set(['submitted', 'under_review', 'countered']);
// States from which acceptance is valid
const ACCEPTABLE_STATES = new Set(['submitted', 'under_review', 'countered']);

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function organizerBidRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
    await requirePermission('manage_bids')(request);
  });

  // GET /api/organizer/events/:eventId/bids
  fastify.get<{
    Params: { eventId: string };
    Querystring: { status?: string };
  }>('/', async (request, reply) => {
    const user = request.user!;
    const { status } = request.query;

    const where: Record<string, unknown> = {
      eventId: request.params.eventId,
      tenantId: user.tenantId,
    };
    if (status) where.status = status;

    const bids = await prisma.bid.findMany({
      where,
      include: {
        item: { select: { publicTitle: true, slug: true, category: true, listPrice: true } },
        sponsorCompany: true,
        sponsorContact: true,
        assignedTo: { select: { name: true, email: true } },
        counterOffers: { orderBy: { createdAt: 'desc' } },
        _count: { select: { attachments: true, messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ data: bids });
  });

  // GET /api/organizer/events/:eventId/bids/:bidId
  fastify.get<{ Params: { eventId: string; bidId: string } }>(
    '/:bidId', async (request, reply) => {
      const user = request.user!;
      const bid = await prisma.bid.findFirst({
        where: {
          id: request.params.bidId,
          eventId: request.params.eventId,
          tenantId: user.tenantId,
        },
        include: {
          item: true,
          sponsorCompany: true,
          sponsorContact: true,
          attachments: { include: { fileAsset: true } },
          messages: { orderBy: { createdAt: 'asc' } },
          counterOffers: { orderBy: { createdAt: 'desc' } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });
      if (!bid) throw new NotFoundError('Bid', request.params.bidId);
      return reply.send({ data: bid });
    },
  );

  // PATCH /api/organizer/events/:eventId/bids/:bidId (update status, notes, assignee)
  fastify.patch<{ Params: { eventId: string; bidId: string }; Body: unknown }>(
    '/:bidId', async (request, reply) => {
      const user = request.user!;
      const bid = await prisma.bid.findFirst({
        where: {
          id: request.params.bidId,
          eventId: request.params.eventId,
          tenantId: user.tenantId,
        },
      });
      if (!bid) throw new NotFoundError('Bid', request.params.bidId);

      const schema = z.object({
        status: z.enum(['under_review', 'accepted', 'rejected', 'expired', 'withdrawn']).optional(),
        internalNotes: z.string().optional(),
        assignedToId: z.string().optional(),
      });

      const data = schema.parse(request.body);

      // Guard terminal state transitions
      if (data.status && TERMINAL_BID_STATES.has(bid.status)) {
        return reply.status(400).send({ error: `Bid is already in terminal state '${bid.status}' and cannot be changed` });
      }

      // 'accepted' via PATCH must go through the /accept endpoint to create an order
      if (data.status === 'accepted') {
        return reply.status(400).send({ error: "Use the /accept endpoint to accept a bid — it creates the order" });
      }

      const updated = await prisma.bid.update({
        where: { id: bid.id },
        data,
      });

      if (data.status) {
        await prisma.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.userId,
            action: data.status,
            resource: 'bid',
            resourceId: bid.id,
            before: { status: bid.status } as Record<string, unknown>,
            after: { status: data.status } as Record<string, unknown>,
          },
        });

        // Send rejection email to sponsor (fire-and-forget)
        if (data.status === 'rejected') {
          const rejEmail = bidRejectedEmail({
            contactName: bid.contactName,
            contactEmail: bid.email,
            itemTitle: 'Sponsorship Package',
            eventName: bid.eventId,
            portalUrl: `${env.APP_URL}/portal`,
          });
          sendEmail({
            to: Array.isArray(rejEmail.to) ? rejEmail.to[0] : rejEmail.to,
            subject: rejEmail.subject,
            html: rejEmail.html,
            text: rejEmail.text,
            template: 'bid_rejected',
            tenantId: user.tenantId,
            resourceId: bid.id,
            resourceType: 'bid',
          }).catch(() => {});

          // Notify sponsor user in-app
          prisma.user.findUnique({ where: { email: bid.email } }).then(sponsorUser => {
            if (sponsorUser) {
              notify({
                userId: sponsorUser.id,
                type: 'bid_rejected',
                title: 'Your bid was not accepted',
                body: 'The organizer has reviewed your sponsorship bid and it was not accepted at this time.',
                data: { bidId: bid.id },
              });
            }
          }).catch(() => {});
        }
      }

      return reply.send({ data: updated });
    },
  );

  // POST /api/organizer/events/:eventId/bids/:bidId/counter
  fastify.post<{ Params: { eventId: string; bidId: string }; Body: unknown }>(
    '/:bidId/counter', async (request, reply) => {
      await requirePermission('counter_bids')(request);
      const user = request.user!;

      const bid = await prisma.bid.findFirst({
        where: {
          id: request.params.bidId,
          eventId: request.params.eventId,
          tenantId: user.tenantId,
        },
      });
      if (!bid) throw new NotFoundError('Bid', request.params.bidId);

      if (!COUNTERABLE_STATES.has(bid.status)) {
        return reply.status(400).send({ error: `Cannot counter a bid in '${bid.status}' state` });
      }

      const schema = z.object({
        offeredPrice: z.number().positive(),
        currency: z.string().default('USD'),
        message: z.string().optional(),
        validUntil: z.string().datetime().optional(),
      });

      const data = schema.parse(request.body);

      // Supersede previous pending counter offers
      await prisma.counterOffer.updateMany({
        where: { bidId: bid.id, status: 'pending' },
        data: { status: 'superseded' },
      });

      const counter = await prisma.counterOffer.create({
        data: {
          bidId: bid.id,
          offeredPrice: data.offeredPrice,
          currency: data.currency,
          message: data.message,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        },
      });

      await prisma.bid.update({
        where: { id: bid.id },
        data: { status: 'countered' },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.userId,
          action: 'countered',
          resource: 'bid',
          resourceId: bid.id,
          after: { offeredPrice: data.offeredPrice } as Record<string, unknown>,
        },
      });

      // Send counter-offer email to sponsor (fire-and-forget)
      const counterEmail = bidCounteredEmail({
        contactName: bid.contactName,
        contactEmail: bid.email,
        itemTitle: 'Sponsorship Package',
        eventName: bid.eventId,
        offeredPrice: data.offeredPrice,
        currency: data.currency,
        message: data.message,
        portalUrl: `${env.APP_URL}/portal/deals/${bid.id}`,
      });
      sendEmail({
        to: Array.isArray(counterEmail.to) ? counterEmail.to[0] : counterEmail.to,
        subject: counterEmail.subject,
        html: counterEmail.html,
        text: counterEmail.text,
        template: 'bid_countered',
        tenantId: user.tenantId,
        resourceId: bid.id,
        resourceType: 'bid',
      }).catch(() => {});

      // Notify sponsor user in-app
      prisma.user.findUnique({ where: { email: bid.email } }).then(sponsorUser => {
        if (sponsorUser) {
          notify({
            userId: sponsorUser.id,
            type: 'bid_countered',
            title: 'Counter-offer received',
            body: `The organizer has sent a counter-offer of ${data.currency} ${data.offeredPrice.toLocaleString()} for your bid.`,
            data: { bidId: bid.id, offeredPrice: data.offeredPrice, currency: data.currency },
          });
        }
      }).catch(() => {});

      return reply.status(201).send({ data: counter });
    },
  );

  // POST /api/organizer/events/:eventId/bids/:bidId/accept
  fastify.post<{ Params: { eventId: string; bidId: string } }>(
    '/:bidId/accept', async (request, reply) => {
      await requirePermission('accept_bids')(request);
      const user = request.user!;

      const bid = await prisma.bid.findFirst({
        where: {
          id: request.params.bidId,
          eventId: request.params.eventId,
          tenantId: user.tenantId,
        },
        include: { item: true, order: { select: { id: true } } },
      });
      if (!bid) throw new NotFoundError('Bid', request.params.bidId);

      if (!ACCEPTABLE_STATES.has(bid.status)) {
        return reply.status(400).send({ error: `Cannot accept a bid in '${bid.status}' state` });
      }

      // Idempotency: if order already exists (shouldn't happen but safe)
      if (bid.order) {
        return reply.send({ data: { bid: { ...bid, status: bid.status }, order: bid.order } });
      }

      // Create order from bid
      const fullAmount = Number(bid.proposedBudget);
      const depositEnabled = Boolean(bid.item.depositEnabled);
      const depositPct = Number(bid.item.depositPercentage ?? 30);
      const safeDepositPct = Number.isFinite(depositPct) && depositPct > 0 ? depositPct : 30;
      const depositAmount = depositEnabled ? roundMoney((fullAmount * safeDepositPct) / 100) : null;
      const balanceDueAmount = depositEnabled ? roundMoney(fullAmount - (depositAmount ?? 0)) : null;
      const finalPaymentDueAt =
        depositEnabled && bid.item.finalPaymentDays
          ? new Date(Date.now() + bid.item.finalPaymentDays * 24 * 60 * 60 * 1000)
          : null;

      const order = await prisma.order.create({
        data: {
          tenantId: user.tenantId!,
          eventId: bid.eventId,
          bidId: bid.id,
          sponsorCompanyId: bid.sponsorCompanyId,
          sponsorContactId: bid.sponsorContactId,
          status: 'pending',
          currency: bid.currency,
          subtotal: fullAmount,
          total: depositEnabled ? (depositAmount ?? fullAmount) : fullAmount,
          fullAmount,
          depositAmount,
          balanceDueAmount,
          paymentStage: depositEnabled ? 'deposit' : 'full',
          finalPaymentDueAt,
          lines: {
            create: {
              itemId: bid.itemId,
              quantity: 1,
              unitPrice: depositEnabled ? (depositAmount ?? fullAmount) : fullAmount,
              total: depositEnabled ? (depositAmount ?? fullAmount) : fullAmount,
              label: depositEnabled
                ? `${bid.item.publicTitle} — Deposit (${safeDepositPct}%)`
                : bid.item.publicTitle,
            },
          },
        },
      });

      await prisma.bid.update({
        where: { id: bid.id },
        data: { status: 'accepted' },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.userId,
          action: 'accepted',
          resource: 'bid',
          resourceId: bid.id,
          after: { orderId: order.id } as Record<string, unknown>,
        },
      });

      // Trigger KYC submission if tenant has a KYC config
      createKycSubmissionForBid(
        user.tenantId!,
        bid.id,
        order.id,
        bid.sponsorContactId ?? undefined,
      ).catch(() => { /* non-critical */ });

      // Send bid accepted email to sponsor (fire-and-forget)
      const acceptEmail = bidAcceptedEmail({
        contactName: bid.contactName,
        contactEmail: bid.email,
        itemTitle: bid.item.publicTitle,
        eventName: bid.eventId,
        agreedPrice: Number(bid.proposedBudget),
        currency: bid.currency,
      });
      sendEmail({
        to: Array.isArray(acceptEmail.to) ? acceptEmail.to[0] : acceptEmail.to,
        subject: acceptEmail.subject,
        html: acceptEmail.html,
        text: acceptEmail.text,
        template: 'bid_accepted',
        tenantId: user.tenantId,
        resourceId: bid.id,
        resourceType: 'bid',
      }).catch(() => {});

      // Notify sponsor user in-app
      prisma.user.findUnique({ where: { email: bid.email } }).then(sponsorUser => {
        if (sponsorUser) {
          notify({
            userId: sponsorUser.id,
            type: 'bid_accepted',
            title: 'Your bid was accepted',
            body: `Congratulations! Your sponsorship bid for ${bid.item.publicTitle} has been accepted.`,
            data: { bidId: bid.id, orderId: order.id },
          });
        }
      }).catch(() => {});

      return reply.send({ data: { bid: { ...bid, status: 'accepted' }, order } });
    },
  );

  // POST /api/organizer/events/:eventId/bids/:bidId/message
  fastify.post<{ Params: { eventId: string; bidId: string }; Body: unknown }>(
    '/:bidId/message', async (request, reply) => {
      const user = request.user!;
      const bid = await prisma.bid.findFirst({
        where: {
          id: request.params.bidId,
          eventId: request.params.eventId,
          tenantId: user.tenantId,
        },
        include: { assignedTo: true },
      });
      if (!bid) throw new NotFoundError('Bid', request.params.bidId);

      const schema = z.object({
        content: z.string().min(1).max(2000),
        isInternal: z.boolean().default(false),
      });
      const data = schema.parse(request.body);

      const message = await prisma.bidMessage.create({
        data: {
          bidId: bid.id,
          authorType: 'organizer',
          authorId: user.userId,
          authorName: 'Organizer Team',
          content: data.content,
          isInternal: data.isInternal,
        },
      });

      return reply.status(201).send({ data: message });
    },
  );
}
