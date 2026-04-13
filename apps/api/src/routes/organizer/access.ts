import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';
import { trackEvent } from '../../lib/analytics.js';
import { randomBytes } from 'node:crypto';

export async function organizerAccessRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // PATCH /api/organizer/events/:eventId/access
  // Set access mode for an event
  fastify.patch<{
    Params: { eventId: string };
    Body: unknown;
  }>('/', async (request, reply) => {
    await requirePermission('manage_inventory')(request);
    const user = request.user!;

    const schema = z.object({
      accessMode: z.enum(['public', 'whitelist', 'invite_only']),
    });
    const { accessMode } = schema.parse(request.body);

    const event = await prisma.event.findFirst({
      where: { id: request.params.eventId, tenantId: user.tenantId },
    });
    if (!event) throw new NotFoundError('Event', request.params.eventId);

    const before = { accessMode: event.accessMode };
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { accessMode },
      select: { id: true, accessMode: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'access_mode_changed',
      resource: 'event',
      resourceId: event.id,
      before,
      after: { accessMode },
      request,
    });

    return reply.send({ data: updated });
  });

  // GET /api/organizer/events/:eventId/access/grants
  fastify.get<{ Params: { eventId: string } }>('/grants', async (request, reply) => {
    const user = request.user!;
    const event = await prisma.event.findFirst({
      where: { id: request.params.eventId, tenantId: user.tenantId },
    });
    if (!event) throw new NotFoundError('Event', request.params.eventId);

    const grants = await prisma.eventAccessGrant.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ data: grants });
  });

  // POST /api/organizer/events/:eventId/access/grants
  // Create email whitelist entry or one-time token
  fastify.post<{
    Params: { eventId: string };
    Body: unknown;
  }>('/grants', async (request, reply) => {
    await requirePermission('manage_inventory')(request);
    const user = request.user!;

    const schema = z.object({
      grantType: z.enum(['email', 'token']),
      email: z.string().email().optional(),
      expiresAt: z.string().datetime().optional(),
    });
    const body = schema.parse(request.body);

    if (body.grantType === 'email' && !body.email) {
      throw new ValidationError('email is required for email grant type');
    }

    const event = await prisma.event.findFirst({
      where: { id: request.params.eventId, tenantId: user.tenantId },
    });
    if (!event) throw new NotFoundError('Event', request.params.eventId);

    const token = body.grantType === 'token'
      ? randomBytes(24).toString('base64url')
      : undefined;

    const grant = await prisma.eventAccessGrant.create({
      data: {
        eventId: event.id,
        grantType: body.grantType,
        email: body.email ?? null,
        token: token ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdBy: user.userId,
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'access_grant_created',
      resource: 'event_access_grant',
      resourceId: grant.id,
      after: { grantType: body.grantType, email: body.email },
      request,
    });

    return reply.status(201).send({ data: grant });
  });

  // DELETE /api/organizer/events/:eventId/access/grants/:grantId
  fastify.delete<{ Params: { eventId: string; grantId: string } }>(
    '/grants/:grantId',
    async (request, reply) => {
      await requirePermission('manage_inventory')(request);
      const user = request.user!;

      const event = await prisma.event.findFirst({
        where: { id: request.params.eventId, tenantId: user.tenantId },
      });
      if (!event) throw new NotFoundError('Event', request.params.eventId);

      const grant = await prisma.eventAccessGrant.findFirst({
        where: { id: request.params.grantId, eventId: event.id },
      });
      if (!grant) throw new NotFoundError('Grant', request.params.grantId);

      await prisma.eventAccessGrant.delete({ where: { id: grant.id } });

      logAudit({
        tenantId: user.tenantId,
        userId: user.userId,
        action: 'access_grant_revoked',
        resource: 'event_access_grant',
        resourceId: grant.id,
        before: { grantType: grant.grantType, email: grant.email },
        request,
      });

      return reply.send({ data: { message: 'Grant revoked' } });
    },
  );
}

// ─── Item-level access routes ─────────────────────────────────────────────────

export async function organizerItemAccessRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // GET /api/organizer/access/items/:itemId
  fastify.get<{ Params: { itemId: string } }>('/:itemId', async (request, reply) => {
    await requirePermission('manage_inventory')(request);
    const user = request.user!;

    const item = await prisma.sponsorItem.findFirst({
      where: { id: request.params.itemId, event: { tenantId: user.tenantId } },
      select: { id: true, publicTitle: true, itemAccessMode: true },
    });
    if (!item) throw new NotFoundError('Item', request.params.itemId);

    const grants = await prisma.itemAccessGrant.findMany({
      where: { itemId: item.id },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ data: { item, grants } });
  });

  // PATCH /api/organizer/access/items/:itemId
  fastify.patch<{ Params: { itemId: string }; Body: unknown }>('/:itemId', async (request, reply) => {
    await requirePermission('manage_inventory')(request);
    const user = request.user!;

    const schema = z.object({
      mode: z.enum(['public', 'whitelist_only', 'invite_only']).nullable(),
    });
    const { mode } = schema.parse(request.body);

    const item = await prisma.sponsorItem.findFirst({
      where: { id: request.params.itemId, event: { tenantId: user.tenantId } },
    });
    if (!item) throw new NotFoundError('Item', request.params.itemId);

    const updated = await prisma.sponsorItem.update({
      where: { id: item.id },
      data: { itemAccessMode: mode },
      select: { id: true, publicTitle: true, itemAccessMode: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'package_access_policy_updated',
      resource: 'sponsor_item',
      resourceId: item.id,
      before: { itemAccessMode: item.itemAccessMode },
      after: { itemAccessMode: mode },
      request,
    });

    trackEvent({
      eventType: 'package_access_policy_updated',
      tenantId: user.tenantId,
      userId: user.userId,
      resourceId: item.id,
      resourceType: 'sponsor_item',
      metadata: { mode },
      request,
    });

    return reply.send({ data: updated });
  });

  // POST /api/organizer/access/items/:itemId/grants
  fastify.post<{ Params: { itemId: string }; Body: unknown }>('/:itemId/grants', async (request, reply) => {
    await requirePermission('manage_inventory')(request);
    const user = request.user!;

    const schema = z.object({
      emails: z.array(z.string().email()).min(1),
    });
    const { emails } = schema.parse(request.body);

    const item = await prisma.sponsorItem.findFirst({
      where: { id: request.params.itemId, event: { tenantId: user.tenantId } },
    });
    if (!item) throw new NotFoundError('Item', request.params.itemId);

    const existing = await prisma.itemAccessGrant.findMany({
      where: { itemId: item.id, email: { in: emails.map(e => e.toLowerCase()) } },
      select: { email: true },
    });
    const existingEmails = new Set(existing.map(g => g.email?.toLowerCase()));

    const toCreate = emails.filter(e => !existingEmails.has(e.toLowerCase()));

    if (toCreate.length > 0) {
      await prisma.itemAccessGrant.createMany({
        data: toCreate.map(email => ({
          itemId: item.id,
          grantType: 'email',
          email: email.toLowerCase(),
          createdBy: user.userId,
        })),
      });
    }

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'access_grant_created',
      resource: 'item_access_grant',
      resourceId: item.id,
      after: { emails: toCreate, skipped: emails.length - toCreate.length },
      request,
    });

    return reply.status(201).send({
      data: { created: toCreate.length, skipped: emails.length - toCreate.length },
    });
  });

  // DELETE /api/organizer/access/items/:itemId/grants/:grantId
  fastify.delete<{ Params: { itemId: string; grantId: string } }>('/:itemId/grants/:grantId', async (request, reply) => {
    await requirePermission('manage_inventory')(request);
    const user = request.user!;

    const item = await prisma.sponsorItem.findFirst({
      where: { id: request.params.itemId, event: { tenantId: user.tenantId } },
    });
    if (!item) throw new NotFoundError('Item', request.params.itemId);

    const grant = await prisma.itemAccessGrant.findFirst({
      where: { id: request.params.grantId, itemId: item.id },
    });
    if (!grant) throw new NotFoundError('Grant', request.params.grantId);

    await prisma.itemAccessGrant.delete({ where: { id: grant.id } });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'access_grant_revoked',
      resource: 'item_access_grant',
      resourceId: grant.id,
      before: { email: grant.email },
      request,
    });

    return reply.send({ data: { message: 'Grant revoked' } });
  });
}
