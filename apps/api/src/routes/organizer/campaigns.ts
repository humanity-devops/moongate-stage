import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';
import { trackEvent } from '../../lib/analytics.js';

export async function organizerCampaignRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // GET /api/organizer/events/:eventId/campaigns
  fastify.get<{
    Params: { eventId: string };
    Querystring: { approvalStatus?: string; status?: string };
  }>('/', async (request, reply) => {
    const user = request.user!;
    const { approvalStatus, status } = request.query;

    const where: Record<string, unknown> = {
      eventId: request.params.eventId,
      tenantId: user.tenantId,
    };
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (status) where.status = status;

    const campaigns = await prisma.crowdfundCampaign.findMany({
      where,
      include: {
        item: { select: { publicTitle: true, slug: true, category: true, listPrice: true } },
        _count: { select: { contributions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ data: campaigns });
  });

  // GET /api/organizer/events/:eventId/campaigns/:campaignId
  fastify.get<{ Params: { eventId: string; campaignId: string } }>(
    '/:campaignId',
    async (request, reply) => {
      const user = request.user!;
      const campaign = await prisma.crowdfundCampaign.findFirst({
        where: {
          id: request.params.campaignId,
          eventId: request.params.eventId,
          tenantId: user.tenantId,
        },
        include: {
          item: true,
          contributions: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
      });
      if (!campaign) throw new NotFoundError('Campaign', request.params.campaignId);
      return reply.send({ data: campaign });
    },
  );

  // PATCH /api/organizer/events/:eventId/campaigns/:campaignId/review
  fastify.patch<{
    Params: { eventId: string; campaignId: string };
    Body: unknown;
  }>('/:campaignId/review', async (request, reply) => {
    await requirePermission('manage_bids')(request);
    const user = request.user!;

    const schema = z.object({
      approvalStatus: z.enum(['approved', 'rejected']),
      rejectionReason: z.string().max(1000).optional(),
    });
    const body = schema.parse(request.body);

    if (body.approvalStatus === 'rejected' && !body.rejectionReason) {
      throw new ValidationError('rejectionReason is required when rejecting a campaign');
    }

    const campaign = await prisma.crowdfundCampaign.findFirst({
      where: {
        id: request.params.campaignId,
        eventId: request.params.eventId,
        tenantId: user.tenantId,
      },
    });
    if (!campaign) throw new NotFoundError('Campaign', request.params.campaignId);

    const before = { approvalStatus: campaign.approvalStatus, rejectionReason: campaign.rejectionReason };

    const updated = await prisma.crowdfundCampaign.update({
      where: { id: campaign.id },
      data: {
        approvalStatus: body.approvalStatus,
        approvedBy: user.userId,
        approvedAt: new Date(),
        rejectionReason: body.rejectionReason ?? null,
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: `campaign_${body.approvalStatus}`,
      resource: 'crowdfund_campaign',
      resourceId: campaign.id,
      before,
      after: { approvalStatus: body.approvalStatus, rejectionReason: body.rejectionReason },
      request,
    });

    return reply.send({ data: updated });
  });

  // POST /api/organizer/events/:eventId/campaigns/:campaignId/verification-requests
  fastify.post<{
    Params: { eventId: string; campaignId: string };
    Body: unknown;
  }>('/:campaignId/verification-requests', async (request, reply) => {
    await requirePermission('manage_bids')(request);
    const user = request.user!;

    const schema = z.object({
      type: z.enum(['identity', 'document', 'context', 'other']),
      description: z.string().min(1).max(2000),
    });

    const result = schema.safeParse(request.body);
    if (!result.success) throw new ValidationError('Invalid verification request data', result.error.format());
    const { type, description } = result.data;

    const campaign = await prisma.crowdfundCampaign.findFirst({
      where: {
        id: request.params.campaignId,
        eventId: request.params.eventId,
        tenantId: user.tenantId,
      },
    });
    if (!campaign) throw new NotFoundError('Campaign', request.params.campaignId);

    const [verificationRequest] = await prisma.$transaction([
      prisma.crowdfundVerificationRequest.create({
        data: {
          campaignId: campaign.id,
          requestedBy: user.userId,
          type,
          description,
          status: 'pending',
        },
      }),
      prisma.crowdfundCampaign.update({
        where: { id: campaign.id },
        data: { verificationStatus: 'verification_pending' },
      }),
    ]);

    trackEvent({
      eventType: 'crowdfunding_verification_requested',
      tenantId: user.tenantId,
      userId: user.userId,
      resourceId: campaign.id,
      resourceType: 'crowdfund_campaign',
      metadata: { type, verificationRequestId: verificationRequest.id },
      request,
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'crowdfunding_verification_requested',
      resource: 'crowdfund_campaign',
      resourceId: campaign.id,
      after: { type, description, verificationRequestId: verificationRequest.id },
      request,
    });

    return reply.status(201).send({ data: verificationRequest });
  });

  // GET /api/organizer/events/:eventId/campaigns/:campaignId/verification-requests
  fastify.get<{
    Params: { eventId: string; campaignId: string };
  }>('/:campaignId/verification-requests', async (request, reply) => {
    const user = request.user!;

    const campaign = await prisma.crowdfundCampaign.findFirst({
      where: {
        id: request.params.campaignId,
        eventId: request.params.eventId,
        tenantId: user.tenantId,
      },
    });
    if (!campaign) throw new NotFoundError('Campaign', request.params.campaignId);

    const verificationRequests = await prisma.crowdfundVerificationRequest.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ data: verificationRequests });
  });

  // PATCH /api/organizer/events/:eventId/campaigns/:campaignId/verification-requests/:requestId
  fastify.patch<{
    Params: { eventId: string; campaignId: string; requestId: string };
    Body: unknown;
  }>('/:campaignId/verification-requests/:requestId', async (request, reply) => {
    await requirePermission('manage_bids')(request);
    const user = request.user!;

    const schema = z.object({
      status: z.literal('reviewed'),
    });

    const result = schema.safeParse(request.body);
    if (!result.success) throw new ValidationError('Invalid review data', result.error.format());
    const { status } = result.data;

    const campaign = await prisma.crowdfundCampaign.findFirst({
      where: {
        id: request.params.campaignId,
        eventId: request.params.eventId,
        tenantId: user.tenantId,
      },
    });
    if (!campaign) throw new NotFoundError('Campaign', request.params.campaignId);

    const verificationRequest = await prisma.crowdfundVerificationRequest.findFirst({
      where: { id: request.params.requestId, campaignId: campaign.id },
    });
    if (!verificationRequest) throw new NotFoundError('Verification Request', request.params.requestId);

    const updated = await prisma.crowdfundVerificationRequest.update({
      where: { id: verificationRequest.id },
      data: { status },
    });

    // Check if all requests for this campaign are now reviewed → set verified
    const pendingCount = await prisma.crowdfundVerificationRequest.count({
      where: {
        campaignId: campaign.id,
        status: { not: 'reviewed' },
      },
    });

    if (pendingCount === 0) {
      await prisma.crowdfundCampaign.update({
        where: { id: campaign.id },
        data: { verificationStatus: 'verified' },
      });
    }

    return reply.send({ data: updated });
  });
}
