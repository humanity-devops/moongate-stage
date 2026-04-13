import { prisma } from '@moongate/db';
import { logAudit } from './audit.js';
import { sendEmail } from './email.js';
import { tenantCreatedEmail } from '@moongate/emails';
import { env } from './env.js';

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'www', 'app', 'mail', 'smtp', 'ftp', 'localhost',
  'moongate', 'platform', 'portal', 'auth', 'login', 'signup', 'join',
  'onboarding', 'settings', 'dashboard', 'browse', 'about', 'help',
  'support', 'billing', 'legal', 'terms', 'privacy', 'blog', 'docs',
]);

export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    return { valid: false, error: 'Slug must be 3–40 lowercase letters, numbers, or hyphens' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, error: 'This slug is reserved' };
  }
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'Slug cannot start or end with a hyphen' };
  }
  return { valid: true };
}

export interface ProvisionTenantParams {
  userId: string;
  userEmail: string;
  userName: string;
  tenantName: string;
  tenantSlug: string;
  currency?: string;
  timezone?: string;
}

export async function provisionTenant(
  params: ProvisionTenantParams,
): Promise<{ tenantId: string; tenantSlug: string }> {
  const validation = validateSlug(params.tenantSlug);
  if (!validation.valid) throw new Error(validation.error);

  const existing = await prisma.tenant.findUnique({ where: { slug: params.tenantSlug } });
  if (existing) throw new Error('Organization slug is already taken');

  let tenantId: string | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          slug: params.tenantSlug,
          name: params.tenantName,
          currency: params.currency ?? 'USD',
          timezone: params.timezone ?? 'UTC',
        },
      });
      tenantId = tenant.id;

      await tx.tenantProvisioningLog.create({
        data: {
          tenantId: tenant.id,
          userId: params.userId,
          step: 'tenant_created',
          status: 'success',
        },
      });

      // 2. Assign owner role
      await tx.membership.create({
        data: {
          userId: params.userId,
          tenantId: tenant.id,
          role: 'organizer_owner',
          isActive: true,
          status: 'active',
          joinedAt: new Date(),
        },
      });

      await tx.tenantProvisioningLog.create({
        data: {
          tenantId: tenant.id,
          userId: params.userId,
          step: 'owner_assigned',
          status: 'success',
        },
      });

      return tenant;
    });

    logAudit({
      userId: params.userId,
      action: 'tenant_created',
      resource: 'tenant',
      resourceId: result.id,
      after: { slug: params.tenantSlug, name: params.tenantName },
    });

    const tenantEmail = tenantCreatedEmail({
      name: params.userName,
      email: params.userEmail,
      tenantName: params.tenantName,
      adminUrl: `${env.APP_URL}/admin/${params.tenantSlug}/events`,
    });
    sendEmail({
      to: Array.isArray(tenantEmail.to) ? tenantEmail.to[0] : tenantEmail.to,
      subject: tenantEmail.subject,
      html: tenantEmail.html,
      text: tenantEmail.text,
      template: 'tenant_created',
      userId: params.userId,
      tenantId: result.id,
      resourceId: result.id,
      resourceType: 'tenant',
    }).catch(() => {});

    return { tenantId: result.id, tenantSlug: params.tenantSlug };
  } catch (err) {
    // Log rollback attempt
    if (tenantId) {
      await prisma.tenantProvisioningLog
        .create({
          data: {
            tenantId,
            userId: params.userId,
            step: 'rollback',
            status: 'failed',
            error: String(err),
          },
        })
        .catch(() => null);
    }
    throw err;
  }
}
