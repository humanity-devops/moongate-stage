import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { NotFoundError, ValidationError, ConflictError } from '../../lib/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Expire campaigns whose deadlines have passed (lazy resolution). */
async function expireOverdueCampaigns(itemId: string) {
  await prisma.crowdfundCampaign.updateMany({
    where: { itemId, status: 'active', deadline: { lt: new Date() } },
    data: { status: 'expired' },
  });
}

function formatCampaign(c: Record<string, unknown>, includeContributions = false) {
  const contributions = (c.contributions as Record<string, unknown>[] | undefined) ?? [];
  const backerCount = contributions.length;
  return {
    id: c.id,
    entityName: c.entityName,
    entityDescription: c.entityDescription,
    entityWebsite: c.entityWebsite,
    contactName: c.contactName,
    goalAmount: c.goalAmount,
    raisedAmount: c.raisedAmount,
    currency: c.currency,
    deadline: c.deadline,
    status: c.status,
    wonAt: c.wonAt,
    backerCount,
    percentFunded: Number(c.goalAmount) > 0
      ? Math.min(100, Math.round((Number(c.raisedAmount) / Number(c.goalAmount)) * 100))
      : 0,
    createdAt: c.createdAt,
    ...(includeContributions
      ? {
          recentContributions: contributions.slice(0, 10).map((ct: Record<string, unknown>) => ({
            id: ct.id,
            contributorName: ct.contributorName,
            message: ct.message,
            amount: ct.amount,
            currency: ct.currency,
            createdAt: ct.createdAt,
          })),
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function publicCrowdfundRoutes(fastify: FastifyInstance) {
  // ── GET /events/:tenantSlug/:eventSlug/items/:slug/campaigns ──────────────
  // List all campaigns for a specific sponsorship item.
  fastify.get<{
    Params: { tenantSlug: string; eventSlug: string; slug: string };
  }>('/events/:tenantSlug/:eventSlug/items/:slug/campaigns', async (request, reply) => {
    const { tenantSlug, eventSlug, slug } = request.params;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findFirst({
      where: { tenantId: tenant.id, slug: eventSlug, status: 'published' },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const item = await prisma.sponsorItem.findFirst({
      where: { eventId: event.id, slug, visibleToPublic: true },
    });
    if (!item) throw new NotFoundError('Item', slug);

    // Lazily expire overdue campaigns
    await expireOverdueCampaigns(item.id);

    const campaigns = await prisma.crowdfundCampaign.findMany({
      where: { itemId: item.id, approvalStatus: 'approved' },
      include: { contributions: { orderBy: { createdAt: 'desc' } } },
      orderBy: [{ status: 'asc' }, { raisedAmount: 'desc' }, { createdAt: 'asc' }],
    });

    return reply.send({
      data: campaigns.map(c => formatCampaign(c as unknown as Record<string, unknown>)),
    });
  });

  // ── GET /events/:tenantSlug/:eventSlug/campaigns/:campaignId ─────────────
  // Full detail for one campaign, including recent contributions.
  fastify.get<{
    Params: { tenantSlug: string; eventSlug: string; campaignId: string };
  }>('/events/:tenantSlug/:eventSlug/campaigns/:campaignId', async (request, reply) => {
    const { tenantSlug, eventSlug, campaignId } = request.params;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findFirst({
      where: { tenantId: tenant.id, slug: eventSlug, status: 'published' },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const campaign = await prisma.crowdfundCampaign.findFirst({
      where: { id: campaignId, eventId: event.id, approvalStatus: 'approved' },
      include: {
        item: {
          select: {
            slug: true,
            publicTitle: true,
            shortDescription: true,
            category: true,
            listPrice: true,
            currency: true,
            status: true,
          },
        },
        contributions: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!campaign) throw new NotFoundError('Campaign', campaignId);

    // Lazily expire if needed
    if (campaign.status === 'active' && new Date() > campaign.deadline) {
      await prisma.crowdfundCampaign.update({
        where: { id: campaignId },
        data: { status: 'expired' },
      });
      campaign.status = 'expired';
    }

    return reply.send({
      data: {
        ...formatCampaign(campaign as unknown as Record<string, unknown>, true),
        item: campaign.item,
      },
    });
  });

  // ── POST /events/:tenantSlug/:eventSlug/items/:slug/campaigns ─────────────
  // An entity submits a campaign to crowdfund this sponsorship package.
  const createCampaignSchema = z.object({
    entityName: z.string().min(1).max(200),
    entityDescription: z.string().max(1000).optional(),
    entityWebsite: z.string().url().optional().or(z.literal('')),
    contactName: z.string().min(1).max(200),
    contactEmail: z.string().email(),
    goalAmount: z.number().positive().optional(), // required only for request_only items
    deadline: z.string().datetime(),
    termsAccepted: z.boolean().refine(v => v === true, 'Terms must be accepted'),
  });

  fastify.post<{
    Params: { tenantSlug: string; eventSlug: string; slug: string };
    Body: unknown;
  }>('/events/:tenantSlug/:eventSlug/items/:slug/campaigns', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const { tenantSlug, eventSlug, slug } = request.params;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findFirst({
      where: { tenantId: tenant.id, slug: eventSlug, status: 'published' },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const item = await prisma.sponsorItem.findFirst({
      where: { eventId: event.id, slug, visibleToPublic: true, status: 'published' },
    });
    if (!item) throw new NotFoundError('Item', slug);

    // Crowdfunding is not meaningful for items that are sold out
    if (item.status === 'sold_out') {
      throw new ConflictError('This sponsorship package is no longer available.');
    }

    const result = createCampaignSchema.safeParse(request.body);
    if (!result.success) throw new ValidationError('Invalid campaign data', result.error.format());
    const data = result.data;

    // Determine goal amount
    const listPrice = item.listPrice ? Number(item.listPrice) : null;
    const goalAmount = listPrice ?? data.goalAmount;
    if (!goalAmount || goalAmount <= 0) {
      throw new ValidationError('A funding goal amount is required for this package.');
    }

    // Validate deadline: must be in the future and at most 30 days out
    const deadline = new Date(data.deadline);
    const now = new Date();
    const maxDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (deadline <= now) throw new ValidationError('Deadline must be in the future.');
    if (deadline > maxDeadline) throw new ValidationError('Deadline cannot be more than 30 days from now.');

    // Check for existing active campaign from the same contact email for this item
    await expireOverdueCampaigns(item.id);
    const existing = await prisma.crowdfundCampaign.findFirst({
      where: { itemId: item.id, contactEmail: data.contactEmail, status: 'active' },
    });
    if (existing) {
      throw new ConflictError('You already have an active campaign for this package.');
    }

    const campaign = await prisma.crowdfundCampaign.create({
      data: {
        tenantId: tenant.id,
        eventId: event.id,
        itemId: item.id,
        entityName: data.entityName,
        entityDescription: data.entityDescription,
        entityWebsite: data.entityWebsite || null,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        goalAmount,
        currency: item.currency ?? 'USD',
        deadline,
        status: 'active',
        approvalStatus: 'pending',
      },
    });

    await prisma.activityFeedEntry.create({
      data: {
        tenantId: tenant.id,
        eventId: event.id,
        type: 'crowdfund_campaign_started',
        title: `New crowdfund campaign: ${data.entityName}`,
        body: `${data.entityName} started a community funding campaign for "${item.publicTitle}" — goal: ${goalAmount} ${item.currency}`,
        resourceId: campaign.id,
        resourceType: 'crowdfund_campaign',
      },
    });

    return reply.status(201).send({
      data: {
        id: campaign.id,
        status: campaign.status,
        approvalStatus: campaign.approvalStatus,
        message: `Your campaign has been submitted for review. Once approved by the organizer it will go live and you can share it with your community.`,
      },
    });
  });

  // ── POST /events/:tenantSlug/:eventSlug/campaigns/:campaignId/contribute ──
  // A community member contributes to a campaign.
  const contributeSchema = z.object({
    contributorName: z.string().min(1).max(200),
    contributorEmail: z.string().email(),
    amount: z.number().positive().min(1),
    message: z.string().max(500).optional(),
  });

  fastify.post<{
    Params: { tenantSlug: string; eventSlug: string; campaignId: string };
    Body: unknown;
  }>('/events/:tenantSlug/:eventSlug/campaigns/:campaignId/contribute', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const { tenantSlug, eventSlug, campaignId } = request.params;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findFirst({
      where: { tenantId: tenant.id, slug: eventSlug, status: 'published' },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const result = contributeSchema.safeParse(request.body);
    if (!result.success) throw new ValidationError('Invalid contribution data', result.error.format());
    const data = result.data;

    // Transactional: contribute + check for winner atomically
    const outcome = await prisma.$transaction(async (tx) => {
      const campaign = await tx.crowdfundCampaign.findFirst({
        where: { id: campaignId, eventId: event.id, approvalStatus: 'approved' },
      });
      if (!campaign) throw new NotFoundError('Campaign', campaignId);

      // Lazily expire if needed
      if (campaign.status === 'active' && new Date() > campaign.deadline) {
        await tx.crowdfundCampaign.update({
          where: { id: campaignId },
          data: { status: 'expired' },
        });
        throw new ConflictError('This campaign has expired.');
      }

      if (campaign.status !== 'active') {
        throw new ConflictError(
          campaign.status === 'won'
            ? 'This campaign has already reached its goal.'
            : campaign.status === 'lost'
              ? 'This campaign did not win — another campaign reached the goal first.'
              : 'This campaign is no longer accepting contributions.',
        );
      }

      // Record the contribution
      const contribution = await tx.crowdfundContribution.create({
        data: {
          campaignId: campaign.id,
          contributorName: data.contributorName,
          contributorEmail: data.contributorEmail,
          message: data.message,
          amount: data.amount,
          currency: campaign.currency,
          status: 'confirmed',
        },
      });

      const newRaised = Number(campaign.raisedAmount) + data.amount;

      await tx.crowdfundCampaign.update({
        where: { id: campaignId },
        data: { raisedAmount: newRaised },
      });

      let won = false;

      // Check if goal is reached — first campaign to do so wins
      if (newRaised >= Number(campaign.goalAmount)) {
        await tx.crowdfundCampaign.update({
          where: { id: campaignId },
          data: { status: 'won', wonAt: new Date() },
        });

        // Mark all other active campaigns for this item as lost
        await tx.crowdfundCampaign.updateMany({
          where: {
            itemId: campaign.itemId,
            id: { not: campaignId },
            status: 'active',
          },
          data: { status: 'lost' },
        });

        won = true;
      }

      return { contribution, newRaised, won, goalAmount: campaign.goalAmount, currency: campaign.currency };
    });

    // Activity log (outside transaction, non-critical)
    await prisma.activityFeedEntry.create({
      data: {
        tenantId: tenant.id,
        eventId: event.id,
        type: outcome.won ? 'crowdfund_campaign_won' : 'crowdfund_contribution',
        title: outcome.won
          ? `Campaign goal reached by ${data.contributorName}!`
          : `New contribution to crowdfund campaign`,
        body: `${data.contributorName} contributed ${data.amount} ${outcome.currency}`,
        resourceId: outcome.contribution.id,
        resourceType: 'crowdfund_contribution',
      },
    }).catch(() => { /* non-critical */ });

    const responseMessage = outcome.won
      ? `🎉 Goal reached! Your contribution pushed this campaign over the finish line. The organizers have been notified.`
      : `Thank you! Your contribution of ${data.amount} ${outcome.currency} has been recorded. ${Math.round((outcome.newRaised / Number(outcome.goalAmount)) * 100)}% funded.`;

    return reply.status(201).send({
      data: {
        id: outcome.contribution.id,
        campaignWon: outcome.won,
        newRaisedAmount: outcome.newRaised,
        message: responseMessage,
      },
    });
  });
}
