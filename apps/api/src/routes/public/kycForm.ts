import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { trackEvent } from '../../lib/analytics.js';

export async function publicKycFormRoutes(fastify: FastifyInstance) {
  // GET /api/public/kyc-form/:token
  fastify.get<{ Params: { token: string } }>('/kyc-form/:token', async (request, reply) => {
    const formRequest = await prisma.kycFormRequest.findUnique({
      where: { token: request.params.token },
      include: {
        template: { select: { name: true, fields: true } },
      },
    });

    if (!formRequest || formRequest.status !== 'pending') {
      throw new NotFoundError('KYC Form Request', request.params.token);
    }

    return reply.send({
      data: {
        template: {
          name: formRequest.template.name,
          fields: formRequest.template.fields,
        },
        request: {
          sentToEmail: formRequest.sentToEmail,
          sentToName: formRequest.sentToName,
          status: formRequest.status,
          bidId: formRequest.bidId,
        },
      },
    });
  });

  // POST /api/public/kyc-form/:token
  fastify.post<{ Params: { token: string }; Body: unknown }>(
    '/kyc-form/:token',
    {
      config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    },
    async (request, reply) => {
      const schema = z.object({
        response: z.record(z.unknown()),
      });

      const result = schema.safeParse(request.body);
      if (!result.success) throw new ValidationError('Invalid form response', result.error.format());
      const { response } = result.data;

      const formRequest = await prisma.kycFormRequest.findUnique({
        where: { token: request.params.token },
      });

      if (!formRequest || formRequest.status !== 'pending') {
        throw new NotFoundError('KYC Form Request', request.params.token);
      }

      await prisma.kycFormRequest.update({
        where: { id: formRequest.id },
        data: {
          status: 'submitted',
          response: response as object,
          submittedAt: new Date(),
        },
      });

      // Create audit entry on linked KycSubmission if present
      if (formRequest.submissionId) {
        await prisma.kycAuditEntry.create({
          data: {
            submissionId: formRequest.submissionId,
            action: 'form_submitted',
            actorId: null,
            actorName: formRequest.sentToEmail,
            metadata: { formRequestId: formRequest.id, templateId: formRequest.templateId },
          },
        }).catch(() => { /* non-critical */ });
      }

      trackEvent({
        eventType: 'kyc_form_submitted',
        tenantId: formRequest.tenantId,
        resourceId: formRequest.id,
        resourceType: 'kyc_form_request',
        metadata: { templateId: formRequest.templateId, bidId: formRequest.bidId },
        request,
      });

      return reply.send({ data: { success: true } });
    },
  );
}
