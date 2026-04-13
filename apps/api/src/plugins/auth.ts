import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '@moongate/db';
import { ROLE_PERMISSIONS } from '@moongate/config';
import type { Permission } from '@moongate/config';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

export interface RequestUser {
  userId: string;
  email: string;
  tenantId?: string;
  role?: string;
  platformRole?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: RequestUser;
    tenantId?: string;
  }
}

export function registerAuthPlugin(fastify: FastifyInstance) {
  // Resolve tenant from subdomain or header
  fastify.addHook('preHandler', async (request) => {
    const tenantSlug =
      (request.query as Record<string, string>)?.tenantSlug ||
      (request.headers['x-tenant-slug'] as string) ||
      (request.hostname?.split('.')[0] !== 'localhost' ? request.hostname?.split('.')[0] : undefined);

    if (tenantSlug && tenantSlug !== 'localhost' && tenantSlug !== 'api' && tenantSlug !== '127') {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
      });
      if (tenant) {
        request.tenantId = tenant.id;
      }
    }
  });
}

export function extractBearerToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function verifySession(token: string): Promise<RequestUser | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    platformRole: session.user.platformRole ?? undefined,
  };
}

export async function requireAuth(request: FastifyRequest): Promise<RequestUser> {
  const token = extractBearerToken(request);
  if (!token) throw new UnauthorizedError('No authorization token provided');

  const user = await verifySession(token);
  if (!user) throw new UnauthorizedError('Invalid or expired session');

  // Resolve tenant membership if tenantId is set
  if (request.tenantId) {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: { userId: user.userId, tenantId: request.tenantId },
      },
    });
    if (membership?.isActive) {
      user.tenantId = request.tenantId;
      user.role = membership.role;
    }
  }

  request.user = user;
  return user;
}

// Requires platform_superadmin or platform_ops role (for platform-level admin routes)
export async function requirePlatformRole(request: FastifyRequest): Promise<RequestUser> {
  const token = extractBearerToken(request);
  if (!token) throw new UnauthorizedError('No authorization token provided');

  const user = await verifySession(token);
  if (!user) throw new UnauthorizedError('Invalid or expired session');

  const allowed = ['platform_superadmin', 'platform_ops'];
  if (!user.platformRole || !allowed.includes(user.platformRole)) {
    throw new ForbiddenError('Platform admin access required');
  }

  request.user = user;
  return user;
}

// Requires a valid session — no tenant membership check (for sponsor portal)
export async function requireSponsorAuth(request: FastifyRequest): Promise<RequestUser> {
  const token = extractBearerToken(request);
  if (!token) throw new UnauthorizedError('No authorization token provided');

  const user = await verifySession(token);
  if (!user) throw new UnauthorizedError('Invalid or expired session');

  request.user = user;
  return user;
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest) => {
    const user = request.user;
    if (!user) throw new UnauthorizedError();

    // Platform superadmin bypasses all
    if (user.platformRole === 'platform_superadmin') return;

    const role = user.role as keyof typeof ROLE_PERMISSIONS;
    if (!role) throw new ForbiddenError();

    const perms = ROLE_PERMISSIONS[role] ?? [];
    if (!perms.includes(permission)) {
      throw new ForbiddenError(`Permission '${permission}' required`);
    }
  };
}
