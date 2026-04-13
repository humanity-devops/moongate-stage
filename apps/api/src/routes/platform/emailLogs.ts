import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requirePlatformRole } from '../../plugins/auth.js';

export async function platformEmailLogRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requirePlatformRole(request);
  });

  fastify.get<{
    Querystring: { status?: string; template?: string; page?: string; pageSize?: string };
  }>('/', async (request, reply) => {
    const { status, template, page = '1', pageSize = '50' } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (template) where.template = template;

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(pageSize),
      }),
      prisma.emailLog.count({ where }),
    ]);

    return reply.send({ data: logs, total });
  });
}
