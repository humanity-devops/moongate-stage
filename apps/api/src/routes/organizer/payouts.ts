import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { requireAuth } from '../../plugins/auth.js';
import { logAudit } from '../../lib/audit.js';

export async function organizerPayoutRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => { await requireAuth(request); });

  // GET /api/organizer/payouts — list payouts + summary
  fastify.get<{ Querystring: { status?: string; page?: string; pageSize?: string } }>(
    '/payouts', async (request, reply) => {
      const user = request.user!;
      const { status, page = '1', pageSize = '20' } = request.query;
      const pageNum = Math.max(1, parseInt(page));
      const size = Math.min(100, Math.max(1, parseInt(pageSize)));

      const where: Record<string, unknown> = { tenantId: user.tenantId };
      if (status) where.status = status;

      const [payouts, total, summary] = await Promise.all([
        prisma.payout.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * size, take: size,
          include: { _count: { select: { items: true } } },
        }),
        prisma.payout.count({ where }),
        prisma.order.aggregate({
          where: { tenantId: user.tenantId!, status: 'paid' },
          _sum: { merchantNetAmount: true, total: true },
        }),
      ]);

      // Paid out so far
      const paidOut = await prisma.payout.aggregate({
        where: { tenantId: user.tenantId!, status: 'paid' },
        _sum: { netAmount: true },
      });
      // Orders already in a payout
      const payoutOrderIds = await prisma.payoutItem.findMany({
        where: { payout: { tenantId: user.tenantId! } },
        select: { orderId: true },
      });
      const alreadyPayedOrderIds = new Set(payoutOrderIds.map(p => p.orderId));
      const pendingOrders = await prisma.order.findMany({
        where: { tenantId: user.tenantId!, status: 'paid', payoutItem: null },
        select: { merchantNetAmount: true },
      });
      const yetToPayout = pendingOrders.reduce((s, o) => s + Number(o.merchantNetAmount ?? 0), 0);
      void alreadyPayedOrderIds;

      return reply.send({
        data: payouts,
        meta: { total, page: pageNum, pageSize: size },
        summary: {
          incomeToDate: Number(summary._sum.total ?? 0),
          payoutToDate: Number(paidOut._sum.netAmount ?? 0),
          yetToPayout,
        },
      });
    }
  );

  // GET /api/organizer/payouts/:payoutId
  fastify.get<{ Params: { payoutId: string } }>(
    '/payouts/:payoutId', async (request, reply) => {
      const user = request.user!;
      const payout = await prisma.payout.findFirst({
        where: { id: request.params.payoutId, tenantId: user.tenantId },
        include: {
          items: {
            include: {
              order: {
                select: {
                  id: true, status: true, total: true, merchantNetAmount: true,
                  paidAt: true, currency: true,
                  bid: { select: { companyName: true } },
                  event: { select: { name: true } },
                },
              },
            },
          },
        },
      });
      if (!payout) return reply.status(404).send({ error: 'Not found' });
      return reply.send({ data: payout });
    }
  );

  // POST /api/organizer/payouts — create a new payout from eligible orders
  fastify.post<{ Body: { orderIds?: string[]; notes?: string; reference?: string; periodStart?: string; periodEnd?: string } }>(
    '/payouts', async (request, reply) => {
      const user = request.user!;
      const { orderIds, notes, reference, periodStart, periodEnd } = request.body ?? {};

      // Find all paid orders not yet in a payout, scoped to tenant
      const eligibleWhere: Record<string, unknown> = {
        tenantId: user.tenantId!, status: 'paid', payoutItem: null,
      };
      if (orderIds?.length) eligibleWhere.id = { in: orderIds };

      const orders = await prisma.order.findMany({
        where: eligibleWhere,
        select: { id: true, merchantNetAmount: true, currency: true },
      });
      if (!orders.length) return reply.status(400).send({ error: 'No eligible orders for payout' });

      const currency = orders[0].currency;
      const grossAmount = orders.reduce((s, o) => s + Number(o.merchantNetAmount ?? 0), 0);
      const grossRounded = Math.round(grossAmount * 100) / 100;

      const payout = await prisma.payout.create({
        data: {
          tenantId: user.tenantId!,
          currency,
          grossAmount: grossRounded,
          feeAmount: 0,
          netAmount: grossRounded,
          notes,
          reference,
          periodStart: periodStart ? new Date(periodStart) : undefined,
          periodEnd: periodEnd ? new Date(periodEnd) : undefined,
          items: {
            create: orders.map(o => ({
              orderId: o.id,
              amount: Number(o.merchantNetAmount ?? 0),
            })),
          },
        },
        include: { _count: { select: { items: true } } },
      });

      logAudit({
        tenantId: user.tenantId, userId: user.userId,
        action: 'payout_created', resource: 'payout', resourceId: payout.id,
        after: { orderCount: orders.length, grossAmount: grossRounded },
      });

      return reply.status(201).send({ data: payout });
    }
  );

  // PATCH /api/organizer/payouts/:payoutId — update status/reference
  fastify.patch<{ Params: { payoutId: string }; Body: { status?: string; reference?: string; notes?: string; paidAt?: string } }>(
    '/payouts/:payoutId', async (request, reply) => {
      const user = request.user!;
      const { status, reference, notes, paidAt } = request.body ?? {};
      const payout = await prisma.payout.findFirst({
        where: { id: request.params.payoutId, tenantId: user.tenantId },
      });
      if (!payout) return reply.status(404).send({ error: 'Not found' });

      const validStatuses = ['pending', 'processing', 'paid', 'failed', 'cancelled'];
      if (status && !validStatuses.includes(status)) return reply.status(400).send({ error: 'Invalid status' });

      const updated = await prisma.payout.update({
        where: { id: payout.id },
        data: {
          ...(status ? { status } : {}),
          ...(reference !== undefined ? { reference } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(paidAt ? { paidAt: new Date(paidAt) } : {}),
          ...(status === 'paid' && !payout.paidAt ? { paidAt: new Date() } : {}),
        },
      });

      logAudit({
        tenantId: user.tenantId, userId: user.userId,
        action: 'payout_updated', resource: 'payout', resourceId: payout.id,
        before: { status: payout.status }, after: { status: updated.status },
      });

      return reply.send({ data: updated });
    }
  );
}
