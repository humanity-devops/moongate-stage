import { prisma } from '@moongate/db';

interface NotifyParams {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  tenantId?: string;
}

export async function notify(params: NotifyParams): Promise<void> {
  // fire-and-forget, never throws
  prisma.notification.create({
    data: {
      userId: params.userId,
      tenantId: params.tenantId ?? null,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: params.data as any ?? undefined,
    },
  }).catch(err => console.error('[notify]', err?.message));
}
