import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { ValidationError, UnauthorizedError } from '../../lib/errors.js';
import { sendEmail } from '../../lib/email.js';
import { magicLinkEmail } from '@moongate/emails';

const SESSION_TTL_DAYS = 30;

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function hashPassword(password: string): string {
  // In production, use bcrypt. Using sha256+salt here for simplicity.
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const computed = createHash('sha256').update(password + salt).digest('hex');
  return computed === hash;
}

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post<{ Body: unknown }>('/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
      tenantSlug: z.string().optional(),
    });
    const { email, password, tenantSlug } = schema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedError('Invalid credentials');

    if (!verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    let membership = null;
    let resolvedTenantSlug = tenantSlug;
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) {
        membership = await prisma.membership.findUnique({
          where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
        });
      }
    }
    // Auto-detect tenant if none provided
    if (!membership) {
      const firstMembership = await prisma.membership.findFirst({
        where: { userId: user.id, isActive: true },
        include: { tenant: true },
      });
      if (firstMembership) {
        membership = firstMembership;
        resolvedTenantSlug = (firstMembership as typeof firstMembership & { tenant: { slug: string } }).tenant.slug;
      }
    }

    return reply.send({
      data: {
        token,
        tenantSlug: resolvedTenantSlug,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          platformRole: user.platformRole,
          membership: membership ? { role: membership.role } : undefined,
        },
      },
    });
  });

  // POST /api/auth/magic-link/request
  fastify.post<{ Body: unknown }>('/magic-link/request', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      tenantSlug: z.string().optional(),
    });
    const { email, tenantSlug } = schema.parse(request.body);

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Only allow known members if tenantSlug given
      if (tenantSlug) {
        return reply.send({ data: { message: 'If this email is registered, a magic link has been sent.' } });
      }
      user = await prisma.user.create({ data: { email, emailVerified: false } });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await prisma.magicLink.create({
      data: { userId: user.id, token, expiresAt },
    });

    // In a real system, send email here with the magic link
    // For dev, log the link
    const magicUrl = `${process.env.AUTH_URL ?? 'http://localhost:3000'}/auth/verify?token=${token}`;
    console.log(`[MAGIC LINK] ${email}: ${magicUrl}`);

    // Send magic link email (fire-and-forget)
    const mlEmail = magicLinkEmail({ email, magicUrl });
    sendEmail({
      to: Array.isArray(mlEmail.to) ? mlEmail.to[0] : mlEmail.to,
      subject: mlEmail.subject,
      html: mlEmail.html,
      text: mlEmail.text,
      template: 'magic_link',
      userId: user.id,
    }).catch(() => {});

    return reply.send({
      data: {
        message: 'If this email is registered, a magic link has been sent.',
        // Only expose in dev
        ...(process.env.NODE_ENV === 'development' ? { _devToken: token, _devUrl: magicUrl } : {}),
      },
    });
  });

  // POST /api/auth/magic-link/verify
  fastify.post<{ Body: unknown }>('/magic-link/verify', async (request, reply) => {
    const schema = z.object({ token: z.string().min(1) });
    const { token } = schema.parse(request.body);

    const link = await prisma.magicLink.findUnique({ where: { token } });
    if (!link || link.usedAt || link.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired magic link');
    }

    await prisma.magicLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });
    await prisma.user.update({ where: { id: link.userId }, data: { emailVerified: true } });

    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: link.userId,
        token: sessionToken,
        expiresAt,
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: link.userId } });

    return reply.send({
      data: {
        token: sessionToken,
        user: { id: user?.id, email: user?.email, name: user?.name },
      },
    });
  });

  // POST /api/auth/logout
  fastify.post<{ Headers: { authorization?: string } }>('/logout', async (request, reply) => {
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7);
      await prisma.session.deleteMany({ where: { token } });
    }
    return reply.send({ data: { message: 'Logged out' } });
  });

  // GET /api/auth/me
  fastify.get('/me', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
    const token = auth.slice(7);
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id, isActive: true },
      include: { tenant: true },
    });

    return reply.send({
      data: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        platformRole: session.user.platformRole,
        memberships: memberships.map(m => ({
          tenantId: m.tenantId,
          tenantSlug: m.tenant.slug,
          tenantName: m.tenant.name,
          role: m.role,
        })),
      },
    });
  });
}
