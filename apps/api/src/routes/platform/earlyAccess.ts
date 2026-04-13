import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requirePlatformRole } from '../../plugins/auth.js';
import { NotFoundError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';

const INTERNAL_STATUSES = ['new', 'reviewed', 'contacted', 'archived'] as const;
type InternalStatus = typeof INTERNAL_STATUSES[number];

export async function platformEarlyAccessRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requirePlatformRole(request);
  });

  // GET /api/platform/early-access
  fastify.get<{
    Querystring: {
      search?: string;
      status?: string;          // public status: waitlisted | invited | onboarded
      internalStatus?: string;  // admin status: new | reviewed | contacted | archived
      role?: string;
      utmSource?: string;
      dateFrom?: string;
      dateTo?: string;
      sort?: string;            // createdAt | email | name | status
      order?: string;           // asc | desc
      page?: string;
      pageSize?: string;
    };
  }>('/', async (request, reply) => {
    const {
      search, status, internalStatus, role, utmSource,
      dateFrom, dateTo,
      sort = 'createdAt', order = 'desc',
      page = '1', pageSize = '50',
    } = request.query;

    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(200, Math.max(1, parseInt(pageSize)));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;
    if (internalStatus) where.internalStatus = internalStatus;
    if (role) where.role = role;
    if (utmSource) where.utmSource = utmSource;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
        { company: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const validSortFields: Record<string, string> = {
      createdAt: 'createdAt',
      email: 'email',
      name: 'name',
      status: 'status',
      internalStatus: 'internalStatus',
    };
    const sortField = validSortFields[sort] ?? 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const [total, members] = await Promise.all([
      prisma.earlyAccessMember.count({ where }),
      prisma.earlyAccessMember.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: (pageNum - 1) * size,
        take: size,
        select: {
          id: true,
          email: true,
          name: true,
          company: true,
          role: true,
          referrer: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          status: true,
          internalStatus: true,
          reviewedBy: true,
          reviewedAt: true,
          invitedAt: true,
          onboardedAt: true,
          createdAt: true,
          updatedAt: true,
          // Exclude adminNotes from list for brevity
        },
      }),
    ]);

    return reply.send({
      data: members,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  });

  // GET /api/platform/early-access/export  (must come before /:id)
  fastify.get('/export', async (request, reply) => {
    const user = request.user!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = request.query as any;

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.internalStatus) where.internalStatus = query.internalStatus;
    if (query.role) where.role = query.role;
    if (query.search?.trim()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (where as any).OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { email: { contains: query.search.trim(), mode: 'insensitive' } },
        { company: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const members = await prisma.earlyAccessMember.findMany({
      where: where as Parameters<typeof prisma.earlyAccessMember.findMany>[0]['where'],
      orderBy: { createdAt: 'desc' },
      take: 5000, // safety cap
    });

    const headers = [
      'id', 'email', 'name', 'company', 'role', 'referrer',
      'utmSource', 'utmMedium', 'utmCampaign',
      'status', 'internalStatus', 'adminNotes',
      'invitedAt', 'onboardedAt', 'createdAt',
    ];

    const escape = (v: unknown) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    const rows = [
      headers.join(','),
      ...members.map(m =>
        headers.map(h => escape(m[h as keyof typeof m])).join(',')
      ),
    ].join('\n');

    logAudit({
      tenantId: null,
      userId: user.userId,
      action: 'export_csv',
      resource: 'early_access_member',
      after: { count: members.length, filters: query },
    });

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="early-access-${Date.now()}.csv"`)
      .send(rows);
  });

  // GET /api/platform/early-access/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const member = await prisma.earlyAccessMember.findUnique({
      where: { id: request.params.id },
    });
    if (!member) throw new NotFoundError('EarlyAccessMember', request.params.id);
    return reply.send({ data: member });
  });

  // PATCH /api/platform/early-access/:id
  fastify.patch<{ Params: { id: string }; Body: unknown }>(
    '/:id',
    async (request, reply) => {
      const user = request.user!;

      const schema = z.object({
        internalStatus: z.enum(INTERNAL_STATUSES).optional(),
        adminNotes: z.string().max(5000).optional(),
        // Allow promoting the public status to invited
        status: z.enum(['waitlisted', 'invited', 'onboarded']).optional(),
      });
      const data = schema.parse(request.body);

      const member = await prisma.earlyAccessMember.findUnique({
        where: { id: request.params.id },
      });
      if (!member) throw new NotFoundError('EarlyAccessMember', request.params.id);

      const updated = await prisma.earlyAccessMember.update({
        where: { id: member.id },
        data: {
          ...(data.internalStatus ? { internalStatus: data.internalStatus } : {}),
          ...(data.adminNotes !== undefined ? { adminNotes: data.adminNotes } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(data.internalStatus && data.internalStatus !== member.internalStatus
            ? { reviewedBy: user.userId, reviewedAt: new Date() }
            : {}),
        },
      });

      logAudit({
        tenantId: null,
        userId: user.userId,
        action: 'updated',
        resource: 'early_access_member',
        resourceId: member.id,
        before: { internalStatus: member.internalStatus, status: member.status },
        after: { internalStatus: updated.internalStatus, status: updated.status },
      });

      return reply.send({ data: updated });
    },
  );

  // POST /api/platform/early-access/bulk
  fastify.post<{ Body: unknown }>('/bulk', async (request, reply) => {
    const user = request.user!;

    const schema = z.object({
      ids: z.array(z.string()).min(1).max(500),
      action: z.enum(['mark_reviewed', 'mark_contacted', 'archive']),
    });
    const { ids, action } = schema.parse(request.body);

    const statusMap: Record<string, InternalStatus> = {
      mark_reviewed: 'reviewed',
      mark_contacted: 'contacted',
      archive: 'archived',
    };
    const newStatus = statusMap[action];

    const result = await prisma.earlyAccessMember.updateMany({
      where: { id: { in: ids } },
      data: {
        internalStatus: newStatus,
        reviewedBy: user.userId,
        reviewedAt: new Date(),
      },
    });

    logAudit({
      tenantId: null,
      userId: user.userId,
      action: `bulk_${action}`,
      resource: 'early_access_member',
      after: { ids, count: result.count },
    });

    return reply.send({ data: { updated: result.count } });
  });
}
