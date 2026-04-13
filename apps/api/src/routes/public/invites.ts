import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';

export async function publicInviteRoutes(fastify: FastifyInstance) {
  // POST /api/invites/redeem  — redeem an invite code (early access OR outreach)
  fastify.post<{ Body: unknown }>('/redeem', async (request, reply) => {
    const schema = z.object({
      code: z.string().min(1),
      name: z.string().min(1).max(200).optional(),
      company: z.string().max(200).optional(),
    });
    const data = schema.parse(request.body);

    // Try early access member first
    const earlyMember = await prisma.earlyAccessMember.findUnique({
      where: { inviteCode: data.code },
    });

    if (earlyMember) {
      if (earlyMember.status === 'onboarded') {
        throw new AppError('ALREADY_REDEEMED', 'This invite has already been used.', 409);
      }

      const updated = await prisma.earlyAccessMember.update({
        where: { id: earlyMember.id },
        data: {
          status: 'onboarded',
          onboardedAt: new Date(),
          ...(data.name ? { name: data.name } : {}),
          ...(data.company ? { company: data.company } : {}),
        },
      });

      return reply.send({ type: 'early_access', data: { email: updated.email, status: updated.status } });
    }

    // Try outreach contact
    const outreachContact = await prisma.outreachContact.findUnique({
      where: { inviteCode: data.code },
    });

    if (outreachContact) {
      if (outreachContact.status === 'converted') {
        throw new AppError('ALREADY_REDEEMED', 'This invite has already been used.', 409);
      }

      const updated = await prisma.outreachContact.update({
        where: { id: outreachContact.id },
        data: {
          status: 'converted',
          convertedAt: new Date(),
        },
      });

      return reply.send({ type: 'outreach', data: { email: updated.email, status: updated.status } });
    }

    throw new AppError('INVITE_NOT_FOUND', 'Invite code not found or expired.', 404);
  });

  // POST /api/invites/early-access  — join the waitlist
  fastify.post<{ Body: unknown }>('/early-access', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().max(200).optional(),
      company: z.string().max(200).optional(),
      websiteUrl: z.string().url().max(500).optional(),
      role: z.enum(['organizer', 'sponsor', 'both']).optional(),
      referrer: z.string().max(200).optional(),
      referredByCode: z.string().max(100).optional(), // referral code from another member
      utmSource: z.string().max(100).optional(),
      utmMedium: z.string().max(100).optional(),
      utmCampaign: z.string().max(100).optional(),
      consentAt: z.string().datetime().optional(),
      consentVersion: z.string().max(20).optional(),
    });
    const data = schema.parse(request.body);

    const member = await prisma.earlyAccessMember.upsert({
      where: { email: data.email },
      create: {
        ...data,
        consentAt: data.consentAt ? new Date(data.consentAt) : undefined,
        referredByCode: data.referredByCode ?? undefined,
      },
      update: {
        // If they re-submit, update optional fields but keep existing status
        ...(data.name ? { name: data.name } : {}),
        ...(data.company ? { company: data.company } : {}),
        ...(data.websiteUrl ? { websiteUrl: data.websiteUrl } : {}),
        ...(data.role ? { role: data.role } : {}),
        // Update consent if newly provided
        ...(data.consentAt && !undefined ? { consentAt: new Date(data.consentAt), consentVersion: data.consentVersion } : {}),
      },
    });

    const isNew = member.createdAt.getTime() > Date.now() - 2000;

    return reply.status(isNew ? 201 : 200).send({
      data: { email: member.email, status: member.status },
      alreadyRegistered: !isNew,
    });
  });
}
