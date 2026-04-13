import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireSponsorAuth } from '../../plugins/auth.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { env } from '../../lib/env.js';
import { createStripeClient } from '@moongate/payments';

export async function sponsorOrderRoutes(fastify: FastifyInstance) {
  // List orders
  fastify.get('/', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const orders = await prisma.order.findMany({
      where: { bid: { email: user.email } },
      orderBy: { createdAt: 'desc' },
      include: {
        event: { select: { name: true, slug: true } },
        tenant: { select: { slug: true, name: true } },
        lines: { include: { item: { select: { publicTitle: true } } } },
        invoice: { select: { id: true, invoiceNumber: true, issuedAt: true } },
      },
    });

    return reply.send({ data: orders });
  });

  // Get single order
  fastify.get('/:orderId', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { orderId } = request.params as { orderId: string };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: { select: { name: true, slug: true } },
        tenant: { select: { slug: true, name: true } },
        lines: { include: { item: { select: { publicTitle: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
        invoice: true,
        bid: { select: { email: true, companyName: true, contactName: true } },
      },
    });

    if (!order) throw new NotFoundError('Order not found');
    if (order.bid?.email !== user.email) throw new ForbiddenError('Access denied');

    return reply.send({ data: order });
  });

  // Create Stripe checkout for an accepted bid
  fastify.post('/:orderId/checkout', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { orderId } = request.params as { orderId: string };

    if (!env.STRIPE_SECRET_KEY) {
      return reply.status(503).send({ error: 'Payment processing not configured' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: { include: { item: { select: { publicTitle: true } } } },
        bid: { select: { email: true } },
        tenant: { select: { slug: true } },
        event: { select: { slug: true } },
      },
    });

    if (!order) throw new NotFoundError('Order not found');
    if (order.bid?.email !== user.email) throw new ForbiddenError('Access denied');
    if (order.status === 'paid') return reply.status(400).send({ error: 'Order already paid' });
    if (order.paymentStage === 'balance') {
      return reply.status(400).send({
        error: 'USE_PAY_BALANCE',
        message: 'Your deposit is secured. Use the pay-balance endpoint to complete your final payment.',
      });
    }

    const chargeAmount = Number(order.total);
    const chargeLabel = order.paymentStage === 'deposit' ? 'Deposit payment' : 'Order payment';

    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    const appUrl = env.APP_URL ?? 'http://localhost:3000';

    const session = await stripe.createCheckoutSession({
      orderId: order.id,
      currency: order.currency,
      lineItems: order.lines.map(l => ({
        name: `${chargeLabel}: ${l.label ?? l.item.publicTitle}`,
        amount: chargeAmount,
        quantity: l.quantity,
      })),
      successUrl: `${appUrl}/portal/payments?order=${order.id}&success=1`,
      cancelUrl: `${appUrl}/portal/payments?order=${order.id}&cancelled=1`,
      customerEmail: user.email,
    });

    await prisma.checkoutSession.create({
      data: {
        orderId: order.id,
        provider: 'stripe',
        externalSessionId: session.id,
        checkoutUrl: session.url,
        status: 'created',
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'payment_pending', stripeSessionId: session.id },
    });

    return reply.send({ data: { url: session.url } });
  });

  // Pay balance (complete final payment for a deposit order)
  fastify.post('/:orderId/pay-balance', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { orderId } = request.params as { orderId: string };

    if (!env.STRIPE_SECRET_KEY) {
      return reply.status(503).send({ error: 'Payment processing not configured' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: { include: { item: { select: { publicTitle: true } } } },
        bid: { select: { email: true } },
        checkoutSessions: { where: { status: 'created' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!order) throw new NotFoundError('Order not found');
    if (order.bid?.email !== user.email) throw new ForbiddenError('Access denied');

    if (order.paymentStage !== 'balance' || order.status !== 'partially_paid') {
      return reply.status(400).send({
        error: 'PAYMENT_NOT_DUE',
        message: 'This order does not have a pending balance payment.',
      });
    }

    const balanceAmount = Number(order.balanceDueAmount ?? 0);
    if (balanceAmount <= 0) {
      return reply.status(400).send({ error: 'NO_BALANCE_DUE', message: 'No balance due on this order.' });
    }

    // Return existing active session if still valid
    const existingSession = order.checkoutSessions[0];
    if (existingSession?.checkoutUrl) {
      return reply.send({ data: { url: existingSession.checkoutUrl } });
    }

    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    const appUrl = env.APP_URL ?? 'http://localhost:3000';

    const packageTitle = order.lines[0]?.item?.publicTitle ?? 'Sponsorship Package';
    const session = await stripe.createCheckoutSession({
      orderId: order.id,
      currency: order.currency,
      lineItems: [
        {
          name: `Final payment: ${packageTitle}`,
          description: `Balance remaining for your sponsorship package`,
          amount: balanceAmount,
          quantity: 1,
        },
      ],
      successUrl: `${appUrl}/portal/payments?order=${order.id}&success=1`,
      cancelUrl: `${appUrl}/portal/payments?order=${order.id}&cancelled=1`,
      customerEmail: user.email,
      metadata: { installment: 'balance' },
    });

    await prisma.checkoutSession.create({
      data: {
        orderId: order.id,
        provider: 'stripe',
        externalSessionId: session.id,
        checkoutUrl: session.url,
        status: 'created',
        expiresAt: session.expiresAt,
      },
    });

    return reply.send({ data: { url: session.url } });
  });

  // List invoices
  fastify.get('/invoices', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const invoices = await prisma.invoice.findMany({
      where: { order: { bid: { email: user.email } } },
      orderBy: { issuedAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            event: { select: { name: true, slug: true } },
            tenant: { select: { slug: true, name: true } },
          },
        },
      },
    });

    return reply.send({ data: invoices });
  });

  // Get single invoice
  fastify.get('/invoices/:invoiceId', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const { invoiceId } = request.params as { invoiceId: string };

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        order: {
          include: {
            bid: { select: { email: true } },
            event: { select: { name: true, slug: true } },
            tenant: { select: { name: true, slug: true } },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice not found');
    if (invoice.order.bid?.email !== user.email) throw new ForbiddenError('Access denied');

    return reply.send({ data: invoice });
  });
}
