import type { FastifyInstance } from 'fastify';
import { sponsorDashboardRoutes } from './dashboard.js';
import { sponsorProfileRoutes } from './profile.js';
import { sponsorBidRoutes } from './bids.js';
import { sponsorSavedRoutes } from './saved.js';
import { sponsorOrderRoutes } from './orders.js';
import { sponsorMessageRoutes } from './messages.js';
import { sponsorMembershipRoutes } from './membership.js';

export async function sponsorRoutes(fastify: FastifyInstance) {
  await fastify.register(sponsorDashboardRoutes, { prefix: '/dashboard' });
  await fastify.register(sponsorProfileRoutes, { prefix: '/profile' });
  await fastify.register(sponsorBidRoutes, { prefix: '/bids' });
  await fastify.register(sponsorSavedRoutes, { prefix: '/saved' });
  await fastify.register(sponsorOrderRoutes, { prefix: '/orders' });
  await fastify.register(sponsorMessageRoutes, { prefix: '/messages' });
  await fastify.register(sponsorMembershipRoutes, { prefix: '/membership' });
}
