import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';

export async function organizerProposalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
    await requirePermission('manage_bids')(request);
  });

  // GET /api/organizer/proposals?eventId=&status=&page=&pageSize=
  fastify.get<{
    Querystring: {
      eventId?: string;
      status?: string;
      search?: string;
      page?: string;
      pageSize?: string;
    };
  }>('/', async (request, reply) => {
    const user = request.user!;
    const { eventId, status, search, page = '1', pageSize = '20' } = request.query;

    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (eventId) where.eventId = eventId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const [total, proposals] = await Promise.all([
      prisma.proposal.count({ where: whereClause }),
      prisma.proposal.findMany({
        where: whereClause,
        include: {
          event: { select: { name: true, slug: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * size,
        take: size,
      }),
    ]);

    return reply.send({ data: proposals, total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) });
  });

  // GET /api/organizer/proposals/:proposalId
  fastify.get<{ Params: { proposalId: string } }>('/:proposalId', async (request, reply) => {
    const user = request.user!;
    const proposal = await prisma.proposal.findFirst({
      where: { id: request.params.proposalId, tenantId: user.tenantId },
      include: {
        event: { select: { id: true, name: true, slug: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!proposal) throw new NotFoundError('Proposal', request.params.proposalId);
    return reply.send({ data: proposal });
  });

  // PATCH /api/organizer/proposals/:proposalId/review
  fastify.patch<{ Params: { proposalId: string }; Body: unknown }>(
    '/:proposalId/review',
    async (request, reply) => {
      const user = request.user!;

      const schema = z.object({
        status: z.enum(['accepted', 'rejected', 'under_review']),
        rejectedReason: z.string().max(1000).optional(),
      });
      const data = schema.parse(request.body);

      const proposal = await prisma.proposal.findFirst({
        where: { id: request.params.proposalId, tenantId: user.tenantId },
      });
      if (!proposal) throw new NotFoundError('Proposal', request.params.proposalId);

      const updated = await prisma.proposal.update({
        where: { id: proposal.id },
        data: {
          status: data.status,
          reviewedById: user.userId,
          reviewedAt: new Date(),
          rejectedReason: data.status === 'rejected' ? data.rejectedReason : null,
        },
        include: { items: true },
      });

      logAudit({
        tenantId: user.tenantId,
        userId: user.userId,
        action: data.status,
        resource: 'proposal',
        resourceId: proposal.id,
        before: { status: proposal.status },
        after: { status: data.status },
      });

      return reply.send({ data: updated });
    },
  );
}
