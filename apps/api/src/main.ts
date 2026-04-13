import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { env } from './lib/env.js';
import { AppError } from './lib/errors.js';
import { registerAuthPlugin } from './plugins/auth.js';
import { publicEventRoutes } from './routes/public/events.js';
import { publicBidRoutes } from './routes/public/bids.js';
import { publicCheckoutRoutes } from './routes/public/checkout.js';
import { publicCrowdfundRoutes } from './routes/public/crowdfund.js';
import { authRoutes } from './routes/organizer/auth.js';
import { organizerEventRoutes } from './routes/organizer/events.js';
import { organizerItemRoutes } from './routes/organizer/items.js';
import { organizerBidRoutes } from './routes/organizer/bids.js';
import { extractionRoutes } from './routes/organizer/extraction.js';
import { organizerCampaignRoutes } from './routes/organizer/campaigns.js';
import { organizerAccessRoutes, organizerItemAccessRoutes } from './routes/organizer/access.js';
import { organizerAnalyticsRoutes } from './routes/organizer/analytics.js';
import { organizerKycRoutes } from './routes/organizer/kyc.js';
import { kycTemplateRoutes } from './routes/organizer/kycTemplates.js';
import { publicKycFormRoutes } from './routes/public/kycForm.js';
import { organizerAuditLogRoutes } from './routes/organizer/auditlogs.js';
import { publicAnalyticsRoutes } from './routes/public/analytics.js';
import { publicProposalRoutes } from './routes/public/proposals.js';
import { organizerProposalRoutes } from './routes/organizer/proposals.js';
import { organizerOutreachRoutes } from './routes/organizer/outreach.js';
import { publicInviteRoutes } from './routes/public/invites.js';
import { platformEarlyAccessRoutes } from './routes/platform/earlyAccess.js';
import { platformAnalyticsRoutes } from './routes/platform/analytics.js';
import { platformCommissionRoutes } from './routes/platform/commissions.js';
import { platformReferralRoutes } from './routes/platform/referrals.js';
import { organizerOrderRoutes } from './routes/organizer/orders.js';
import { stripeWebhookRoutes } from './routes/webhook/stripe.js';
import { organizerDashboardRoutes } from './routes/organizer/dashboard.js';
import { organizerUserRoutes } from './routes/organizer/users.js';
import { organizerApprovalRoutes } from './routes/organizer/approvals.js';
import { organizerPackageTemplateRoutes } from './routes/organizer/packageTemplates.js';
import { organizerSettingsRoutes } from './routes/organizer/settings.js';
import { organizerMerchantMembershipRoutes } from './routes/organizer/merchantMembership.js';
import { sponsorRoutes } from './routes/sponsor/index.js';
import { sponsorApplyRoutes, sponsorApplicationAdminRoutes } from './routes/public/sponsor-apply.js';
import { onboardingRoutes } from './routes/onboarding/index.js';
import { platformEmailLogRoutes } from './routes/platform/emailLogs.js';
import { sponsorCampaignRoutes } from './routes/sponsor/campaigns.js';
import { sponsorNotificationRoutes } from './routes/sponsor/notifications.js';
import { sponsorConversationRoutes } from './routes/sponsor/conversations.js';
import { sponsorDealMemberRoutes } from './routes/sponsor/dealMembers.js';
import { organizerNotificationRoutes } from './routes/organizer/notifications.js';
import { organizerPayoutRoutes } from './routes/organizer/payouts.js';
import { organizerCustomInvoiceRoutes } from './routes/organizer/customInvoices.js';
import { isQueueAvailable } from './lib/queue.js';

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  trustProxy: true,
});

// --- Plugins ---
await fastify.register(helmet, { global: true });
await fastify.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});
await fastify.register(cors, {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  credentials: true,
});
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
});

// Auth plugin (tenant resolution hook)
registerAuthPlugin(fastify);

// Allow empty JSON bodies (e.g. POST with Content-Type: application/json but no payload)
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  if (body === '') return done(null, null);
  try {
    done(null, JSON.parse(body as string));
  } catch (e) {
    done(e as Error, undefined);
  }
});

// --- Error handler ---
fastify.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }

  // Zod/validation errors
  if (error.validation || error.name === 'ZodError') {
    return reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.message,
    });
  }

  // Fastify framework errors (e.g. body parsing) — use their built-in status code
  if (typeof (error as { statusCode?: number }).statusCode === 'number') {
    return reply.status((error as { statusCode: number }).statusCode).send({
      error: (error as { code?: string }).code ?? 'REQUEST_ERROR',
      message: error.message,
    });
  }

  fastify.log.error(error);
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
});

// --- Health check ---
fastify.get('/health', async () => ({
  status: 'ok',
  version: '0.1.0',
  timestamp: new Date().toISOString(),
  environment: env.NODE_ENV,
}));

// --- Routes ---
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(publicEventRoutes, { prefix: '/api/public' });
await fastify.register(publicBidRoutes, { prefix: '/api/public' });
await fastify.register(publicCheckoutRoutes, { prefix: '/api/public' });
await fastify.register(publicCrowdfundRoutes, { prefix: '/api/public' });
await fastify.register(publicAnalyticsRoutes, { prefix: '/api/analytics' });
await fastify.register(organizerEventRoutes, { prefix: '/api/organizer/events' });

// Nested organizer routes under /api/organizer/events/:eventId
await fastify.register(async (f) => {
  await f.register(organizerItemRoutes, { prefix: '/:eventId/items' });
  await f.register(organizerBidRoutes, { prefix: '/:eventId/bids' });
  await f.register(extractionRoutes, { prefix: '/:eventId/decks' });
  await f.register(organizerCampaignRoutes, { prefix: '/:eventId/campaigns' });
  await f.register(organizerAccessRoutes, { prefix: '/:eventId/access' });
}, { prefix: '/api/organizer/events' });

await fastify.register(organizerAnalyticsRoutes, { prefix: '/api/organizer/analytics' });
await fastify.register(organizerKycRoutes, { prefix: '/api/organizer/kyc' });
await fastify.register(kycTemplateRoutes, { prefix: '/api/organizer/kyc-templates' });
await fastify.register(publicKycFormRoutes, { prefix: '/api/public' });
await fastify.register(organizerAuditLogRoutes, { prefix: '/api/organizer/audit-logs' });
await fastify.register(organizerProposalRoutes, { prefix: '/api/organizer/proposals' });
await fastify.register(organizerOutreachRoutes, { prefix: '/api/organizer/outreach' });
await fastify.register(organizerDashboardRoutes, { prefix: '/api/organizer/dashboard' });
await fastify.register(organizerUserRoutes, { prefix: '/api/organizer/users' });
await fastify.register(organizerApprovalRoutes, { prefix: '/api/organizer/approvals' });
await fastify.register(organizerPackageTemplateRoutes, { prefix: '/api/organizer/package-templates' });
await fastify.register(organizerSettingsRoutes, { prefix: '/api/organizer/settings' });
await fastify.register(organizerItemAccessRoutes, { prefix: '/api/organizer/access/items' });
await fastify.register(organizerMerchantMembershipRoutes, { prefix: '/api/organizer/membership/early-access' });
await fastify.register(publicProposalRoutes, { prefix: '/api/public' });
await fastify.register(publicInviteRoutes, { prefix: '/api/invites' });
await fastify.register(platformEarlyAccessRoutes, { prefix: '/api/platform/early-access' });
await fastify.register(platformAnalyticsRoutes, { prefix: '/api/platform/analytics' });
await fastify.register(platformCommissionRoutes, { prefix: '/api/platform/commissions' });
await fastify.register(platformReferralRoutes, { prefix: '/api/platform/referrals' });
await fastify.register(organizerOrderRoutes, { prefix: '/api/organizer/orders' });
await fastify.register(stripeWebhookRoutes, { prefix: '/api/webhooks' });
await fastify.register(sponsorRoutes, { prefix: '/api/sponsor' });
await fastify.register(sponsorApplyRoutes, { prefix: '/api/public/sponsor' });
await fastify.register(sponsorApplicationAdminRoutes, { prefix: '/api/platform/applications' });
await fastify.register(onboardingRoutes, { prefix: '/api/onboarding' });
await fastify.register(platformEmailLogRoutes, { prefix: '/api/platform/email-logs' });
await fastify.register(sponsorCampaignRoutes, { prefix: '/api/sponsor/campaigns' });
await fastify.register(sponsorNotificationRoutes, { prefix: '/api/sponsor' });
await fastify.register(sponsorConversationRoutes, { prefix: '/api/sponsor' });
await fastify.register(sponsorDealMemberRoutes, { prefix: '/api/sponsor' });
await fastify.register(organizerNotificationRoutes, { prefix: '/api/organizer' });
await fastify.register(organizerPayoutRoutes, { prefix: '/api/organizer' });
await fastify.register(organizerCustomInvoiceRoutes, { prefix: '/api/organizer' });

// --- Start ---
try {
  await fastify.listen({ port: parseInt(env.PORT), host: env.HOST });
  console.log(`\n🚀 Moongate API running at http://localhost:${env.PORT}`);
  console.log(`   Health: http://localhost:${env.PORT}/health`);
  console.log(`   Environment: ${env.NODE_ENV}`);

  // Start BullMQ workers if Redis is available
  isQueueAvailable().then(async (available) => {
    if (available) {
      const { startExtractionWorker } = await import('./workers/extraction.worker.js');
      startExtractionWorker();
      console.log('   Extraction worker: running');

      const { startReminderWorker } = await import('./workers/reminder.worker.js');
      startReminderWorker();
      console.log('   Reminder worker: running');
    } else {
      console.log('   Workers: Redis unavailable — using inline fallbacks');
    }
  }).catch((err) => {
    console.error('   Workers failed to start:', err);
  });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
