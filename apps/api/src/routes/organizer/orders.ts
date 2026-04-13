import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { computeFee } from '../../lib/fees.js';
import { logAudit } from '../../lib/audit.js';
import { env } from '../../lib/env.js';
import { createStripeClient } from '@moongate/payments';
import { sendEmail } from '../../lib/email.js';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

export async function organizerOrderRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // GET /api/organizer/orders — list tenant orders
  fastify.get<{ Querystring: { status?: string; eventId?: string; page?: string; pageSize?: string } }>(
    '/', async (request, reply) => {
      const user = request.user!;
      const { status, eventId, page = '1', pageSize = '50' } = request.query;

      const pageNum = Math.max(1, parseInt(page));
      const size = Math.min(100, Math.max(1, parseInt(pageSize)));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { tenantId: user.tenantId };
      if (status) where.status = status;
      if (eventId) where.eventId = eventId;

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * size,
          take: size,
          include: {
            lines: true,
            event: { select: { id: true, name: true, slug: true } },
            sponsorCompany: { select: { id: true, name: true } },
            invoice: { select: { id: true, invoiceNumber: true, issuedAt: true } },
          },
        }),
        prisma.order.count({ where }),
      ]);

      return reply.send({ data: orders, meta: { total, page: pageNum, pageSize: size } });
    },
  );

  // GET /api/organizer/orders/:orderId — get single order
  fastify.get<{ Params: { orderId: string } }>(
    '/:orderId', async (request, reply) => {
      const user = request.user!;
      const order = await prisma.order.findFirst({
        where: { id: request.params.orderId, tenantId: user.tenantId },
        include: {
          lines: { include: { item: { select: { id: true, publicTitle: true } } } },
          payments: true,
          checkoutSessions: { orderBy: { createdAt: 'desc' }, take: 1 },
          event: { select: { id: true, name: true, slug: true } },
          sponsorCompany: { select: { id: true, name: true } },
          bid: { select: { id: true, email: true, contactName: true } },
          invoice: true,
        },
      });
      if (!order) throw new NotFoundError('Order', request.params.orderId);
      return reply.send({ data: order });
    },
  );

  // POST /api/organizer/orders/:orderId/checkout — create Stripe checkout session
  fastify.post<{ Params: { orderId: string } }>(
    '/:orderId/checkout', async (request, reply) => {
      const user = request.user!;

      if (!env.STRIPE_SECRET_KEY) {
        throw new AppError('STRIPE_NOT_CONFIGURED', 'Payment processing is not configured.', 503);
      }

      const order = await prisma.order.findFirst({
        where: { id: request.params.orderId, tenantId: user.tenantId },
        include: {
          lines: { include: { item: { select: { publicTitle: true } } } },
          bid: { select: { email: true, contactName: true } },
          event: { select: { name: true } },
        },
      });
      if (!order) throw new NotFoundError('Order', request.params.orderId);

      if (order.status === 'paid') {
        throw new AppError('ORDER_ALREADY_PAID', 'This order has already been paid.', 409);
      }
      if (order.status === 'cancelled') {
        throw new AppError('ORDER_CANCELLED', 'This order has been cancelled.', 409);
      }

      const stripe = createStripeClient(env.STRIPE_SECRET_KEY);

      const session = await stripe.createCheckoutSession({
        orderId: order.id,
        currency: order.currency,
        lineItems: order.lines.map(line => ({
          name: line.label ?? line.item.publicTitle,
          amount: Number(line.unitPrice),
          quantity: line.quantity,
        })),
        successUrl: `${WEB_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
        cancelUrl: `${WEB_URL}/payment/cancel?order_id=${order.id}`,
        customerEmail: order.bid?.email,
        metadata: { tenantId: user.tenantId ?? '', eventName: order.event.name },
      });

      // Persist checkout session
      await prisma.checkoutSession.create({
        data: {
          orderId: order.id,
          provider: 'stripe',
          externalSessionId: session.id,
          status: 'created',
          checkoutUrl: session.url,
          expiresAt: session.expiresAt,
        },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'payment_pending', stripeSessionId: session.id },
      });

      return reply.send({ data: { checkoutUrl: session.url, sessionId: session.id } });
    },
  );

  // POST /api/organizer/orders/:orderId/manual-pay — record a manual/offline payment
  fastify.post<{ Params: { orderId: string }; Body: { provider?: string; reference?: string; notes?: string; paidAt?: string } }>(
    '/:orderId/manual-pay', async (request, reply) => {
      const user = request.user!;
      const { provider = 'manual', reference, notes, paidAt } = request.body ?? {};

      const order = await prisma.order.findFirst({
        where: { id: request.params.orderId, tenantId: user.tenantId },
        include: {
          lines: { include: { item: { select: { publicTitle: true } } } },
          bid: { select: { email: true, contactName: true, companyName: true } },
        },
      });
      if (!order) throw new NotFoundError('Order', request.params.orderId);

      if (order.status === 'paid') {
        throw new AppError('ORDER_ALREADY_PAID', 'This order has already been paid.', 409);
      }
      if (order.status === 'cancelled') {
        throw new AppError('ORDER_CANCELLED', 'This order has been cancelled.', 409);
      }

      // Compute platform fee + processing fee
      const fee = await computeFee(order.id);
      const invoiceNumber = `MAN-${Date.now().toString(36).toUpperCase().slice(-8)}`;
      const paymentDate = paidAt ? new Date(paidAt) : new Date();

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'paid',
            paidAt: paymentDate,
            platformFeeRate: fee.rate,
            platformFeeAmount: fee.feeAmount,
            merchantNetAmount: fee.merchantNet,
            commissionSource: fee.source,
            processingFeeProfile: fee.processingFeeProfile,
            processingFeeRate: fee.processingFeeRate,
            processingFeeAmount: fee.processingFeeAmount,
            invoiceNumber,
            invoiceRequestedAt: new Date(),
            notes: notes ?? order.notes,
          },
        });

        await tx.payment.create({
          data: {
            orderId: order.id,
            provider,
            externalId: reference ?? null,
            amount: order.total,
            currency: order.currency,
            status: 'succeeded',
            metadata: { reference, feeRate: fee.rate, feeAmount: fee.feeAmount, processingFeeProfile: fee.processingFeeProfile },
          },
        });

        // Create invoice
        await tx.invoice.create({
          data: {
            orderId: order.id,
            tenantId: order.tenantId,
            invoiceNumber,
            billedToEmail: order.bid?.email ?? '',
            billedToName: order.bid?.contactName,
            billedToCompany: order.bid?.companyName,
            subtotal: order.subtotal,
            platformFee: fee.feeAmount,
            total: order.total,
            currency: order.currency,
            lines: order.lines.map(l => ({
              label: l.label ?? l.item.publicTitle,
              quantity: l.quantity,
              unitPrice: Number(l.unitPrice),
              total: Number(l.total),
            })),
            issuedAt: new Date(),
          },
        });
      });

      logAudit({
        tenantId: user.tenantId, userId: user.userId,
        action: 'manual_payment_recorded', resource: 'order', resourceId: order.id,
        after: { provider, reference, invoiceNumber, feeRate: fee.rate, processingFeeProfile: fee.processingFeeProfile },
      });

      return reply.send({ data: { ok: true, invoiceNumber } });
    }
  );

  // GET /api/organizer/orders/:orderId/invoice — download invoice
  fastify.get<{ Params: { orderId: string } }>(
    '/:orderId/invoice', async (request, reply) => {
      const user = request.user!;
      const order = await prisma.order.findFirst({
        where: { id: request.params.orderId, tenantId: user.tenantId },
        include: { invoice: true },
      });
      if (!order) throw new NotFoundError('Order', request.params.orderId);
      if (!order.invoice) {
        throw new AppError('INVOICE_NOT_READY', 'Invoice is only available after payment is confirmed.', 404);
      }
      return reply.send({ data: order.invoice });
    },
  );

  // POST /api/organizer/orders/:orderId/send-final-reminder
  fastify.post<{ Params: { orderId: string } }>(
    '/:orderId/send-final-reminder', async (request, reply) => {
      const user = request.user!;
      const order = await prisma.order.findFirst({
        where: { id: request.params.orderId, tenantId: user.tenantId },
        include: {
          bid: { select: { email: true, contactName: true } },
          event: { select: { name: true } },
        },
      });
      if (!order) throw new NotFoundError('Order', request.params.orderId);

      if (order.paymentStage !== 'balance' || Number(order.balanceDueAmount ?? 0) <= 0) {
        throw new AppError('FINAL_PAYMENT_NOT_DUE', 'This order does not have an outstanding final payment.', 400);
      }
      if (!order.bid?.email) {
        throw new AppError('SPONSOR_EMAIL_MISSING', 'Cannot send reminder without sponsor email.', 400);
      }

      const dueLabel = order.finalPaymentDueAt
        ? new Date(order.finalPaymentDueAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : 'as soon as possible';

      await sendEmail({
        to: order.bid.email,
        subject: `Final sponsorship payment reminder — ${order.event.name}`,
        html: `<p>Hi ${order.bid.contactName ?? 'there'},</p>
<p>Your sponsorship deposit has been received and your package is secured.</p>
<p>Please complete your final payment of <strong>${order.currency} ${Number(order.balanceDueAmount).toLocaleString()}</strong> by <strong>${dueLabel}</strong>.</p>
<p>Log in to your sponsor portal to complete payment.</p>`,
        text: `Hi ${order.bid.contactName ?? 'there'}, your sponsorship deposit has been received. Please complete your final payment of ${order.currency} ${Number(order.balanceDueAmount).toLocaleString()} by ${dueLabel}.`,
        template: 'final_payment_reminder',
        tenantId: user.tenantId,
        resourceId: order.id,
        resourceType: 'order',
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { finalReminderSentAt: new Date() },
      });

      return reply.send({ data: { ok: true, message: 'Final payment reminder sent.' } });
    },
  );
}
