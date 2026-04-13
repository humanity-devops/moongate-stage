import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireAuth } from '../../plugins/auth.js';

export async function organizerAnalyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // GET /api/organizer/analytics
  // Aggregate analytics events for the tenant
  fastify.get<{
    Querystring: {
      eventType?: string;
      resourceId?: string;
      dateFrom?: string;
      dateTo?: string;
    };
  }>('/', async (request, reply) => {
    const user = request.user!;
    const { eventType, resourceId, dateFrom, dateTo } = request.query;

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (eventType) where.eventType = eventType;
    if (resourceId) where.resourceId = resourceId;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    // Count by event type
    const byType = await prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where: where as Parameters<typeof prisma.analyticsEvent.groupBy>[0]['where'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Count by device
    const byDevice = await prisma.analyticsEvent.groupBy({
      by: ['device'],
      where: where as Parameters<typeof prisma.analyticsEvent.groupBy>[0]['where'],
      _count: { id: true },
    });

    // Count by country (top 10)
    const byCountry = await prisma.analyticsEvent.groupBy({
      by: ['country'],
      where: { ...where as object, country: { not: null } } as Parameters<typeof prisma.analyticsEvent.groupBy>[0]['where'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Count by UTM source (top 10)
    const byUtmSource = await prisma.analyticsEvent.groupBy({
      by: ['utmSource'],
      where: { ...where as object, utmSource: { not: null } } as Parameters<typeof prisma.analyticsEvent.groupBy>[0]['where'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Daily trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEvents = await prisma.analyticsEvent.findMany({
      where: {
        ...where as object,
        createdAt: { gte: thirtyDaysAgo },
      } as Parameters<typeof prisma.analyticsEvent.findMany>[0]['where'],
      select: { createdAt: true, eventType: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dailyCounts: Record<string, number> = {};
    for (const ev of recentEvents) {
      const day = ev.createdAt.toISOString().slice(0, 10);
      dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
    }
    const dailyTrend = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

    const totalEvents = byType.reduce((s, r) => s + r._count.id, 0);

    return reply.send({
      data: {
        totalEvents,
        byType: byType.map(r => ({ eventType: r.eventType, count: r._count.id })),
        byDevice: byDevice.map(r => ({ device: r.device ?? 'unknown', count: r._count.id })),
        byCountry: byCountry.map(r => ({ country: r.country ?? 'unknown', count: r._count.id })),
        byUtmSource: byUtmSource.map(r => ({ source: r.utmSource ?? 'direct', count: r._count.id })),
        dailyTrend,
      },
    });
  });
}
