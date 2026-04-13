import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';

export async function organizerPackageTemplateRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  fastify.get('/', async (request, reply) => {
    const user = request.user!;
    const templates = await prisma.packageTemplate.findMany({ where: { tenantId: user.tenantId!, isActive: true }, orderBy: { createdAt: 'desc' } });
    return reply.send({ data: templates });
  });

  fastify.post<{ Body: unknown }>('/', async (request, reply) => {
    await requirePermission('manage_inventory')(request);
    const user = request.user!;
    const schema = z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(500).optional(),
      items: z.array(z.record(z.unknown())).min(1),
    });
    const data = schema.parse(request.body);
    const template = await prisma.packageTemplate.create({ data: { tenantId: user.tenantId!, name: data.name, description: data.description, items: data.items as object, createdBy: user.userId } });
    logAudit({ tenantId: user.tenantId, userId: user.userId, action: 'created', resource: 'package_template', resourceId: template.id, after: { name: data.name }, request });
    return reply.status(201).send({ data: template });
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    await requirePermission('manage_inventory')(request);
    const user = request.user!;
    const template = await prisma.packageTemplate.findFirst({ where: { id: request.params.id, tenantId: user.tenantId } });
    if (!template) throw new NotFoundError('PackageTemplate', request.params.id);
    await prisma.packageTemplate.update({ where: { id: template.id }, data: { isActive: false } });
    logAudit({ tenantId: user.tenantId, userId: user.userId, action: 'archived', resource: 'package_template', resourceId: template.id, request });
    return reply.send({ data: { message: 'Template archived' } });
  });
}
