/**
 * Public direct-checkout endpoint for fixed_price / hybrid packages.
 *
 * POST /api/public/events/:tenantSlug/:eventSlug/items/:itemSlug/checkout
 *
 * Atomically:
 *   1. Validates item eligibility (published, purchasable, not sold-out, access allowed).
 *   2. Idempotency guard: returns existing checkout URL if a payment_pending order
 *      exists for this email+item; rejects if already paid.
 *   3. Creates Bid (status='accepted') + Order in a single transaction.
 *   4. Creates Stripe checkout session → returns redirect URL.
 *   5. Falls back to 'reserve_only' mode if Stripe is not configured.
 *
 * Server-side pricing: listPrice is never accepted from the client.
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { createStripeClient } from '@moongate/payments';
import { env } from '../../lib/env.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

// Reuse the same access-check logic as bid submission
async function checkItemAccess(
  itemId: string,
  eventId: string,
  email: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const item = await prisma.sponsorItem.findUnique({
    where: { id: itemId },
    include: { event: { select: { accessMode: true } } },
  });
  if (!item) return { allowed: false, reason: 'not_found' };

  const effectiveMode = item.itemAccessMode ?? item.event.accessMode;
  if (effectiveMode === 'public') return { allowed: true };

  const grant = await prisma.itemAccessGrant.findFirst({
    where: { itemId, email: email.toLowerCase() },
  });
  if (grant) return { allowed: true };

  const eventGrant = await prisma.eventAccessGrant.findFirst({
    where: { eventId, email: email.toLowerCase() },
  });
  if (eventGrant) return { allowed: true };

  return { allowed: false, reason: 'not_whitelisted' };
}

const checkoutBodySchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  email: z.string().email(),
  telegram: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  termsAccepted: z.boolean().refine(v => v === true, 'Terms must be accepted'),
});

export async function publicCheckoutRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Params: { tenantSlug: string; eventSlug: string; itemSlug: string };
    Body: unknown;
  }>(
    '/events/:tenantSlug/:eventSlug/items/:itemSlug/checkout',
    { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const { tenantSlug, eventSlug, itemSlug } = request.params;

      // --- 1. Resolve tenant + event + item ---
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

      const event = await prisma.event.findFirst({
        where: { tenantId: tenant.id, slug: eventSlug, status: 'published' },
      });
      if (!event) throw new NotFoundError('Event', eventSlug);

      const item = await prisma.sponsorItem.findFirst({
        where: {
          eventId: event.id,
          slug: itemSlug,
          status: 'published',
          visibleToPublic: true,
          checkoutEnabled: true,
        },
      });
      if (!item) {
        throw new NotFoundError('Package', itemSlug);
      }

      // Only fixed_price and hybrid support direct purchase
      if (item.mode !== 'fixed_price' && item.mode !== 'hybrid') {
        throw new ValidationError('This package does not support direct purchase. Use the private offer form.');
      }

      // Server-authoritative price — never trust client value
      const listPrice = item.listPrice ? Number(item.listPrice) : null;
      const depositEnabled = Boolean(item.depositEnabled);
      const depositPct = Number(item.depositPercentage ?? 30);
      const safeDepositPct = Number.isFinite(depositPct) && depositPct > 0 ? depositPct : 30;
      const dueNow = depositEnabled ? roundMoney((listPrice * safeDepositPct) / 100) : listPrice;
      const balanceDue = roundMoney(listPrice - dueNow);
      const finalPaymentDueAt =
        depositEnabled && item.finalPaymentDays
          ? new Date(Date.now() + item.finalPaymentDays * 24 * 60 * 60 * 1000)
          : null;

      if (!listPrice || listPrice <= 0) {
        throw new ValidationError('Package price is not configured for direct purchase.');
      }

      // Sold-out check (non-transactional pre-check; race condition handled below)
      if (item.status === 'sold_out') {
        return reply.status(409).send({ error: 'SOLD_OUT', message: 'This package is no longer available.' });
      }
      if (item.quantityTotal !== null && item.quantitySold >= item.quantityTotal) {
        return reply.status(409).send({ error: 'SOLD_OUT', message: 'This package is no longer available.' });
      }

      // --- 2. Validate body ---
      const parsed = checkoutBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid checkout data', parsed.error.format());
      }
      const data = parsed.data;

      // --- 3. Access control ---
      const access = await checkItemAccess(item.id, event.id, data.email);
      if (!access.allowed) {
        throw new ValidationError(
          access.reason === 'not_whitelisted'
            ? 'You are not on the access list for this package.'
            : 'Package not found.',
        );
      }

      // --- 4. Idempotency: check existing order for this email+item ---
      const existingOrder = await prisma.order.findFirst({
        where: {
          eventId: event.id,
          bid: { email: data.email, itemId: item.id },
          status: { in: ['paid', 'payment_pending', 'pending'] },
        },
        include: {
          checkoutSessions: {
            where: { status: 'created' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (existingOrder?.status === 'paid') {
        return reply.status(409).send({
          error: 'ALREADY_PURCHASED',
          message: 'You have already purchased this package. Check your email for your invoice.',
        });
      }

      if (existingOrder?.status === 'payment_pending') {
        const session = existingOrder.checkoutSessions[0];
        if (session?.checkoutUrl) {
          // Return existing Stripe session URL (still valid for ~30 min)
          return reply.send({
            data: {
              mode: 'stripe_redirect' as const,
              checkoutUrl: session.checkoutUrl,
              orderId: existingOrder.id,
            },
          });
        }
      }

      // --- 5. Create/reuse sponsor contact + company ---
      let contact = await prisma.sponsorContact.findFirst({
        where: { email: data.email, tenantId: tenant.id },
      });
      if (!contact) {
        contact = await prisma.sponsorContact.create({
          data: {
            tenantId: tenant.id,
            name: data.contactName,
            email: data.email,
            telegram: data.telegram,
          },
        });
      }

      let company = await prisma.sponsorCompany.findFirst({
        where: { tenantId: tenant.id, name: data.companyName },
      });
      if (!company) {
        company = await prisma.sponsorCompany.create({
          data: { tenantId: tenant.id, name: data.companyName },
        });
      }

      // --- 6. Create bid + order atomically, with final sold-out guard ---
      const { bid, order } = await prisma.$transaction(async (tx) => {
        // Final sold-out check inside transaction
        const freshItem = await tx.sponsorItem.findUnique({
          where: { id: item.id },
          select: { quantityTotal: true, quantitySold: true, status: true },
        });
        if (
          freshItem?.status === 'sold_out' ||
          (freshItem?.quantityTotal !== null &&
            (freshItem?.quantitySold ?? 0) >= (freshItem?.quantityTotal ?? Infinity))
        ) {
          throw Object.assign(new Error('SOLD_OUT'), { code: 'SOLD_OUT' });
        }

        const newBid = await tx.bid.create({
          data: {
            tenantId: tenant.id,
            eventId: event.id,
            itemId: item.id,
            sponsorContactId: contact!.id,
            sponsorCompanyId: company!.id,
            status: 'accepted', // direct checkout: skip review
            companyName: data.companyName,
            contactName: data.contactName,
            email: data.email,
            telegram: data.telegram,
            proposedBudget: listPrice,
            currency: item.currency,
            notes: data.notes,
            termsAccepted: data.termsAccepted,
          },
        });

        const newOrder = await tx.order.create({
          data: {
            tenantId: tenant.id,
            eventId: event.id,
            bidId: newBid.id,
            sponsorCompanyId: company!.id,
            sponsorContactId: contact!.id,
            status: 'pending',
            currency: item.currency,
            subtotal: listPrice,
            total: dueNow,
            fullAmount: listPrice,
            depositAmount: depositEnabled ? dueNow : null,
            balanceDueAmount: depositEnabled ? balanceDue : null,
            paymentStage: depositEnabled ? 'deposit' : 'full',
            finalPaymentDueAt,
            lines: {
              create: {
                itemId: item.id,
                quantity: 1,
                unitPrice: dueNow,
                total: dueNow,
                label: depositEnabled ? `${item.publicTitle} — Deposit (${safeDepositPct}%)` : item.publicTitle,
              },
            },
          },
        });

        return { bid: newBid, order: newOrder };
      }).catch((err: Error) => {
        if ((err as { code?: string }).code === 'SOLD_OUT' || err.message === 'SOLD_OUT') {
          throw Object.assign(
            new ValidationError('This package sold out just now. Please try another package.'),
            { statusCode: 409 },
          );
        }
        throw err;
      });

      // Log activity
      await prisma.activityFeedEntry.create({
        data: {
          tenantId: tenant.id,
          eventId: event.id,
          type: 'bid_submitted',
          title: `Direct purchase from ${data.companyName}`,
          body: depositEnabled
            ? `${data.contactName} is paying a deposit (${safeDepositPct}%) for "${item.publicTitle}" (${item.currency} ${dueNow})`
            : `${data.contactName} is purchasing "${item.publicTitle}" at list price (${item.currency} ${listPrice})`,
          resourceId: bid.id,
          resourceType: 'bid',
        },
      }).catch(() => { /* non-critical */ });

      // --- 7. If Stripe is not configured, return reserve-only confirmation ---
      if (!env.STRIPE_SECRET_KEY) {
        logAudit({
          tenantId: tenant.id,
          action: 'checkout_reserved',
          resource: 'order',
          resourceId: order.id,
          after: { mode: 'reserve_only', email: data.email },
        });

        return reply.status(201).send({
          data: {
            mode: 'reserve_only' as const,
            bidId: bid.id,
            orderId: order.id,
            message:
              'Your purchase request has been received. The organizer will send a payment link to your email within 2 business days.',
          },
        });
      }

      // --- 8. Create Stripe checkout session ---
      const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
      const appUrl = env.APP_URL ?? 'http://localhost:3000';

      const session = await stripe.createCheckoutSession({
        orderId: order.id,
        currency: item.currency,
        lineItems: [
          {
            name: item.publicTitle,
            description: depositEnabled
              ? `Deposit payment (${safeDepositPct}%) — full price ${item.currency} ${listPrice}`
              : item.shortDescription ?? undefined,
            amount: dueNow, // dollars — Stripe client converts to cents
            quantity: 1,
          },
        ],
        successUrl: `${appUrl}/${tenantSlug}/${eventSlug}/checkout/success?order=${order.id}`,
        cancelUrl: `${appUrl}/${tenantSlug}/${eventSlug}/checkout/${itemSlug}?cancelled=1`,
        customerEmail: data.email,
        metadata: { tenantSlug, eventSlug, itemSlug },
      });

      // --- 9. Persist session + transition order to payment_pending ---
      await prisma.$transaction([
        prisma.checkoutSession.create({
          data: {
            orderId: order.id,
            provider: 'stripe',
            externalSessionId: session.id,
            checkoutUrl: session.url,
            status: 'created',
          },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'payment_pending', stripeSessionId: session.id },
        }),
      ]);

      logAudit({
        tenantId: tenant.id,
        action: 'checkout_session_created',
        resource: 'order',
        resourceId: order.id,
        after: { sessionId: session.id, email: data.email, amount: listPrice },
      });

      return reply.status(201).send({
        data: {
          mode: 'stripe_redirect' as const,
          checkoutUrl: session.url,
          orderId: order.id,
          fullAmount: listPrice,
          dueNow,
          balanceDue,
          finalPaymentDueAt,
        },
      });
    },
  );
}
