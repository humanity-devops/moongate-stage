import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { logAudit } from '../../lib/audit.js';

export async function organizerSettingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  fastify.get('/', async (request, reply) => {
    await requirePermission('manage_settings')(request);
    const user = request.user!;
    const [tenant, featureFlags] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: user.tenantId! }, select: { id: true, slug: true, name: true, logoUrl: true, websiteUrl: true, primaryColor: true, accentColor: true, domain: true, timezone: true, currency: true, isActive: true, metadata: true, processingFeeProfile: true } }),
      prisma.featureFlag.findMany({ where: { tenantId: user.tenantId! } }),
    ]);
    return reply.send({ data: { tenant, featureFlags } });
  });

  fastify.patch<{ Body: unknown }>('/', async (request, reply) => {
    await requirePermission('manage_settings')(request);
    const user = request.user!;
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      logoUrl: z.string().url().optional().or(z.literal('')),
      websiteUrl: z.string().url().optional().or(z.literal('')),
      processingFeeProfile: z.enum(['stripe', 'hipay', 'radom']).optional(),
      primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
      accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
      timezone: z.string().optional(),
      currency: z.enum(['USD', 'EUR', 'GBP', 'USDC', 'ETH']).optional(),
    });
    const data = schema.parse(request.body);
    const tenant = await prisma.tenant.update({ where: { id: user.tenantId! }, data, select: { id: true, name: true, logoUrl: true, websiteUrl: true, primaryColor: true, accentColor: true, timezone: true, currency: true, processingFeeProfile: true } });
    logAudit({ tenantId: user.tenantId, userId: user.userId, action: 'tenant_settings_updated', resource: 'tenant', resourceId: user.tenantId, after: data, request });
    return reply.send({ data: tenant });
  });

  fastify.get('/feature-flags', async (request, reply) => {
    await requirePermission('manage_settings')(request);
    const user = request.user!;
    const flags = await prisma.featureFlag.findMany({ where: { tenantId: user.tenantId! } });
    return reply.send({ data: flags });
  });

  fastify.put<{ Params: { key: string }; Body: unknown }>('/feature-flags/:key', async (request, reply) => {
    await requirePermission('manage_settings')(request);
    const user = request.user!;
    const schema = z.object({ enabled: z.boolean(), config: z.record(z.unknown()).optional() });
    const { enabled, config } = schema.parse(request.body);
    const flag = await prisma.featureFlag.upsert({
      where: { tenantId_key: { tenantId: user.tenantId!, key: request.params.key } },
      update: { enabled, config: config as object ?? undefined, updatedBy: user.userId },
      create: { tenantId: user.tenantId!, key: request.params.key, enabled, config: config as object ?? undefined, updatedBy: user.userId },
    });
    logAudit({ tenantId: user.tenantId, userId: user.userId, action: `feature_flag_${enabled ? 'enabled' : 'disabled'}`, resource: 'feature_flag', resourceId: flag.id, after: { key: request.params.key, enabled }, request });
    return reply.send({ data: flag });
  });

  fastify.get('/members', async (request, reply) => {
    await requirePermission('manage_roles')(request);
    const user = request.user!;
    const members = await prisma.membership.findMany({
      where: { tenantId: user.tenantId! },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, lastLoginAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send({ data: members });
  });
}
