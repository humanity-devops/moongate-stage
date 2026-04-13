import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireAuth } from '../../plugins/auth.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';

export async function organizerNotificationRoutes(fastify: FastifyInstance) {
  // GET /api/organizer/notifications
  fastify.get('/notifications', async (request, reply) => {
    const user = await requireAuth(request);
    const query = request.query as { page?: string; pageSize?: string; unreadOnly?: string };

    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      userId: user.userId,
      tenantId: user.tenantId ?? null,
    };
    if (query.unreadOnly === 'true') where.readAt = null;

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: user.userId, tenantId: user.tenantId ?? null, readAt: null } }),
    ]);

    return reply.send({ data, total, unreadCount });
  });

  // PATCH /api/organizer/notifications/read-all  (must be before /:id/read)
  fastify.patch('/notifications/read-all', async (request, reply) => {
    const user = await requireAuth(request);

    await prisma.notification.updateMany({
      where: { userId: user.userId, tenantId: user.tenantId ?? null, readAt: null },
      data: { readAt: new Date() },
    });

    return reply.send({ ok: true });
  });

  // GET /api/organizer/notifications/unread-count
  fastify.get('/notifications/unread-count', async (request, reply) => {
    const user = await requireAuth(request);

    const count = await prisma.notification.count({
      where: { userId: user.userId, tenantId: user.tenantId ?? null, readAt: null },
    });

    return reply.send({ count });
  });

  // PATCH /api/organizer/notifications/:id/read
  fastify.patch<{ Params: { id: string } }>('/notifications/:id/read', async (request, reply) => {
    const user = await requireAuth(request);
    const { id } = request.params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundError('Notification', id);
    if (notification.userId !== user.userId) throw new ForbiddenError('Access denied');

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return reply.send({ data: updated });
  });
}
