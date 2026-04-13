import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';

async function requireStaff(request: Parameters<typeof requireAuth>[0]): Promise<void> {
  await requireAuth(request);
  if (request.user?.platformRole !== 'platform_superadmin') {
    throw new ForbiddenError('Staff-only: platform superadmin required');
  }
}

export async function organizerMerchantMembershipRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireStaff);

  fastify.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const { search, status, internalStatus, page = '1', pageSize = '50' } = q;
    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(200, Math.max(1, parseInt(pageSize)));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;
    if (internalStatus) where.internalStatus = internalStatus;
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
        { company: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, members] = await Promise.all([
      prisma.earlyAccessMember.count({ where }),
      prisma.earlyAccessMember.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * size, take: size }),
    ]);

    return reply.send({ data: members, total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) });
  });

  fastify.patch<{ Params: { id: string }; Body: unknown }>('/:id', async (request, reply) => {
    const user = request.user!;
    const schema = z.object({
      internalStatus: z.enum(['new', 'reviewed', 'contacted', 'archived']).optional(),
      adminNotes: z.string().max(5000).optional(),
      status: z.enum(['waitlisted', 'invited', 'onboarded']).optional(),
    });
    const data = schema.parse(request.body);
    const member = await prisma.earlyAccessMember.findUnique({ where: { id: request.params.id } });
    if (!member) throw new NotFoundError('EarlyAccessMember', request.params.id);
    const updated = await prisma.earlyAccessMember.update({
      where: { id: member.id },
      data: {
        ...(data.internalStatus ? { internalStatus: data.internalStatus } : {}),
        ...(data.adminNotes !== undefined ? { adminNotes: data.adminNotes } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.internalStatus && data.internalStatus !== member.internalStatus ? { reviewedBy: user.userId, reviewedAt: new Date() } : {}),
      },
    });
    logAudit({ tenantId: null, userId: user.userId, action: 'membership_early_access_updated', resource: 'early_access_member', resourceId: member.id, before: { internalStatus: member.internalStatus, status: member.status }, after: { internalStatus: updated.internalStatus, status: updated.status }, request });
    return reply.send({ data: updated });
  });

  fastify.post<{ Body: unknown }>('/bulk', async (request, reply) => {
    const user = request.user!;
    const schema = z.object({ ids: z.array(z.string()).min(1).max(500), action: z.enum(['mark_reviewed', 'mark_contacted', 'archive']) });
    const { ids, action } = schema.parse(request.body);
    const statusMap: Record<string, string> = { mark_reviewed: 'reviewed', mark_contacted: 'contacted', archive: 'archived' };
    const result = await prisma.earlyAccessMember.updateMany({ where: { id: { in: ids } }, data: { internalStatus: statusMap[action], reviewedBy: user.userId, reviewedAt: new Date() } });
    logAudit({ tenantId: null, userId: user.userId, action: `bulk_${action}`, resource: 'early_access_member', after: { ids, count: result.count }, request });
    return reply.send({ data: { updated: result.count } });
  });
}
