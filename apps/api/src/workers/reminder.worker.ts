import { Worker } from 'bullmq';
import { prisma } from '@moongate/db';
import { getRedisConnectionOptions } from '../lib/queue.js';
import { sendEmail } from '../lib/email.js';
import { finalPaymentReminderEmail } from '@moongate/emails';
import { env } from '../lib/env.js';

async function processReminderJob(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      bid: { select: { email: true, contactName: true } },
      event: { select: { name: true } },
      lines: { include: { item: { select: { publicTitle: true } } } },
    },
  });

  if (!order) return;
  // Only send if still awaiting final payment
  if (order.paymentStage !== 'balance' || order.status !== 'partially_paid') return;
  // Don't spam: skip if already reminded in the last 6 hours
  if (
    order.finalReminderSentAt &&
    Date.now() - new Date(order.finalReminderSentAt).getTime() < 6 * 60 * 60 * 1000
  ) {
    return;
  }

  const email = order.bid?.email;
  if (!email) return;

  const packageTitle = order.lines[0]?.item?.publicTitle ?? 'Sponsorship Package';
  const reminderEmail = finalPaymentReminderEmail({
    contactName: order.bid?.contactName ?? email,
    contactEmail: email,
    eventName: order.event?.name ?? '',
    packageTitle,
    balanceDueAmount: Number(order.balanceDueAmount ?? 0),
    currency: order.currency,
    finalPaymentDueAt: order.finalPaymentDueAt?.toISOString() ?? null,
    portalUrl: `${env.APP_URL ?? 'http://localhost:3000'}/portal/payments`,
  });

  await sendEmail({
    to: Array.isArray(reminderEmail.to) ? reminderEmail.to[0] : reminderEmail.to,
    subject: reminderEmail.subject,
    html: reminderEmail.html,
    text: reminderEmail.text,
    template: 'final_payment_reminder',
    tenantId: order.tenantId,
    resourceId: order.id,
    resourceType: 'order',
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { finalReminderSentAt: new Date() },
  });
}

export function startReminderWorker(): void {
  const worker = new Worker(
    'order-reminders',
    async (job) => {
      const { orderId } = job.data as { orderId: string };
      await processReminderJob(orderId);
    },
    { connection: getRedisConnectionOptions(), concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[reminder-worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    console.log(`[reminder-worker] Sent reminder for order ${job.data.orderId}`);
  });
}
