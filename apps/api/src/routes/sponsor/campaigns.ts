import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireSponsorAuth } from '../../plugins/auth.js';
import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';
import { createStripeClient } from '@moongate/payments';
import { env } from '../../lib/env.js';
import { trackEvent } from '../../lib/analytics.js';

export async function sponsorCampaignRoutes(fastify: FastifyInstance) {
  // GET /api/sponsor/campaigns — list all active public campaigns sponsor can back
  fastify.get<{ Querystring: { page?: string; pageSize?: string } }>('/', async (request, reply) => {
    await requireSponsorAuth(request);
    const { page = '1', pageSize = '24' } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const [campaigns, total] = await Promise.all([
      prisma.crowdfundCampaign.findMany({
        where: { approvalStatus: 'approved', status: 'active' },
        include: {
          item: { select: { publicTitle: true, category: true, currency: true } },
          event: {
            select: { name: true, slug: true, startDate: true, city: true, country: true },
          },
          tenant: { select: { slug: true, name: true } },
          _count: { select: { contributions: true } },
        },
        orderBy: [{ raisedAmount: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: parseInt(pageSize),
      }),
      prisma.crowdfundCampaign.count({ where: { approvalStatus: 'approved', status: 'active' } }),
    ]);

    return reply.send({ data: campaigns, total });
  });

  // GET /api/sponsor/campaigns/my — user's contribution history
  // Note: must be declared before /:campaignId to avoid route conflict
  fastify.get('/my', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const contributions = await prisma.crowdfundContribution.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: {
          select: {
            id: true,
            entityName: true,
            goalAmount: true,
            raisedAmount: true,
            status: true,
            event: { select: { name: true, slug: true } },
            tenant: { select: { slug: true } },
            item: { select: { publicTitle: true } },
          },
        },
      },
    });

    return reply.send({ data: contributions });
  });

  // GET /api/sponsor/campaigns/:campaignId
  fastify.get<{ Params: { campaignId: string } }>('/:campaignId', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const campaign = await prisma.crowdfundCampaign.findFirst({
      where: { id: request.params.campaignId, approvalStatus: 'approved' },
      include: {
        item: {
          select: {
            publicTitle: true,
            shortDescription: true,
            category: true,
            currency: true,
            listPrice: true,
            benefits: { select: { label: true, value: true } },
          },
        },
        event: {
          select: {
            name: true,
            slug: true,
            startDate: true,
            endDate: true,
            city: true,
            country: true,
          },
        },
        tenant: { select: { slug: true, name: true } },
        contributions: {
          where: { status: 'confirmed' },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            contributorName: true,
            amount: true,
            currency: true,
            message: true,
            createdAt: true,
          },
        },
        _count: { select: { contributions: true } },
      },
    });

    if (!campaign) throw new NotFoundError('Campaign', request.params.campaignId);

    // Check if user has contributed
    const myContribution = await prisma.crowdfundContribution.findFirst({
      where: {
        campaignId: campaign.id,
        userId: user.userId,
        status: { in: ['confirmed', 'pending_payment'] },
      },
      select: { id: true, amount: true, status: true },
    });

    trackEvent({
      eventType: 'campaign_viewed',
      userId: user.userId,
      resourceId: campaign.id,
      resourceType: 'campaign',
    });

    return reply.send({ data: { ...campaign, myContribution } });
  });

  // POST /api/sponsor/campaigns/:campaignId/contribute — creates order + Stripe checkout
  fastify.post<{ Params: { campaignId: string }; Body: unknown }>(
    '/:campaignId/contribute',
    {
      config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    },
    async (request, reply) => {
      const user = await requireSponsorAuth(request);

      const schema = z.object({
        amount: z.number().positive().min(1),
        message: z.string().max(500).optional(),
        contributorName: z.string().min(1).max(200).optional(),
      });

      const result = schema.safeParse(request.body);
      if (!result.success) throw new ValidationError('Invalid data', result.error.format());
      const data = result.data;

      const campaign = await prisma.crowdfundCampaign.findFirst({
        where: {
          id: request.params.campaignId,
          approvalStatus: 'approved',
          status: 'active',
        },
        include: {
          item: { select: { publicTitle: true } },
          event: { select: { name: true, slug: true } },
          tenant: { select: { slug: true } },
        },
      });

      if (!campaign) throw new NotFoundError('Campaign', request.params.campaignId);

      if (new Date() > campaign.deadline) {
        await prisma.crowdfundCampaign.update({
          where: { id: campaign.id },
          data: { status: 'expired' },
        });
        throw new ConflictError('This campaign has expired.');
      }

      // Prevent duplicate pending contribution from same user
      const pendingContrib = await prisma.crowdfundContribution.findFirst({
        where: { campaignId: campaign.id, userId: user.userId, status: 'pending_payment' },
      });
      if (pendingContrib) {
        const session = pendingContrib.orderId
          ? await prisma.checkoutSession.findFirst({
              where: { orderId: pendingContrib.orderId },
              orderBy: { createdAt: 'desc' },
            })
          : null;
        if (session?.checkoutUrl && session.status === 'created') {
          return reply.send({
            data: { url: session.checkoutUrl, contributionId: pendingContrib.id },
          });
        }
      }

      if (!env.STRIPE_SECRET_KEY) {
        return reply.status(503).send({ error: 'Payment processing not configured' });
      }

      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
      const contributorName = data.contributorName ?? dbUser?.name ?? user.email;

      const stripe = createStripeClient(env.STRIPE_SECRET_KEY);

      const { contribution, order } = await prisma.$transaction(async (tx) => {
        const contrib = await tx.crowdfundContribution.create({
          data: {
            campaignId: campaign.id,
            userId: user.userId,
            contributorName,
            contributorEmail: user.email,
            message: data.message ?? null,
            amount: data.amount,
            currency: campaign.currency,
            status: 'pending_payment',
          },
        });

        const ord = await tx.order.create({
          data: {
            tenantId: campaign.tenantId,
            eventId: campaign.eventId,
            status: 'payment_pending',
            currency: campaign.currency,
            subtotal: data.amount,
            total: data.amount,
            notes: `Campaign contribution: ${campaign.entityName}`,
            lines: {
              create: {
                itemId: campaign.itemId,
                quantity: 1,
                unitPrice: data.amount,
                total: data.amount,
                label: `Contribution: ${campaign.item.publicTitle}`,
              },
            },
          },
        });

        await tx.crowdfundContribution.update({
          where: { id: contrib.id },
          data: { orderId: ord.id },
        });

        return { contribution: contrib, order: ord };
      });

      const stripeSession = await stripe.createCheckoutSession({
        orderId: order.id,
        currency: campaign.currency,
        lineItems: [
          {
            name: `Contribution: ${campaign.item.publicTitle}`,
            description: `Supporting ${campaign.entityName} at ${campaign.event.name}`,
            amount: data.amount,
            quantity: 1,
          },
        ],
        successUrl: `${env.APP_URL}/portal/campaigns/${campaign.id}?success=1`,
        cancelUrl: `${env.APP_URL}/portal/campaigns/${campaign.id}?cancelled=1`,
        customerEmail: user.email,
        metadata: { contributionId: contribution.id },
      });

      await prisma.checkoutSession.create({
        data: {
          orderId: order.id,
          provider: 'stripe',
          externalSessionId: stripeSession.id,
          checkoutUrl: stripeSession.url,
          status: 'created',
        },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: stripeSession.id },
      });

      trackEvent({
        eventType: 'contribution_started',
        userId: user.userId,
        tenantId: campaign.tenantId,
        resourceId: campaign.id,
        resourceType: 'campaign',
        metadata: { amount: data.amount, currency: campaign.currency },
        request,
      });

      return reply.send({ data: { url: stripeSession.url, contributionId: contribution.id } });
    },
  );

  // GET /api/sponsor/campaigns/:campaignId/verification-requests
  fastify.get<{ Params: { campaignId: string } }>(
    '/:campaignId/verification-requests',
    async (request, reply) => {
      const user = await requireSponsorAuth(request);

      const campaign = await prisma.crowdfundCampaign.findFirst({
        where: { id: request.params.campaignId },
      });
      if (!campaign) throw new NotFoundError('Campaign', request.params.campaignId);

      if (campaign.contactEmail !== user.email) {
        throw new NotFoundError('Campaign', request.params.campaignId);
      }

      const verificationRequests = await prisma.crowdfundVerificationRequest.findMany({
        where: { campaignId: campaign.id, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({ data: verificationRequests });
    },
  );

  // POST /api/sponsor/campaigns/:campaignId/verification-requests/:requestId/respond
  fastify.post<{
    Params: { campaignId: string; requestId: string };
    Body: unknown;
  }>(
    '/:campaignId/verification-requests/:requestId/respond',
    async (request, reply) => {
      const user = await requireSponsorAuth(request);

      const schema = z.object({
        response: z.string().min(1).max(5000),
      });

      const result = schema.safeParse(request.body);
      if (!result.success) throw new ValidationError('Invalid response data', result.error.format());
      const { response } = result.data;

      const campaign = await prisma.crowdfundCampaign.findFirst({
        where: { id: request.params.campaignId },
      });
      if (!campaign) throw new NotFoundError('Campaign', request.params.campaignId);

      if (campaign.contactEmail !== user.email) {
        throw new NotFoundError('Campaign', request.params.campaignId);
      }

      const verificationRequest = await prisma.crowdfundVerificationRequest.findFirst({
        where: { id: request.params.requestId, campaignId: campaign.id },
      });
      if (!verificationRequest) throw new NotFoundError('Verification Request', request.params.requestId);

      const updated = await prisma.crowdfundVerificationRequest.update({
        where: { id: verificationRequest.id },
        data: {
          response,
          respondedAt: new Date(),
          status: 'submitted',
        },
      });

      trackEvent({
        eventType: 'crowdfunding_verification_requested',
        userId: user.userId,
        resourceId: campaign.id,
        resourceType: 'crowdfund_campaign',
        metadata: {
          action: 'sponsor_responded',
          verificationRequestId: verificationRequest.id,
          type: verificationRequest.type,
        },
        request,
      });

      return reply.send({ data: updated });
    },
  );
}
