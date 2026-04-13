import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requirePlatformRole } from '../../plugins/auth.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { DEFAULT_COMMISSION_RATE } from '../../lib/fees.js';
import { logAudit } from '../../lib/audit.js';

const rateSchema = z.object({
  commissionRate: z
    .number()
    .min(0, 'Commission rate cannot be negative')
    .max(1, 'Commission rate cannot exceed 100% (use a value between 0 and 1)'),
});

export async function platformCommissionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requirePlatformRole(request);
  });

  // GET /api/platform/commissions/default
  fastify.get('/default', async (_request, reply) => {
    return reply.send({ data: { commissionRate: DEFAULT_COMMISSION_RATE, source: 'platform_default' } });
  });

  // GET /api/platform/commissions/merchants — list all merchant commission rates
  fastify.get('/merchants', async (_request, reply) => {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, commissionRate: true },
      orderBy: { name: 'asc' },
    });
    return reply.send({
      data: tenants.map(t => ({
        ...t,
        commissionRate: t.commissionRate !== null ? Number(t.commissionRate) : null,
        effectiveRate: t.commissionRate !== null ? Number(t.commissionRate) : DEFAULT_COMMISSION_RATE,
      })),
    });
  });

  // PATCH /api/platform/commissions/merchants/:tenantId — set/clear merchant rate
  fastify.patch<{ Params: { tenantId: string }; Body: unknown }>(
    '/merchants/:tenantId', async (request, reply) => {
      const schema = z.object({
        commissionRate: z
          .number()
          .min(0)
          .max(1)
          .nullable()
          .describe('null clears the override (falls back to platform default)'),
      });
      const data = schema.parse(request.body);

      const tenant = await prisma.tenant.findUnique({ where: { id: request.params.tenantId } });
      if (!tenant) throw new NotFoundError('Tenant', request.params.tenantId);

      const before = { commissionRate: tenant.commissionRate };
      const updated = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { commissionRate: data.commissionRate },
        select: { id: true, name: true, slug: true, commissionRate: true },
      });

      logAudit({
        action: 'commission_rate_updated',
        resource: 'tenant',
        resourceId: tenant.id,
        before,
        after: { commissionRate: updated.commissionRate },
      });

      return reply.send({
        data: {
          ...updated,
          commissionRate: updated.commissionRate !== null ? Number(updated.commissionRate) : null,
          effectiveRate: updated.commissionRate !== null ? Number(updated.commissionRate) : DEFAULT_COMMISSION_RATE,
        },
      });
    },
  );

  // GET /api/platform/commissions/events — list event-level overrides (only those with a rate set)
  fastify.get<{ Querystring: { tenantId?: string } }>(
    '/events', async (request, reply) => {
      const where = request.query.tenantId
        ? { tenantId: request.query.tenantId, commissionRate: { not: null } }
        : { commissionRate: { not: null } };

      const events = await prisma.event.findMany({
        where,
        select: {
          id: true, name: true, slug: true, tenantId: true,
          commissionRate: true,
          tenant: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      });

      return reply.send({
        data: events.map(e => ({
          ...e,
          commissionRate: e.commissionRate !== null ? Number(e.commissionRate) : null,
        })),
      });
    },
  );

  // PATCH /api/platform/commissions/events/:eventId — set/clear event rate
  fastify.patch<{ Params: { eventId: string }; Body: unknown }>(
    '/events/:eventId', async (request, reply) => {
      const schema = z.object({
        commissionRate: z.number().min(0).max(1).nullable(),
      });
      const data = schema.parse(request.body);

      const event = await prisma.event.findUnique({ where: { id: request.params.eventId } });
      if (!event) throw new NotFoundError('Event', request.params.eventId);

      const before = { commissionRate: event.commissionRate };
      const updated = await prisma.event.update({
        where: { id: event.id },
        data: { commissionRate: data.commissionRate },
        select: { id: true, name: true, slug: true, tenantId: true, commissionRate: true },
      });

      logAudit({
        tenantId: event.tenantId,
        action: 'commission_rate_updated',
        resource: 'event',
        resourceId: event.id,
        before,
        after: { commissionRate: updated.commissionRate },
      });

      return reply.send({
        data: {
          ...updated,
          commissionRate: updated.commissionRate !== null ? Number(updated.commissionRate) : null,
        },
      });
    },
  );
}
