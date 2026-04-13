import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError } from '../../lib/errors.js';

export async function organizerItemRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // GET /api/organizer/events/:eventId/items
  fastify.get<{ Params: { eventId: string } }>('/', async (request, reply) => {
    const user = request.user!;
    const items = await prisma.sponsorItem.findMany({
      where: { eventId: request.params.eventId, tenantId: user.tenantId },
      include: {
        benefits: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { bids: true, orderLines: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return reply.send({ data: items });
  });

  // POST /api/organizer/events/:eventId/items
  fastify.post<{ Params: { eventId: string }; Body: unknown }>('/', async (request, reply) => {
    await requirePermission('manage_inventory')(request);
    const user = request.user!;

    const schema = z.object({
      publicTitle: z.string().min(1).max(300),
      internalTitle: z.string().optional(),
      shortDescription: z.string().max(500).optional(),
      longDescription: z.string().optional(),
      category: z.string(),
      mode: z.enum(['fixed_price', 'sealed_bid', 'hybrid', 'request_only']),
      currency: z.string().default('USD'),
      listPrice: z.number().positive().optional(),
      reservePrice: z.number().positive().optional(),
      minimumBid: z.number().positive().optional(),
      bidAllowed: z.boolean().default(false),
      quantityTotal: z.number().int().positive().optional(),
      isExclusive: z.boolean().default(false),
      featured: z.boolean().default(false),
      packageTier: z.string().optional(),
      onRequest: z.boolean().default(false),
      requiresApproval: z.boolean().default(false),
      visibleToPublic: z.boolean().default(false),
      checkoutEnabled: z.boolean().default(true),
      depositEnabled: z.boolean().default(false),
      depositPercentage: z.number().min(1).max(100).default(30),
      finalPaymentDays: z.number().int().positive().max(365).optional(),
      benefits: z.array(z.object({
        type: z.string(),
        label: z.string(),
        value: z.string().optional(),
        quantity: z.number().optional(),
        sortOrder: z.number().default(0),
      })).optional(),
    });

    const data = schema.parse(request.body);
    const { benefits, ...itemData } = data;

    // Generate slug from title
    const baseSlug = itemData.publicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.sponsorItem.findFirst({ where: { eventId: request.params.eventId, slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const item = await prisma.sponsorItem.create({
      data: {
        ...itemData,
        eventId: request.params.eventId,
        tenantId: user.tenantId!,
        slug,
        benefits: benefits ? { create: benefits } : undefined,
      },
      include: { benefits: true },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        action: 'created',
        resource: 'sponsor_item',
        resourceId: item.id,
      },
    });

    return reply.status(201).send({ data: item });
  });

  // PATCH /api/organizer/events/:eventId/items/:itemId
  fastify.patch<{ Params: { eventId: string; itemId: string }; Body: unknown }>(
    '/:itemId', async (request, reply) => {
      await requirePermission('manage_inventory')(request);
      const user = request.user!;

      const item = await prisma.sponsorItem.findFirst({
        where: { id: request.params.itemId, eventId: request.params.eventId, tenantId: user.tenantId },
      });
      if (!item) throw new NotFoundError('Item', request.params.itemId);

      const schema = z.object({
        publicTitle: z.string().min(1).max(300).optional(),
        shortDescription: z.string().max(500).optional(),
        longDescription: z.string().optional(),
        status: z.enum(['draft', 'review_required', 'published', 'reserved', 'sold_out', 'archived']).optional(),
        listPrice: z.number().positive().optional(),
        reservePrice: z.number().positive().optional(),
        minimumBid: z.number().positive().optional(),
        quantityTotal: z.number().int().positive().optional(),
        featured: z.boolean().optional(),
        visibleToPublic: z.boolean().optional(),
        checkoutEnabled: z.boolean().optional(),
        depositEnabled: z.boolean().optional(),
        depositPercentage: z.number().min(1).max(100).optional(),
        finalPaymentDays: z.number().int().positive().max(365).nullable().optional(),
        sortOrder: z.number().optional(),
      }).passthrough();

      const data = schema.parse(request.body);
      const updated = await prisma.sponsorItem.update({
        where: { id: item.id },
        data,
        include: { benefits: true },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.userId,
          action: data.status === 'published' ? 'published' : 'updated',
          resource: 'sponsor_item',
          resourceId: item.id,
          before: item as unknown as Record<string, unknown>,
          after: updated as unknown as Record<string, unknown>,
        },
      });

      return reply.send({ data: updated });
    },
  );

  // DELETE /api/organizer/events/:eventId/items/:itemId (archive)
  fastify.delete<{ Params: { eventId: string; itemId: string } }>(
    '/:itemId', async (request, reply) => {
      await requirePermission('manage_inventory')(request);
      const user = request.user!;

      const item = await prisma.sponsorItem.findFirst({
        where: { id: request.params.itemId, eventId: request.params.eventId, tenantId: user.tenantId },
      });
      if (!item) throw new NotFoundError('Item', request.params.itemId);

      await prisma.sponsorItem.update({
        where: { id: item.id },
        data: { status: 'archived', visibleToPublic: false },
      });

      return reply.send({ data: { message: 'Item archived' } });
    },
  );
}
