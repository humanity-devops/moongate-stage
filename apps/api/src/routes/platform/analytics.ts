import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requirePlatformRole } from '../../plugins/auth.js';
import { DEFAULT_COMMISSION_RATE } from '../../lib/fees.js';

export async function platformAnalyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requirePlatformRole(request);
  });

  // GET /api/platform/analytics/overview
  // KPIs: gross volume, platform fees, bid/order counts, conversion funnel
  fastify.get<{
    Querystring: { from?: string; to?: string; tenantId?: string; eventId?: string };
  }>('/overview', async (request, reply) => {
    const { from, to, tenantId, eventId } = request.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paidWhere: any = { status: 'paid' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderWhere: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bidWhere: any = {};

    if (tenantId) { paidWhere.tenantId = tenantId; orderWhere.tenantId = tenantId; bidWhere.tenantId = tenantId; }
    if (eventId)  { paidWhere.eventId  = eventId;  orderWhere.eventId  = eventId;  bidWhere.eventId  = eventId; }
    if (from || to) {
      const dateFilter = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
      paidWhere.paidAt  = dateFilter;
      orderWhere.createdAt = dateFilter;
      bidWhere.createdAt   = dateFilter;
    }

    const [
      grossVolumeResult,
      platformFeesResult,
      paidOrderCount,
      totalOrderCount,
      totalBidCount,
      acceptedBidCount,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: paidWhere,
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: paidWhere,
        _sum: { platformFeeAmount: true },
      }),
      prisma.order.count({ where: paidWhere }),
      prisma.order.count({ where: orderWhere }),
      prisma.bid.count({ where: bidWhere }),
      prisma.bid.count({ where: { ...bidWhere, status: 'accepted' } }),
    ]);

    const grossVolume = Number(grossVolumeResult._sum.total ?? 0);
    const platformFees = Number(platformFeesResult._sum.platformFeeAmount ?? 0);

    return reply.send({
      data: {
        grossVolume,
        platformFees,
        platformFeesDefault: DEFAULT_COMMISSION_RATE,
        paidOrderCount,
        totalOrderCount,
        totalBidCount,
        acceptedBidCount,
        conversionRate: totalBidCount > 0 ? (acceptedBidCount / totalBidCount) : 0,
        paymentConversionRate: acceptedBidCount > 0 ? (paidOrderCount / acceptedBidCount) : 0,
      },
    });
  });

  // GET /api/platform/analytics/income-by-period
  fastify.get<{
    Querystring: { from?: string; to?: string; granularity?: 'day' | 'week' | 'month'; tenantId?: string };
  }>('/income-by-period', async (request, reply) => {
    const { from, to, granularity = 'month', tenantId } = request.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { status: 'paid' };
    if (tenantId) where.tenantId = tenantId;
    if (from || to) {
      where.paidAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }

    const orders = await prisma.order.findMany({
      where,
      select: { paidAt: true, total: true, platformFeeAmount: true, merchantNetAmount: true, tenantId: true },
      orderBy: { paidAt: 'asc' },
    });

    // Group by period
    const buckets: Record<string, { period: string; grossVolume: number; platformFees: number; merchantNet: number; count: number }> = {};
    for (const order of orders) {
      const date = order.paidAt ?? new Date();
      let period: string;
      if (granularity === 'day') {
        period = date.toISOString().slice(0, 10);
      } else if (granularity === 'week') {
        const d = new Date(date);
        d.setDate(d.getDate() - d.getDay());
        period = d.toISOString().slice(0, 10);
      } else {
        period = date.toISOString().slice(0, 7);
      }
      if (!buckets[period]) buckets[period] = { period, grossVolume: 0, platformFees: 0, merchantNet: 0, count: 0 };
      buckets[period].grossVolume  += Number(order.total ?? 0);
      buckets[period].platformFees += Number(order.platformFeeAmount ?? 0);
      buckets[period].merchantNet  += Number(order.merchantNetAmount ?? 0);
      buckets[period].count++;
    }

    return reply.send({ data: Object.values(buckets) });
  });

  // GET /api/platform/analytics/top-merchants
  fastify.get<{ Querystring: { from?: string; to?: string; limit?: string } }>(
    '/top-merchants', async (request, reply) => {
      const { from, to, limit = '10' } = request.query;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { status: 'paid' };
      if (from || to) {
        where.paidAt = {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        };
      }

      const orders = await prisma.order.findMany({
        where,
        select: { tenantId: true, total: true, platformFeeAmount: true, tenant: { select: { name: true, slug: true } } },
      });

      const merchants: Record<string, { tenantId: string; name: string; slug: string; grossVolume: number; platformFees: number; orderCount: number }> = {};
      for (const o of orders) {
        if (!merchants[o.tenantId]) {
          merchants[o.tenantId] = { tenantId: o.tenantId, name: o.tenant.name, slug: o.tenant.slug, grossVolume: 0, platformFees: 0, orderCount: 0 };
        }
        merchants[o.tenantId].grossVolume  += Number(o.total);
        merchants[o.tenantId].platformFees += Number(o.platformFeeAmount ?? 0);
        merchants[o.tenantId].orderCount++;
      }

      const sorted = Object.values(merchants)
        .sort((a, b) => b.grossVolume - a.grossVolume)
        .slice(0, Math.min(50, parseInt(limit)));

      return reply.send({ data: sorted });
    },
  );

  // GET /api/platform/analytics/top-events
  fastify.get<{ Querystring: { from?: string; to?: string; limit?: string } }>(
    '/top-events', async (request, reply) => {
      const { from, to, limit = '10' } = request.query;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { status: 'paid' };
      if (from || to) {
        where.paidAt = {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        };
      }

      const orders = await prisma.order.findMany({
        where,
        select: { eventId: true, total: true, platformFeeAmount: true, event: { select: { name: true, slug: true } }, tenant: { select: { name: true } } },
      });

      const events: Record<string, { eventId: string; name: string; slug: string; merchantName: string; grossVolume: number; platformFees: number; orderCount: number }> = {};
      for (const o of orders) {
        if (!events[o.eventId]) {
          events[o.eventId] = { eventId: o.eventId, name: o.event.name, slug: o.event.slug, merchantName: o.tenant.name, grossVolume: 0, platformFees: 0, orderCount: 0 };
        }
        events[o.eventId].grossVolume  += Number(o.total);
        events[o.eventId].platformFees += Number(o.platformFeeAmount ?? 0);
        events[o.eventId].orderCount++;
      }

      const sorted = Object.values(events)
        .sort((a, b) => b.grossVolume - a.grossVolume)
        .slice(0, Math.min(50, parseInt(limit)));

      return reply.send({ data: sorted });
    },
  );
}
