import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { createStripeClient, handleStripeWebhook } from '@moongate/payments';
import { env } from '../../lib/env.js';
import { computeFee } from '../../lib/fees.js';
import { logAudit } from '../../lib/audit.js';
import { sendEmail } from '../../lib/email.js';
import { paymentSucceededEmail, depositConfirmedEmail, finalPaymentReminderEmail } from '@moongate/emails';
import { enqueueReminderJob } from '../../lib/queue.js';

let invoiceSeq = Date.now(); // simple monotonic sequence for invoice numbers

function nextInvoiceNumber(): string {
  invoiceSeq++;
  const date = new Date();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `INV-${yyyymm}-${String(invoiceSeq).slice(-6).padStart(6, '0')}`;
}

export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  // Override the JSON parser in this scope to get raw Buffer for Stripe sig verification
  fastify.removeAllContentTypeParsers();
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  fastify.post<{ Body: Buffer }>('/stripe', async (request, reply) => {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      return reply.status(503).send({ error: 'Payment processing not configured' });
    }

    const signature = request.headers['stripe-signature'];
    if (!signature) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);

    let stripeEvent;
    try {
      stripeEvent = stripe.constructWebhookEvent(
        request.body,
        signature as string,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      return reply.status(400).send({ error: 'Invalid webhook signature' });
    }

    // Record the raw webhook event
    await prisma.webhookEvent.create({
      data: {
        provider: 'stripe',
        eventType: stripeEvent.type,
        payload: JSON.parse(JSON.stringify(stripeEvent)),
        signature: signature as string,
        processed: false,
      },
    }).catch(() => { /* non-critical */ });

    const result = handleStripeWebhook(stripeEvent);

    if (result.type === 'payment_succeeded' && result.orderId) {
      await handlePaymentSucceeded(result.orderId, result.sessionId);
    } else if (result.type === 'checkout_expired' && result.orderId) {
      await handleCheckoutExpired(result.orderId, result.sessionId);
    }

    // Mark webhook processed
    prisma.webhookEvent.updateMany({
      where: { eventType: stripeEvent.type, processed: false },
      data: { processed: true, processedAt: new Date() },
    }).catch(() => { /* non-critical */ });

    return reply.send({ received: true });
  });
}

async function handlePaymentSucceeded(orderId: string, sessionId?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      lines: { include: { item: { select: { publicTitle: true } } } },
      bid: { select: { email: true, contactName: true, companyName: true } },
      event: { select: { name: true, slug: true } },
      tenant: { select: { slug: true } },
    },
  });
  if (!order) return;
  if (order.status === 'paid') return; // idempotent

  const isDepositPayment = order.paymentStage === 'deposit' && Number(order.balanceDueAmount ?? 0) > 0;
  const isBalancePayment = order.paymentStage === 'balance' && order.status === 'partially_paid';

  if (isDepositPayment) {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'partially_paid',
          paymentStage: 'balance',
          depositPaidAt: new Date(),
        },
      });

      await tx.payment.create({
        data: {
          orderId,
          provider: 'stripe',
          externalId: sessionId,
          amount: order.total, // deposit amount charged
          currency: order.currency,
          status: 'succeeded',
          metadata: {
            installment: 'deposit',
            fullAmount: Number(order.fullAmount ?? order.total),
            balanceDueAmount: Number(order.balanceDueAmount ?? 0),
            finalPaymentDueAt: order.finalPaymentDueAt?.toISOString() ?? null,
          },
        },
      });

      if (sessionId) {
        await tx.checkoutSession.updateMany({
          where: { externalSessionId: sessionId },
          data: { status: 'completed', completedAt: new Date() },
        });
      }
    });

    // Send deposit confirmation email (fire-and-forget)
    if (order.bid?.email) {
      const depositEmail = depositConfirmedEmail({
        contactName: order.bid.contactName ?? order.bid.email,
        contactEmail: order.bid.email,
        eventName: order.event?.name ?? '',
        packageTitle: order.lines[0]?.item?.publicTitle ?? 'Sponsorship Package',
        depositAmount: Number(order.total),
        balanceDueAmount: Number(order.balanceDueAmount ?? 0),
        fullAmount: Number(order.fullAmount ?? order.total),
        currency: order.currency,
        finalPaymentDueAt: order.finalPaymentDueAt?.toISOString() ?? null,
        portalUrl: `${env.APP_URL ?? 'http://localhost:3000'}/portal/payments`,
      });
      sendEmail({
        to: Array.isArray(depositEmail.to) ? depositEmail.to[0] : depositEmail.to,
        subject: depositEmail.subject,
        html: depositEmail.html,
        text: depositEmail.text,
        template: 'deposit_confirmed',
        tenantId: order.tenantId,
        resourceId: orderId,
        resourceType: 'order',
      }).catch(() => {});
    }

    // Schedule automated final-payment reminder
    if (order.finalPaymentDueAt) {
      // Remind 3 days before due, or in 1 day if due date is very soon
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      const dueMs = order.finalPaymentDueAt.getTime();
      const reminderAt = dueMs - THREE_DAYS_MS;
      const delayMs = Math.max(24 * 60 * 60 * 1000, reminderAt - Date.now()); // at least 1 day delay
      enqueueReminderJob(orderId, delayMs).catch(() => {});
    }

    return;
  }

  // Compute platform fee (always uses fullAmount if set, so fee is on full deal value)
  const fee = await computeFee(orderId);

  // Generate invoice number
  const invoiceNumber = nextInvoiceNumber();

  // For balance payment, charge the balance amount; otherwise charge full order total
  const chargedAmount = isBalancePayment
    ? Number(order.balanceDueAmount ?? order.total)
    : Number(order.total);
  // Invoice covers the full deal value
  const invoiceTotal = Number(order.fullAmount ?? order.total);
  const invoiceSubtotal = Number(order.fullAmount ?? order.subtotal ?? order.total);

  // Build invoice lines
  const invoiceLines = isBalancePayment
    ? [
        {
          label: `${order.lines[0]?.item?.publicTitle ?? 'Sponsorship'} — Deposit (paid)`,
          quantity: 1,
          unitPrice: Number(order.depositAmount ?? order.total),
          total: Number(order.depositAmount ?? order.total),
        },
        {
          label: `${order.lines[0]?.item?.publicTitle ?? 'Sponsorship'} — Final payment`,
          quantity: 1,
          unitPrice: chargedAmount,
          total: chargedAmount,
        },
      ]
    : order.lines.map(l => ({
        label: l.label ?? l.item.publicTitle,
        quantity: l.quantity,
        unitPrice: Number(l.unitPrice),
        total: Number(l.total),
      }));

  await prisma.$transaction(async (tx) => {
    // Mark order paid with fee details (immutable)
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        paidAt: new Date(),
        stripeSessionId: sessionId ?? order.stripeSessionId,
        platformFeeRate: fee.rate,
        platformFeeAmount: fee.feeAmount,
        merchantNetAmount: fee.merchantNet,
        commissionSource: fee.source,
        processingFeeProfile: fee.processingFeeProfile,
        processingFeeRate: fee.processingFeeRate,
        processingFeeAmount: fee.processingFeeAmount,
        invoiceNumber,
        invoiceRequestedAt: new Date(),
      },
    });

    // Record payment (amount = what was actually charged in this session)
    await tx.payment.create({
      data: {
        orderId,
        provider: 'stripe',
        externalId: sessionId,
        amount: chargedAmount,
        currency: order.currency,
        status: 'succeeded',
        metadata: {
          installment: isBalancePayment ? 'balance' : 'full',
          feeRate: fee.rate,
          feeAmount: fee.feeAmount,
        },
      },
    });

    // Create or update invoice (upsert in case deposit already has a partial one)
    await tx.invoice.upsert({
      where: { orderId },
      create: {
        orderId,
        tenantId: order.tenantId,
        invoiceNumber,
        billedToEmail: order.bid?.email ?? '',
        billedToName: order.bid?.contactName,
        billedToCompany: order.bid?.companyName,
        subtotal: invoiceSubtotal,
        platformFee: fee.feeAmount,
        total: invoiceTotal,
        currency: order.currency,
        lines: invoiceLines,
        issuedAt: new Date(),
      },
      update: {
        invoiceNumber,
        subtotal: invoiceSubtotal,
        platformFee: fee.feeAmount,
        total: invoiceTotal,
        lines: invoiceLines,
        issuedAt: new Date(),
      },
    });

    // Mark checkout session completed
    if (sessionId) {
      await tx.checkoutSession.updateMany({
        where: { externalSessionId: sessionId },
        data: { status: 'completed', completedAt: new Date() },
      });
    }
  });

  logAudit({
    tenantId: order.tenantId,
    action: 'payment_succeeded',
    resource: 'order',
    resourceId: orderId,
    after: { invoiceNumber, feeRate: fee.rate, feeAmount: fee.feeAmount, source: fee.source },
  });

  // Send payment confirmation email (fire-and-forget)
  if (order.bid?.email) {
    const paidEmail = paymentSucceededEmail({
      contactName: order.bid.contactName ?? order.bid.email,
      contactEmail: order.bid.email,
      eventName: order.tenantId, // best available without event join here
      total: Number(order.total),
      currency: order.currency,
      invoiceNumber,
      portalUrl: `${env.APP_URL}/portal/invoices`,
    });
    sendEmail({
      to: Array.isArray(paidEmail.to) ? paidEmail.to[0] : paidEmail.to,
      subject: paidEmail.subject,
      html: paidEmail.html,
      text: paidEmail.text,
      template: 'payment_succeeded',
      tenantId: order.tenantId,
      resourceId: orderId,
      resourceType: 'order',
    }).catch(() => {});
  }

  // Handle campaign contribution confirmation
  const contribution = await prisma.crowdfundContribution.findFirst({
    where: { orderId },
    include: { campaign: true },
  });

  if (contribution && contribution.status === 'pending_payment') {
    const newRaised = Number(contribution.campaign.raisedAmount) + Number(contribution.amount);
    const won = newRaised >= Number(contribution.campaign.goalAmount);

    await prisma.$transaction([
      prisma.crowdfundContribution.update({
        where: { id: contribution.id },
        data: { status: 'confirmed' },
      }),
      prisma.crowdfundCampaign.update({
        where: { id: contribution.campaignId },
        data: {
          raisedAmount: newRaised,
          ...(won ? { status: 'won', wonAt: new Date() } : {}),
        },
      }),
    ]);

    if (won) {
      await prisma.crowdfundCampaign.updateMany({
        where: {
          itemId: contribution.campaign.itemId,
          id: { not: contribution.campaignId },
          status: 'active',
        },
        data: { status: 'lost' },
      });
    }
  }
}

async function handleCheckoutExpired(orderId: string, sessionId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  // Never cancel an order that is already paid or has a deposit secured
  if (!order || order.status === 'paid' || order.status === 'partially_paid') return;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'cancelled' },
  });

  if (sessionId) {
    await prisma.checkoutSession.updateMany({
      where: { externalSessionId: sessionId },
      data: { status: 'expired' },
    });
  }
}
