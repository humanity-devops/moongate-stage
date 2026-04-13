import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireSponsorAuth } from '../../plugins/auth.js';
import { trackEvent } from '../../lib/analytics.js';

export async function sponsorDealMemberRoutes(fastify: FastifyInstance) {
  // GET /api/sponsor/deals/:bidId/members
  fastify.get<{ Params: { bidId: string } }>('/deals/:bidId/members', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { bidId } = request.params;

    // Verify bid belongs to this sponsor (by email match)
    const bid = await prisma.bid.findFirst({
      where: { id: bidId, email: user.email },
    });
    if (!bid) return reply.status(404).send({ error: 'Not found' });

    const members = await prisma.dealMember.findMany({
      where: { bidId },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send({ data: members });
  });

  // POST /api/sponsor/deals/:bidId/members — add a team member
  fastify.post<{ Params: { bidId: string }; Body: { email: string; role?: string } }>(
    '/deals/:bidId/members',
    async (request, reply) => {
      const user = await requireSponsorAuth(request);
      const { bidId } = request.params;
      const { email, role = 'collaborator' } = request.body;

      // Only owners can add members
      const bid = await prisma.bid.findFirst({
        where: { id: bidId, email: user.email },
      });
      if (!bid) return reply.status(404).send({ error: 'Not found' });

      if (!['owner', 'collaborator', 'viewer'].includes(role)) {
        return reply.status(400).send({ error: 'Invalid role' });
      }

      // Check for duplicate
      const existing = await prisma.dealMember.findFirst({ where: { bidId, userId: email } });
      if (existing) return reply.status(409).send({ error: 'Already a member' });

      const member = await prisma.dealMember.create({
        data: { bidId, userId: email, role, addedById: user.email },
      });

      trackEvent({ eventType: 'deal_member_added', metadata: { bidId, email, role } });

      return reply.status(201).send({ data: member });
    }
  );

  // DELETE /api/sponsor/deals/:bidId/members/:userId — remove a team member
  fastify.delete<{ Params: { bidId: string; userId: string } }>(
    '/deals/:bidId/members/:userId',
    async (request, reply) => {
      const user = await requireSponsorAuth(request);
      const { bidId, userId } = request.params;

      const bid = await prisma.bid.findFirst({
        where: { id: bidId, email: user.email },
      });
      if (!bid) return reply.status(404).send({ error: 'Not found' });

      await prisma.dealMember.deleteMany({ where: { bidId, userId } });

      trackEvent({ eventType: 'deal_member_removed', metadata: { bidId, userId } });

      return reply.send({ ok: true });
    }
  );

  // PATCH /api/sponsor/deals/:bidId/members/:userId — update role
  fastify.patch<{ Params: { bidId: string; userId: string }; Body: { role: string } }>(
    '/deals/:bidId/members/:userId',
    async (request, reply) => {
      const user = await requireSponsorAuth(request);
      const { bidId, userId } = request.params;
      const { role } = request.body;

      const bid = await prisma.bid.findFirst({
        where: { id: bidId, email: user.email },
      });
      if (!bid) return reply.status(404).send({ error: 'Not found' });

      if (!['owner', 'collaborator', 'viewer'].includes(role)) {
        return reply.status(400).send({ error: 'Invalid role' });
      }

      await prisma.dealMember.updateMany({
        where: { bidId, userId },
        data: { role },
      });

      return reply.send({ ok: true });
    }
  );
}
