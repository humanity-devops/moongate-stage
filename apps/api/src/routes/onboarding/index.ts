import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireSponsorAuth } from '../../plugins/auth.js';
import { provisionTenant, validateSlug } from '../../lib/provisioning.js';
import { ValidationError, ConflictError } from '../../lib/errors.js';
import { trackEvent } from '../../lib/analytics.js';

export async function onboardingRoutes(fastify: FastifyInstance) {
  // GET /api/onboarding/check-slug?slug=xxx
  fastify.get<{ Querystring: { slug: string } }>('/check-slug', async (request, reply) => {
    const { slug } = request.query;
    const validation = validateSlug(slug ?? '');
    if (!validation.valid) {
      return reply.send({ data: { available: false, error: validation.error } });
    }
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    return reply.send({ data: { available: !existing } });
  });

  // POST /api/onboarding/provision
  fastify.post<{ Body: unknown }>('/provision', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const schema = z.object({
      tenantName: z.string().min(2).max(100),
      tenantSlug: z.string().min(3).max(40),
      currency: z.enum(['USD', 'EUR', 'GBP', 'SGD', 'AUD']).default('USD'),
      timezone: z.string().default('UTC'),
    });

    const result = schema.safeParse(request.body);
    if (!result.success) throw new ValidationError('Invalid data', result.error.format());
    const data = result.data;

    // Check user doesn't already own a tenant
    const existingMembership = await prisma.membership.findFirst({
      where: { userId: user.userId, role: 'organizer_owner', isActive: true },
    });
    if (existingMembership) {
      throw new ConflictError(
        'You already have an organization. Contact support to create additional organizations.',
      );
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });

    trackEvent({
      eventType: 'merchant_onboarding_started',
      userId: user.userId,
      metadata: { slug: data.tenantSlug },
      request,
    });

    const { tenantId, tenantSlug } = await provisionTenant({
      userId: user.userId,
      userEmail: user.email,
      userName: dbUser?.name ?? user.email,
      tenantName: data.tenantName,
      tenantSlug: data.tenantSlug,
      currency: data.currency,
      timezone: data.timezone,
    });

    trackEvent({
      eventType: 'tenant_created',
      userId: user.userId,
      tenantId,
      metadata: { slug: tenantSlug },
      request,
    });

    return reply.status(201).send({
      data: {
        tenantId,
        tenantSlug,
        adminUrl: `/admin/${tenantSlug}/events`,
      },
    });
  });
}
