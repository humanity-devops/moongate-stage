import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireSponsorAuth } from '../../plugins/auth.js';

export async function sponsorMembershipRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const [dbUser, earlyAccess] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.userId },
        select: { referralCode: true, referredByCode: true, createdAt: true },
      }),
      prisma.earlyAccessMember.findUnique({
        where: { email: user.email },
        select: { status: true, referralCode: true, referredByCode: true },
      }),
    ]);

    // Count how many users this person referred
    const referralCount = dbUser?.referralCode
      ? await prisma.user.count({ where: { referredByCode: dbUser.referralCode } })
      : 0;

    return reply.send({
      data: {
        referralCode: dbUser?.referralCode ?? earlyAccess?.referralCode ?? null,
        referredByCode: dbUser?.referredByCode ?? earlyAccess?.referredByCode ?? null,
        referralCount,
        earlyAccessStatus: earlyAccess?.status ?? null,
      },
    });
  });
}
