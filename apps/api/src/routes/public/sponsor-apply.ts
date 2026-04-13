import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { ConflictError, ValidationError, NotFoundError } from '../../lib/errors.js';
import { sendEmail } from '../../lib/email.js';
import {
  sponsorApplicationReceivedEmail,
  sponsorApplicationApprovedEmail,
} from '@moongate/emails';
import { logAudit } from '../../lib/audit.js';
import { trackEvent } from '../../lib/analytics.js';
import { requirePlatformRole } from '../../plugins/auth.js';
import { env } from '../../lib/env.js';

const VERIFY_TTL_MINUTES = 60;

/** Normalize EmailMessage.to (string | string[]) to string for SendEmailParams */
function toStr(to: string | string[]): string {
  return Array.isArray(to) ? to[0] : to;
}

export async function sponsorApplyRoutes(fastify: FastifyInstance) {
  // POST /api/public/sponsor/apply
  fastify.post<{ Body: unknown }>('/apply', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1).max(200),
      email: z.string().email(),
      company: z.string().max(200).optional(),
      websiteUrl: z.string().url().optional().or(z.literal('')),
      role: z.enum(['sponsor', 'both']).default('sponsor'),
      termsAccepted: z.boolean().refine(v => v === true, 'Terms must be accepted'),
      referredByCode: z.string().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
    });

    const result = schema.safeParse(request.body);
    if (!result.success) throw new ValidationError('Invalid application data', result.error.format());
    const data = result.data;

    // Idempotent: if already applied, return same response
    const existing = await prisma.sponsorApplication.findUnique({ where: { email: data.email } });
    if (existing) {
      if (existing.status === 'active') {
        throw new ConflictError('An account with this email already exists. Please sign in.');
      }
      // Re-send verification if not yet verified
      if (existing.status === 'submitted' && !existing.emailVerifiedAt) {
        const token = randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + VERIFY_TTL_MINUTES * 60 * 1000);
        await prisma.sponsorApplication.update({
          where: { id: existing.id },
          data: { emailVerifyToken: token, emailVerifyExpiry: expiry },
        });
        const verifyUrl = `${env.APP_URL}/verify-application?token=${token}`;
        const reEmail = sponsorApplicationReceivedEmail({ name: existing.name, email: existing.email, appUrl: verifyUrl });
        sendEmail({
          to: toStr(reEmail.to),
          subject: reEmail.subject,
          html: reEmail.html,
          text: reEmail.text,
          template: 'sponsor_application_received',
          resourceId: existing.id,
          resourceType: 'sponsor_application',
        }).catch(() => {});
      }
      return reply.send({ data: { message: 'Application received. Please check your email.' } });
    }

    const token = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + VERIFY_TTL_MINUTES * 60 * 1000);

    const application = await prisma.sponsorApplication.create({
      data: {
        email: data.email,
        name: data.name,
        company: data.company ?? null,
        websiteUrl: data.websiteUrl || null,
        role: data.role,
        termsAccepted: true,
        consentAt: new Date(),
        consentVersion: '1.0',
        status: 'submitted',
        emailVerifyToken: token,
        emailVerifyExpiry: expiry,
        referredByCode: data.referredByCode ?? null,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        referrer: (request.headers['referer'] as string) ?? null,
      },
    });

    const verifyUrl = `${env.APP_URL}/verify-application?token=${token}`;
    const newAppEmail = sponsorApplicationReceivedEmail({ name: data.name, email: data.email, appUrl: verifyUrl });
    sendEmail({
      to: toStr(newAppEmail.to),
      subject: newAppEmail.subject,
      html: newAppEmail.html,
      text: newAppEmail.text,
      template: 'sponsor_application_received',
      resourceId: application.id,
      resourceType: 'sponsor_application',
    }).catch(() => {});

    trackEvent({
      eventType: 'signup_submitted',
      metadata: { email: data.email, role: data.role, utmSource: data.utmSource },
      request,
    });

    return reply.status(201).send({
      data: { message: 'Application received. Please check your email to verify your address.' },
    });
  });

  // POST /api/public/sponsor/verify-email
  fastify.post<{ Body: unknown }>('/verify-email', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const schema = z.object({ token: z.string().min(1) });
    const { token } = schema.parse(request.body);

    const application = await prisma.sponsorApplication.findUnique({
      where: { emailVerifyToken: token },
    });

    if (
      !application ||
      !application.emailVerifyExpiry ||
      application.emailVerifyExpiry < new Date()
    ) {
      throw new ValidationError('Invalid or expired verification link. Please request a new one.');
    }

    if (application.emailVerifiedAt) {
      return reply.send({
        data: { message: 'Email already verified. Your application is under review.' },
      });
    }

    await prisma.sponsorApplication.update({
      where: { id: application.id },
      data: { emailVerifiedAt: new Date(), status: 'email_verified', emailVerifyToken: null },
    });

    trackEvent({
      eventType: 'email_verified',
      metadata: { applicationId: application.id },
      request,
    });

    return reply.send({
      data: {
        message:
          "Email verified. Your application is under review. We'll notify you when it's approved.",
      },
    });
  });

  // GET /api/public/sponsor/application-status/:email
  fastify.get<{ Params: { email: string } }>('/application-status/:email', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const application = await prisma.sponsorApplication.findUnique({
      where: { email: request.params.email },
      select: { status: true, emailVerifiedAt: true, createdAt: true },
    });
    if (!application) throw new NotFoundError('Application', request.params.email);
    return reply.send({ data: application });
  });
}

// Platform admin: review queue
export async function sponsorApplicationAdminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requirePlatformRole(request);
  });

  // GET /api/platform/applications
  fastify.get<{
    Querystring: { status?: string; page?: string; pageSize?: string };
  }>('/', async (request, reply) => {
    const { status, page = '1', pageSize = '50' } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [applications, total] = await Promise.all([
      prisma.sponsorApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(pageSize),
      }),
      prisma.sponsorApplication.count({ where }),
    ]);

    return reply.send({ data: applications, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  });

  // PATCH /api/platform/applications/:id — approve or reject
  fastify.patch<{ Params: { id: string }; Body: unknown }>('/:id', async (request, reply) => {
    const user = request.user!;
    const schema = z.object({
      action: z.enum(['approve', 'reject']),
      adminNotes: z.string().optional(),
      rejectionReason: z.string().optional(),
    });

    const { action, adminNotes, rejectionReason } = schema.parse(request.body);

    const application = await prisma.sponsorApplication.findUnique({
      where: { id: request.params.id },
    });
    if (!application) throw new NotFoundError('Application', request.params.id);

    if (!['email_verified', 'submitted'].includes(application.status)) {
      throw new ConflictError(`Application is already ${application.status}`);
    }

    if (action === 'reject') {
      await prisma.sponsorApplication.update({
        where: { id: application.id },
        data: {
          status: 'rejected',
          reviewedBy: user.userId,
          reviewedAt: new Date(),
          adminNotes: adminNotes ?? null,
          rejectionReason: rejectionReason ?? null,
        },
      });

      logAudit({
        userId: user.userId,
        action: 'reject',
        resource: 'sponsor_application',
        resourceId: application.id,
      });
      return reply.send({ data: { status: 'rejected' } });
    }

    // Approve: create User account
    function generateToken() {
      return randomBytes(32).toString('hex');
    }

    const newUser = await prisma.$transaction(async (tx) => {
      // Create or find user
      let user2 = await tx.user.findUnique({ where: { email: application.email } });
      if (!user2) {
        user2 = await tx.user.create({
          data: {
            email: application.email,
            name: application.name,
            emailVerified: true,
            referredByCode: application.referredByCode ?? null,
          },
        });
      }

      await tx.sponsorApplication.update({
        where: { id: application.id },
        data: {
          status: 'approved',
          userId: user2.id,
          reviewedBy: user.userId,
          reviewedAt: new Date(),
          adminNotes: adminNotes ?? null,
        },
      });

      return user2;
    });

    // Send approval email with magic link
    const token = generateToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.magicLink.create({
      data: { userId: newUser.id, token, expiresAt: expiry },
    });
    const loginUrl = `${env.APP_URL}/auth/verify?token=${token}`;

    const approvedEmail = sponsorApplicationApprovedEmail({ name: application.name, email: application.email, loginUrl });
    sendEmail({
      to: toStr(approvedEmail.to),
      subject: approvedEmail.subject,
      html: approvedEmail.html,
      text: approvedEmail.text,
      template: 'sponsor_application_approved',
      userId: newUser.id,
      resourceId: application.id,
      resourceType: 'sponsor_application',
    }).catch(() => {});

    trackEvent({
      eventType: 'application_approved',
      metadata: { applicationId: application.id, userId: newUser.id },
    });
    logAudit({
      userId: user.userId,
      action: 'approve',
      resource: 'sponsor_application',
      resourceId: application.id,
      after: { userId: newUser.id },
    });

    return reply.send({ data: { status: 'approved', userId: newUser.id } });
  });
}
