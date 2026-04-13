import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireAuth } from '../../plugins/auth.js';

export async function organizerAuditLogRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // GET /api/organizer/audit-logs
  fastify.get<{
    Querystring: {
      action?: string;
      resource?: string;
      resourceId?: string;
      userId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: string;
      pageSize?: string;
    };
  }>('/', async (request, reply) => {
    const user = request.user!;
    const { action, resource, resourceId, userId, dateFrom, dateTo, page = '1', pageSize = '50' } = request.query;

    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where: where as Parameters<typeof prisma.auditLog.count>[0]['where'] }),
      prisma.auditLog.findMany({
        where: where as Parameters<typeof prisma.auditLog.findMany>[0]['where'],
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * size,
        take: size,
        select: {
          id: true,
          userId: true,
          action: true,
          resource: true,
          resourceId: true,
          before: true,
          after: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
    ]);

    return reply.send({
      data: logs,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  });
}
