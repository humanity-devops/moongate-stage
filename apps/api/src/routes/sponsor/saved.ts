import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireSponsorAuth } from '../../plugins/auth.js';
import { NotFoundError } from '../../lib/errors.js';

export async function sponsorSavedRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const saved = await prisma.savedItem.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ data: saved });
  });

  fastify.post('/', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { entityType, entityId } = request.body as { entityType: string; entityId: string };

    if (!['event', 'item'].includes(entityType)) {
      return reply.status(400).send({ error: 'entityType must be event or item' });
    }

    const saved = await prisma.savedItem.upsert({
      where: { userId_entityType_entityId: { userId: user.userId, entityType, entityId } },
      create: { userId: user.userId, entityType, entityId },
      update: {},
    });

    return reply.status(201).send({ data: saved });
  });

  fastify.delete('/:id', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { id } = request.params as { id: string };

    const saved = await prisma.savedItem.findUnique({ where: { id } });
    if (!saved || saved.userId !== user.userId) throw new NotFoundError('Saved item not found');

    await prisma.savedItem.delete({ where: { id } });

    return reply.send({ data: { ok: true } });
  });

  // Convenience: unsave by entityType+entityId
  fastify.delete('/by-entity/:entityType/:entityId', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { entityType, entityId } = request.params as { entityType: string; entityId: string };

    await prisma.savedItem.deleteMany({
      where: { userId: user.userId, entityType, entityId },
    });

    return reply.send({ data: { ok: true } });
  });
}
