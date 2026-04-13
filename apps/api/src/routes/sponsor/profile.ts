import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireSponsorAuth } from '../../plugins/auth.js';

export async function sponsorProfileRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const user = await requireSponsorAuth(request);

    const [dbUser, contact] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.userId },
        select: { id: true, email: true, name: true, avatarUrl: true, referralCode: true, referredByCode: true, createdAt: true },
      }),
      prisma.sponsorContact.findFirst({
        where: { email: user.email },
        select: { id: true, name: true, phone: true, telegram: true, title: true, company: { select: { id: true, name: true, website: true, industry: true } } },
      }),
    ]);

    return reply.send({ data: { user: dbUser, contact } });
  });

  fastify.patch('/', async (request, reply) => {
    const user = await requireSponsorAuth(request);
    const body = request.body as {
      name?: string;
      phone?: string;
      telegram?: string;
      title?: string;
    };

    await prisma.user.update({
      where: { id: user.userId },
      data: { name: body.name },
    });

    // Update linked sponsor contact if exists
    const contact = await prisma.sponsorContact.findFirst({ where: { email: user.email } });
    if (contact) {
      await prisma.sponsorContact.update({
        where: { id: contact.id },
        data: {
          name: body.name ?? contact.name,
          phone: body.phone,
          telegram: body.telegram,
          title: body.title,
        },
      });
    }

    return reply.send({ data: { ok: true } });
  });
}
