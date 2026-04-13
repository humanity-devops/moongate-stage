import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';

export async function organizerEventRoutes(fastify: FastifyInstance) {
  // All routes require auth
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // GET /api/organizer/events
  fastify.get('/', async (request, reply) => {
    const user = request.user!;
    if (!user.tenantId) throw new ForbiddenError('No tenant access');

    const events = await prisma.event.findMany({
      where: { tenantId: user.tenantId },
      include: {
        branding: true,
        stats: true,
        _count: { select: { sponsorItems: true, bids: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ data: events });
  });

  // POST /api/organizer/events
  fastify.post<{ Body: unknown }>('/', async (request, reply) => {
    await requirePermission('manage_event')(request);
    const user = request.user!;

    const schema = z.object({
      name: z.string().min(1).max(200),
      tagline: z.string().max(300).optional(),
      description: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      location: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      websiteUrl: z.string().url().optional(),
    });

    const data = schema.parse(request.body);
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const event = await prisma.event.create({
      data: {
        tenantId: user.tenantId!,
        slug,
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        action: 'created',
        resource: 'event',
        resourceId: event.id,
        after: event as unknown as Record<string, unknown>,
      },
    });

    return reply.status(201).send({ data: event });
  });

  // GET /api/organizer/events/:eventId
  fastify.get<{ Params: { eventId: string } }>('/:eventId', async (request, reply) => {
    const user = request.user!;
    const event = await prisma.event.findFirst({
      where: { id: request.params.eventId, tenantId: user.tenantId },
      include: {
        branding: true,
        stats: true,
        _count: { select: { sponsorItems: true, bids: true, orders: true } },
      },
    });
    if (!event) throw new NotFoundError('Event', request.params.eventId);
    return reply.send({ data: event });
  });

  // PATCH /api/organizer/events/:eventId
  fastify.patch<{ Params: { eventId: string }; Body: unknown }>(
    '/:eventId',
    async (request, reply) => {
      await requirePermission('manage_event')(request);
      const user = request.user!;

      const event = await prisma.event.findFirst({
        where: { id: request.params.eventId, tenantId: user.tenantId },
      });
      if (!event) throw new NotFoundError('Event', request.params.eventId);

      const schema = z.object({
        name: z.string().min(1).max(200).optional(),
        tagline: z.string().max(300).optional(),
        description: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        location: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        websiteUrl: z.string().url().optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
      });

      const data = schema.parse(request.body);
      const updated = await prisma.event.update({
        where: { id: event.id },
        data: {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.userId,
          action: 'updated',
          resource: 'event',
          resourceId: event.id,
          before: event as unknown as Record<string, unknown>,
          after: updated as unknown as Record<string, unknown>,
        },
      });

      return reply.send({ data: updated });
    },
  );

  // GET /api/organizer/events/:eventId/dashboard
  fastify.get<{ Params: { eventId: string } }>(
    '/:eventId/dashboard',
    async (request, reply) => {
      const user = request.user!;
      const { eventId } = request.params;

      const event = await prisma.event.findFirst({
        where: { id: eventId, tenantId: user.tenantId },
      });
      if (!event) throw new NotFoundError('Event', eventId);

      const [
        totalItems,
        publishedItems,
        soldOutItems,
        totalBids,
        pendingBids,
        totalOrders,
        paidOrders,
        recentActivity,
      ] = await Promise.all([
        prisma.sponsorItem.count({ where: { eventId } }),
        prisma.sponsorItem.count({ where: { eventId, status: 'published' } }),
        prisma.sponsorItem.count({ where: { eventId, status: 'sold_out' } }),
        prisma.bid.count({ where: { eventId } }),
        prisma.bid.count({ where: { eventId, status: { in: ['submitted', 'under_review'] } } }),
        prisma.order.count({ where: { eventId } }),
        prisma.order.count({ where: { eventId, status: 'paid' } }),
        prisma.activityFeedEntry.findMany({
          where: { eventId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      // Revenue from paid orders
      const revenueResult = await prisma.order.aggregate({
        where: { eventId, status: 'paid' },
        _sum: { total: true },
      });

      // Pipeline value from bids
      const pipelineResult = await prisma.bid.aggregate({
        where: { eventId, status: { in: ['submitted', 'under_review', 'countered'] } },
        _sum: { proposedBudget: true },
      });

      return reply.send({
        data: {
          totalItems,
          publishedItems,
          soldOutItems,
          totalBids,
          pendingBids,
          totalOrders,
          paidOrders,
          revenue: Number(revenueResult._sum.total ?? 0),
          pipelineValue: Number(pipelineResult._sum.proposedBudget ?? 0),
          recentActivity,
        },
      });
    },
  );
}
