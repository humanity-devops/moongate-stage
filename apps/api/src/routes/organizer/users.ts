import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';

export async function organizerUserRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  fastify.get<{
    Querystring: { search?: string; role?: string; status?: string; page?: string; pageSize?: string };
  }>('/', async (request, reply) => {
    await requirePermission('view_user_profiles')(request);
    const user = request.user!;
    const { search, role, page = '1', pageSize = '50' } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId: user.tenantId };
    if (role) where.role = role;

    const [total, memberships] = await Promise.all([
      prisma.membership.count({ where }),
      prisma.membership.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true, avatarUrl: true, lastLoginAt: true, createdAt: true, profile: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * size,
        take: size,
      }),
    ]);

    const filtered = search?.trim()
      ? memberships.filter(m =>
          m.user.email.toLowerCase().includes(search.toLowerCase()) ||
          (m.user.name?.toLowerCase().includes(search.toLowerCase()) ?? false)
        )
      : memberships;

    return reply.send({
      data: filtered.map(m => ({ membershipId: m.id, role: m.role, status: m.status, isActive: m.isActive, joinedAt: m.joinedAt, createdAt: m.createdAt, user: m.user })),
      total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size),
    });
  });

  fastify.get<{ Params: { userId: string } }>('/:userId', async (request, reply) => {
    await requirePermission('view_user_profiles')(request);
    const user = request.user!;

    const membership = await prisma.membership.findFirst({
      where: { userId: request.params.userId, tenantId: user.tenantId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, lastLoginAt: true, createdAt: true, profile: true } } },
    });
    if (!membership) throw new NotFoundError('User', request.params.userId);

    const history = await prisma.membershipEvent.findMany({
      where: { tenantId: user.tenantId, userId: request.params.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return reply.send({ data: { membershipId: membership.id, role: membership.role, status: membership.status, isActive: membership.isActive, joinedAt: membership.joinedAt, createdAt: membership.createdAt, user: membership.user, history } });
  });

  fastify.patch<{ Params: { userId: string }; Body: unknown }>('/:userId/profile', async (request, reply) => {
    await requirePermission('edit_user_profiles')(request);
    const actor = request.user!;

    const schema = z.object({
      bio: z.string().max(1000).optional(),
      phone: z.string().max(30).optional(),
      telegram: z.string().max(100).optional(),
      twitter: z.string().max(100).optional(),
      linkedin: z.string().max(200).optional(),
      website: z.string().url().optional().or(z.literal('')),
      company: z.string().max(200).optional(),
      jobTitle: z.string().max(200).optional(),
      location: z.string().max(200).optional(),
      timezone: z.string().max(50).optional(),
      segment: z.enum(['investor', 'builder', 'protocol', 'enterprise', 'community']).optional(),
      tags: z.array(z.string()).max(20).optional(),
    });
    const data = schema.parse(request.body);

    const membership = await prisma.membership.findFirst({ where: { userId: request.params.userId, tenantId: actor.tenantId } });
    if (!membership) throw new NotFoundError('User', request.params.userId);

    const profile = await prisma.userProfile.upsert({
      where: { userId: request.params.userId },
      update: data,
      create: { userId: request.params.userId, tenantId: actor.tenantId!, ...data },
    });

    logAudit({ tenantId: actor.tenantId, userId: actor.userId, action: 'profile_updated', resource: 'user_profile', resourceId: profile.id, after: data, request });
    return reply.send({ data: profile });
  });

  fastify.patch<{ Params: { userId: string }; Body: unknown }>('/:userId/membership', async (request, reply) => {
    await requirePermission('manage_roles')(request);
    const actor = request.user!;

    const schema = z.object({
      role: z.string().optional(),
      status: z.enum(['active', 'invited', 'suspended', 'deactivated']).optional(),
      isActive: z.boolean().optional(),
      notes: z.string().max(500).optional(),
    });
    const data = schema.parse(request.body);

    const membership = await prisma.membership.findFirst({ where: { userId: request.params.userId, tenantId: actor.tenantId } });
    if (!membership) throw new NotFoundError('User', request.params.userId);

    const before = { role: membership.role, status: membership.status, isActive: membership.isActive };
    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: {
        ...(data.role ? { role: data.role } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    if (data.role && data.role !== membership.role) {
      await prisma.membershipEvent.create({ data: { tenantId: actor.tenantId!, userId: request.params.userId, actorId: actor.userId, event: 'role_changed', fromRole: membership.role, toRole: data.role, notes: data.notes } });
    }
    if (data.status && data.status !== membership.status) {
      const evtName = data.status === 'deactivated' ? 'deactivated' : data.status === 'suspended' ? 'suspended' : 'activated';
      await prisma.membershipEvent.create({ data: { tenantId: actor.tenantId!, userId: request.params.userId, actorId: actor.userId, event: evtName, fromStatus: membership.status, toStatus: data.status, notes: data.notes } });
    }

    logAudit({ tenantId: actor.tenantId, userId: actor.userId, action: 'membership_updated', resource: 'membership', resourceId: membership.id, before, after: { role: updated.role, status: updated.status, isActive: updated.isActive }, request });
    return reply.send({ data: updated });
  });
}
