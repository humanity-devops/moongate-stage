import { prisma } from '@moongate/db';
import { createEmailClientFromEnv } from '@moongate/emails';

const client = createEmailClientFromEnv();

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template: string;
  userId?: string | null;
  tenantId?: string | null;
  resourceId?: string | null;
  resourceType?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Send a transactional email with delivery logging. Never throws — errors are
 * recorded in the email log and logged to stderr.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const log = await prisma.emailLog
    .create({
      data: {
        to: params.to,
        subject: params.subject,
        template: params.template,
        status: 'pending',
        userId: params.userId ?? null,
        tenantId: params.tenantId ?? null,
        resourceId: params.resourceId ?? null,
        resourceType: params.resourceType ?? null,
        metadata: (params.metadata ?? undefined) as object | undefined,
        lastAttemptAt: new Date(),
      },
    })
    .catch(() => null);

  try {
    const result = await client.send({
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (log) {
      await prisma.emailLog
        .update({
          where: { id: log.id },
          data: { status: 'sent', providerId: result.id ?? null, sentAt: new Date() },
        })
        .catch(() => null);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send ${params.template} to ${params.to}:`, message);

    if (log) {
      await prisma.emailLog
        .update({
          where: { id: log.id },
          data: {
            status: 'failed',
            error: message,
            retryCount: { increment: 1 },
          },
        })
        .catch(() => null);
    }
  }
}
