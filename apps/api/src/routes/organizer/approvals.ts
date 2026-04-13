import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';

export async function organizerApprovalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  fastify.get<{
    Querystring: { approvalStatus?: string; status?: string; page?: string; pageSize?: string };
  }>('/', async (request, reply) => {
    const user = request.user!;
    const { approvalStatus, status, page = '1', pageSize = '50' } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId: user.tenantId };
    where.approvalStatus = approvalStatus ?? 'pending';
    if (status) where.status = status;

    const [total, campaigns] = await Promise.all([
      prisma.crowdfundCampaign.count({ where }),
      prisma.crowdfundCampaign.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (pageNum - 1) * size,
        take: size,
        include: {
          event: { select: { id: true, name: true, slug: true } },
          item: { select: { id: true, publicTitle: true, listPrice: true, currency: true } },
          contributions: { select: { amount: true } },
        },
      }),
    ]);

    return reply.send({ data: campaigns, total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) });
  });

  fastify.post<{ Params: { campaignId: string }; Body: unknown }>('/:campaignId/decide', async (request, reply) => {
    await requirePermission('approve_fundraising')(request);
    const user = request.user!;

    const schema = z.object({
      decision: z.enum(['approved', 'rejected', 'needs_changes']),
      reason: z.string().max(2000).optional(),
    });
    const { decision, reason } = schema.parse(request.body);
    if (decision === 'rejected' && !reason?.trim()) throw new ValidationError('A reason is required when rejecting');

    const campaign = await prisma.crowdfundCampaign.findFirst({ where: { id: request.params.campaignId, tenantId: user.tenantId } });
    if (!campaign) throw new NotFoundError('Campaign', request.params.campaignId);

    const updated = await prisma.crowdfundCampaign.update({
      where: { id: campaign.id },
      data: {
        approvalStatus: decision === 'needs_changes' ? 'pending' : decision,
        approvedBy: user.userId,
        approvedAt: new Date(),
        rejectionReason: reason ?? null,
      },
    });

    logAudit({ tenantId: user.tenantId, userId: user.userId, action: `campaign_${decision}`, resource: 'crowdfund_campaign', resourceId: campaign.id, before: { approvalStatus: campaign.approvalStatus }, after: { approvalStatus: updated.approvalStatus, reason }, request });
    return reply.send({ data: updated });
  });
}
