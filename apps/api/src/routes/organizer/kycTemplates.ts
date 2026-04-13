import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { requireAuth } from '../../plugins/auth.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';
import { trackEvent } from '../../lib/analytics.js';
import { env } from '../../lib/env.js';

const FieldDefSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text', 'textarea', 'file', 'select', 'checkbox']),
  label: z.string().min(1).max(200),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  helperNote: z.string().max(500).optional(),
  exampleImageUrl: z.string().url().optional(),
});

export async function kycTemplateRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // GET /api/organizer/kyc-templates
  fastify.get('/', async (request, reply) => {
    const user = request.user!;

    const templates = await prisma.kycFormTemplate.findMany({
      where: { tenantId: user.tenantId! },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ data: templates });
  });

  // POST /api/organizer/kyc-templates
  fastify.post<{ Body: unknown }>('/', async (request, reply) => {
    const user = request.user!;

    const schema = z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      fields: z.array(FieldDefSchema).min(1, 'At least one field is required'),
    });

    const result = schema.safeParse(request.body);
    if (!result.success) throw new ValidationError('Invalid template data', result.error.format());
    const { name, description, fields } = result.data;

    const template = await prisma.kycFormTemplate.create({
      data: {
        tenantId: user.tenantId!,
        name,
        description: description ?? null,
        fields: fields as object,
        isActive: true,
        createdBy: user.userId,
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'kyc_template_created',
      resource: 'kyc_form_template',
      resourceId: template.id,
      after: { name, fieldCount: fields.length },
      request,
    });

    return reply.status(201).send({ data: template });
  });

  // PATCH /api/organizer/kyc-templates/:id
  fastify.patch<{ Params: { id: string }; Body: unknown }>('/:id', async (request, reply) => {
    const user = request.user!;

    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
      fields: z.array(FieldDefSchema).min(1).optional(),
      isActive: z.boolean().optional(),
    });

    const result = schema.safeParse(request.body);
    if (!result.success) throw new ValidationError('Invalid update data', result.error.format());
    const body = result.data;

    const template = await prisma.kycFormTemplate.findFirst({
      where: { id: request.params.id, tenantId: user.tenantId! },
    });
    if (!template) throw new NotFoundError('KYC Form Template', request.params.id);

    const updated = await prisma.kycFormTemplate.update({
      where: { id: template.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.fields !== undefined && { fields: body.fields as object }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'kyc_template_updated',
      resource: 'kyc_form_template',
      resourceId: template.id,
      after: body,
      request,
    });

    return reply.send({ data: updated });
  });

  // DELETE /api/organizer/kyc-templates/:id (soft delete)
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const user = request.user!;

    const template = await prisma.kycFormTemplate.findFirst({
      where: { id: request.params.id, tenantId: user.tenantId! },
    });
    if (!template) throw new NotFoundError('KYC Form Template', request.params.id);

    await prisma.kycFormTemplate.update({
      where: { id: template.id },
      data: { isActive: false },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'kyc_template_deleted',
      resource: 'kyc_form_template',
      resourceId: template.id,
      request,
    });

    return reply.send({ data: { success: true } });
  });

  // POST /api/organizer/kyc-templates/:id/send
  fastify.post<{ Params: { id: string }; Body: unknown }>('/:id/send', async (request, reply) => {
    const user = request.user!;

    const schema = z.object({
      bidId: z.string().min(1),
      sentToEmail: z.string().email(),
      sentToName: z.string().max(200).optional(),
    });

    const result = schema.safeParse(request.body);
    if (!result.success) throw new ValidationError('Invalid send data', result.error.format());
    const { bidId, sentToEmail, sentToName } = result.data;

    const template = await prisma.kycFormTemplate.findFirst({
      where: { id: request.params.id, tenantId: user.tenantId!, isActive: true },
    });
    if (!template) throw new NotFoundError('KYC Form Template', request.params.id);

    const token = randomBytes(32).toString('hex');

    const formRequest = await prisma.kycFormRequest.create({
      data: {
        tenantId: user.tenantId!,
        templateId: template.id,
        bidId,
        sentToEmail,
        sentToName: sentToName ?? null,
        token,
        status: 'pending',
      },
    });

    const shareUrl = `${env.APP_URL}/kyc-form/${token}`;

    trackEvent({
      eventType: 'kyc_form_sent',
      tenantId: user.tenantId,
      userId: user.userId,
      resourceId: formRequest.id,
      resourceType: 'kyc_form_request',
      metadata: { templateId: template.id, bidId, sentToEmail },
      request,
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'kyc_form_sent',
      resource: 'kyc_form_request',
      resourceId: formRequest.id,
      after: { templateId: template.id, bidId, sentToEmail },
      request,
    });

    return reply.status(201).send({
      data: { requestId: formRequest.id, token, shareUrl },
    });
  });
}
