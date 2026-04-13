import { prisma } from '@moongate/db';
import type { FastifyRequest } from 'fastify';

export interface AuditParams {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  request?: FastifyRequest;
}

/**
 * Fire-and-forget audit log entry. Never throws — errors are swallowed so
 * a logging failure never breaks the surrounding business operation.
 */
export function logAudit(params: AuditParams): void {
  const { tenantId, userId, action, resource, resourceId, before, after, request } = params;

  prisma.auditLog
    .create({
      data: {
        tenantId: tenantId ?? null,
        userId: userId ?? null,
        action,
        resource,
        resourceId: resourceId ?? null,
        before: before !== undefined ? (before as object) : undefined,
        after: after !== undefined ? (after as object) : undefined,
        ipAddress: request?.ip ?? null,
        userAgent: request?.headers['user-agent'] ?? null,
      },
    })
    .catch((err) => {
      console.error('[audit] Failed to write audit log:', err?.message);
    });
}
