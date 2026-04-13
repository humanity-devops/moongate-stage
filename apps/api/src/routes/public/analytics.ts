import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { trackEvent } from '../../lib/analytics.js';

export async function publicAnalyticsRoutes(fastify: FastifyInstance) {
  // POST /api/analytics/track
  // Fire-and-forget, no auth required
  fastify.post<{ Body: unknown }>('/track', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const schema = z.object({
      eventType: z.enum(['page_viewed', 'package_viewed', 'deck_viewed', 'cta_click', 'auth_redirect', 'bid_milestone']),
      tenantId: z.string().optional(),
      sessionId: z.string().optional(),
      resourceId: z.string().optional(),
      resourceType: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const result = schema.safeParse(request.body);
    if (!result.success) {
      return reply.status(204).send(); // silently ignore malformed tracking
    }

    const { eventType, tenantId, sessionId, resourceId, resourceType, metadata } = result.data;

    trackEvent({
      eventType,
      tenantId,
      sessionId,
      resourceId,
      resourceType,
      metadata,
      request,
    });

    return reply.status(204).send();
  });
}
