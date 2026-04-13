import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requirePlatformRole } from '../../plugins/auth.js';
import { randomBytes } from 'crypto';

export async function platformReferralRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requirePlatformRole(request);
  });

  // GET /api/platform/referrals — aggregate referral stats per referral code (backward compat)
  fastify.get('/', async (_request, reply) => {
    const members = await prisma.earlyAccessMember.findMany({
      where: { referralCode: { not: null } },
      select: {
        id: true,
        email: true,
        name: true,
        referralCode: true,
        status: true,
        createdAt: true,
      },
    });

    // Count signups attributed to each referrer
    const allReferrals = await prisma.earlyAccessMember.groupBy({
      by: ['referredByCode'],
      where: { referredByCode: { not: null } },
      _count: { id: true },
    });

    const onboarded = await prisma.earlyAccessMember.groupBy({
      by: ['referredByCode'],
      where: { referredByCode: { not: null }, status: 'onboarded' },
      _count: { id: true },
    });

    const signupMap = Object.fromEntries(allReferrals.map(r => [r.referredByCode, r._count.id]));
    const onboardedMap = Object.fromEntries(onboarded.map(r => [r.referredByCode, r._count.id]));

    const data = members.map(m => ({
      ...m,
      referralsSignedUp: m.referralCode ? (signupMap[m.referralCode] ?? 0) : 0,
      referralsOnboarded: m.referralCode ? (onboardedMap[m.referralCode] ?? 0) : 0,
    }));

    return reply.send({ data });
  });

  // GET /api/platform/referrals/:code — detail for one referral code (backward compat)
  fastify.get<{ Params: { code: string } }>('/:code', async (request, reply) => {
    const referrer = await prisma.earlyAccessMember.findUnique({
      where: { referralCode: request.params.code },
    });

    const referred = await prisma.earlyAccessMember.findMany({
      where: { referredByCode: request.params.code },
      select: { id: true, email: true, name: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ data: { referrer, referred } });
  });

  // POST /api/platform/referral-codes/generate — generate N codes into ReferralCode table
  fastify.post<{ Body: { count?: number; label?: string; source?: string; expiresAt?: string } }>(
    '/codes/generate',
    async (request, reply) => {
      const { count = 1, label, source = 'platform-admin', expiresAt } = request.body ?? {};
      const n = Math.min(500, Math.max(1, Number(count) || 1));
      const created: string[] = [];

      for (let i = 0; i < n; i++) {
        let code = randomBytes(4).toString('hex').toUpperCase(); // 8 chars
        let attempts = 0;
        while (attempts < 10) {
          const exists = await prisma.referralCode.findUnique({ where: { code } });
          if (!exists) break;
          code = randomBytes(4).toString('hex').toUpperCase();
          attempts++;
        }
        await prisma.referralCode.create({
          data: {
            code,
            status: 'generated',
            label: label ?? `Generated ${new Date().toISOString().slice(0, 10)}`,
            source,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          },
        });
        created.push(code);
      }
      return reply.status(201).send({ data: { codes: created, count: created.length } });
    },
  );

  // GET /api/platform/referral-codes — list with filters
  fastify.get<{ Querystring: { status?: string; source?: string; dateFrom?: string; dateTo?: string; page?: string; pageSize?: string } }>(
    '/codes',
    async (request, reply) => {
      const { status, source, dateFrom, dateTo, page = '1', pageSize = '50' } = request.query;
      const pageNum = Math.max(1, parseInt(page));
      const size = Math.min(200, Math.max(1, parseInt(pageSize)));

      // Auto-expire codes where expiresAt has passed
      await prisma.referralCode.updateMany({
        where: { status: { in: ['generated', 'sent'] }, expiresAt: { lt: new Date() } },
        data: { status: 'expired' },
      });

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (source) where.source = source;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
        if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
      }

      const [codes, total] = await Promise.all([
        prisma.referralCode.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * size, take: size,
        }),
        prisma.referralCode.count({ where }),
      ]);

      return reply.send({ data: codes, meta: { total, page: pageNum, pageSize: size } });
    },
  );

  // PATCH /api/platform/referral-codes/:code/assign — assign to an email (generated → sent)
  fastify.patch<{ Params: { code: string }; Body: { email: string } }>(
    '/codes/:code/assign',
    async (request, reply) => {
      const rc = await prisma.referralCode.findUnique({ where: { code: request.params.code } });
      if (!rc) return reply.status(404).send({ error: 'Code not found' });
      if (rc.status !== 'generated') return reply.status(400).send({ error: 'Code must be in generated status to assign' });

      const updated = await prisma.referralCode.update({
        where: { code: rc.code },
        data: { assignedTo: request.body.email, status: 'sent' },
      });
      return reply.send({ data: updated });
    },
  );

  // POST /api/platform/referral-codes/:code/revoke — revoke a code
  fastify.post<{ Params: { code: string } }>(
    '/codes/:code/revoke',
    async (request, reply) => {
      const rc = await prisma.referralCode.findUnique({ where: { code: request.params.code } });
      if (!rc) return reply.status(404).send({ error: 'Code not found' });
      if (rc.status === 'used') return reply.status(400).send({ error: 'Cannot revoke a used code' });

      const updated = await prisma.referralCode.update({
        where: { code: rc.code },
        data: { status: 'expired', revokedAt: new Date() },
      });
      return reply.send({ data: updated });
    },
  );

  // POST /api/platform/referral-codes/:code/regenerate — regenerate (creates new code, revokes old)
  fastify.post<{ Params: { code: string } }>(
    '/codes/:code/regenerate',
    async (request, reply) => {
      const rc = await prisma.referralCode.findUnique({ where: { code: request.params.code } });
      if (!rc) return reply.status(404).send({ error: 'Code not found' });
      if (rc.status === 'used') return reply.status(400).send({ error: 'Cannot regenerate a used code' });

      // Revoke old
      await prisma.referralCode.update({
        where: { code: rc.code },
        data: { status: 'expired', revokedAt: new Date() },
      });

      // Create new
      let newCode = randomBytes(4).toString('hex').toUpperCase();
      let attempts = 0;
      while (attempts < 10) {
        const exists = await prisma.referralCode.findUnique({ where: { code: newCode } });
        if (!exists) break;
        newCode = randomBytes(4).toString('hex').toUpperCase();
        attempts++;
      }

      const created = await prisma.referralCode.create({
        data: {
          code: newCode,
          status: rc.assignedTo ? 'sent' : 'generated',
          label: rc.label,
          source: rc.source,
          assignedTo: rc.assignedTo,
          expiresAt: rc.expiresAt,
        },
      });

      return reply.status(201).send({ data: created, supersedes: rc.code });
    },
  );

  // GET /api/platform/referral-codes/export — CSV
  fastify.get(
    '/codes/export',
    async (_request, reply) => {
      const codes = await prisma.referralCode.findMany({ orderBy: { createdAt: 'desc' } });
      const rows = codes.map(c => [
        c.code, c.status, c.label ?? '', c.assignedTo ?? '', c.usedBy ?? '',
        c.source ?? '', c.expiresAt?.toISOString() ?? '', c.createdAt.toISOString(),
      ].join(','));
      const csv = ['code,status,label,assigned_to,used_by,source,expires_at,created_at', ...rows].join('\n');
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="referral-codes.csv"');
      return reply.send(csv);
    },
  );

  // DELETE /api/platform/referral-codes/:code — delete generated/expired codes only
  fastify.delete<{ Params: { code: string } }>(
    '/codes/:code',
    async (request, reply) => {
      const rc = await prisma.referralCode.findUnique({ where: { code: request.params.code } });
      if (!rc) return reply.status(404).send({ error: 'Not found' });
      if (!['generated', 'expired'].includes(rc.status)) {
        return reply.status(400).send({ error: 'Only generated or expired codes can be deleted' });
      }
      await prisma.referralCode.delete({ where: { code: rc.code } });
      return reply.status(204).send();
    },
  );
}
