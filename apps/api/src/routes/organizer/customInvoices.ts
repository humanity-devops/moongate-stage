import { randomBytes } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { logAudit } from '../../lib/audit.js';
import { sendEmail } from '../../lib/email.js';
import { env } from '../../lib/env.js';

const LineSchema = z.object({
  label: z.string().min(1).max(500),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const InvoiceBodySchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  recipientCompany: z.string().optional(),
  currency: z.string().length(3).default('USD'),
  lines: z.array(LineSchema).min(1),
  taxRate: z.number().min(0).max(1).default(0),
  discountAmount: z.number().nonnegative().default(0),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  legalText: z.string().optional(),
});

async function generateInvoiceNumber(tenantId: string, prefix: string): Promise<string> {
  // Count existing invoices for this tenant atomically
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count FROM custom_invoices WHERE tenant_id = ${tenantId}
  `;
  const seq = Number(result[0]?.count ?? 0) + 1;
  // Append 3-char random hex to prevent races between concurrent requests
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${String(seq).padStart(4, '0')}-${suffix}`;
}

export async function organizerCustomInvoiceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => { await requireAuth(request); });

  // GET /api/organizer/custom-invoices
  fastify.get<{ Querystring: { status?: string; page?: string; pageSize?: string } }>(
    '/custom-invoices', async (request, reply) => {
      const user = request.user!;
      const { status, page = '1', pageSize = '20' } = request.query;
      const pageNum = Math.max(1, parseInt(page));
      const size = Math.min(100, Math.max(1, parseInt(pageSize)));
      const where: Record<string, unknown> = { tenantId: user.tenantId };
      if (status) where.status = status;

      const [invoices, total] = await Promise.all([
        prisma.customInvoice.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * size, take: size,
        }),
        prisma.customInvoice.count({ where }),
      ]);
      return reply.send({ data: invoices, meta: { total, page: pageNum, pageSize: size } });
    }
  );

  // GET /api/organizer/custom-invoices/:invoiceId
  fastify.get<{ Params: { invoiceId: string } }>(
    '/custom-invoices/:invoiceId', async (request, reply) => {
      const user = request.user!;
      const inv = await prisma.customInvoice.findFirst({
        where: { id: request.params.invoiceId, tenantId: user.tenantId },
      });
      if (!inv) return reply.status(404).send({ error: 'Not found' });
      return reply.send({ data: inv });
    }
  );

  // POST /api/organizer/custom-invoices — create draft
  fastify.post<{ Body: unknown }>('/custom-invoices', async (request, reply) => {
    const user = request.user!;
    const body = InvoiceBodySchema.parse(request.body);

    // Generate invoice number: use tenant slug + sequence
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId! } });
    const invoiceNumber = await generateInvoiceNumber(user.tenantId!, tenant.slug.toUpperCase());

    const subtotal = body.lines.reduce((s, l) => s + l.total, 0);
    const taxAmount = Math.round(subtotal * body.taxRate * 100) / 100;
    const total = Math.round((subtotal + taxAmount - body.discountAmount) * 100) / 100;

    const inv = await prisma.customInvoice.create({
      data: {
        tenantId: user.tenantId!,
        invoiceNumber,
        recipientEmail: body.recipientEmail,
        recipientName: body.recipientName,
        recipientCompany: body.recipientCompany,
        currency: body.currency,
        lines: body.lines as unknown as import('@moongate/db').Prisma.InputJsonValue,
        subtotal,
        taxRate: body.taxRate,
        taxAmount,
        discountAmount: body.discountAmount,
        total,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        notes: body.notes,
        legalText: body.legalText,
      },
    });

    logAudit({
      tenantId: user.tenantId, userId: user.userId,
      action: 'custom_invoice_created', resource: 'custom_invoice', resourceId: inv.id,
      after: { invoiceNumber, total },
    });

    return reply.status(201).send({ data: inv });
  });

  // PATCH /api/organizer/custom-invoices/:invoiceId — edit draft
  fastify.patch<{ Params: { invoiceId: string }; Body: unknown }>(
    '/custom-invoices/:invoiceId', async (request, reply) => {
      const user = request.user!;
      const inv = await prisma.customInvoice.findFirst({
        where: { id: request.params.invoiceId, tenantId: user.tenantId },
      });
      if (!inv) return reply.status(404).send({ error: 'Not found' });
      if (inv.status !== 'draft') return reply.status(400).send({ error: 'Only draft invoices can be edited' });

      const body = InvoiceBodySchema.partial().parse(request.body);
      const newLines = body.lines ?? (inv.lines as typeof body.lines);
      const subtotal = newLines!.reduce((s, l) => s + l.total, 0);
      const taxRate = body.taxRate ?? Number(inv.taxRate);
      const discountAmount = body.discountAmount ?? Number(inv.discountAmount);
      const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
      const total = Math.round((subtotal + taxAmount - discountAmount) * 100) / 100;

      const updated = await prisma.customInvoice.update({
        where: { id: inv.id },
        data: {
          ...(body.recipientEmail ? { recipientEmail: body.recipientEmail } : {}),
          ...(body.recipientName !== undefined ? { recipientName: body.recipientName } : {}),
          ...(body.recipientCompany !== undefined ? { recipientCompany: body.recipientCompany } : {}),
          ...(body.currency ? { currency: body.currency } : {}),
          ...(body.lines ? { lines: body.lines as unknown as import('@moongate/db').Prisma.InputJsonValue } : {}),
          subtotal, taxRate, taxAmount, discountAmount, total,
          ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.legalText !== undefined ? { legalText: body.legalText } : {}),
        },
      });
      return reply.send({ data: updated });
    }
  );

  // POST /api/organizer/custom-invoices/:invoiceId/send — mark as sent
  fastify.post<{ Params: { invoiceId: string } }>(
    '/custom-invoices/:invoiceId/send', async (request, reply) => {
      const user = request.user!;
      const inv = await prisma.customInvoice.findFirst({
        where: { id: request.params.invoiceId, tenantId: user.tenantId },
      });
      if (!inv) return reply.status(404).send({ error: 'Not found' });
      if (!['draft'].includes(inv.status)) return reply.status(400).send({ error: 'Cannot send this invoice' });

      const updated = await prisma.customInvoice.update({
        where: { id: inv.id },
        data: { status: 'sent', issuedAt: new Date() },
      });

      // Build a simple HTML invoice email (fire-and-forget)
      const lines = inv.lines as Array<{ label: string; quantity: number; unitPrice: number; total: number }>;
      const linesHtml = lines.map(l =>
        `<tr><td style="padding:4px 8px">${l.label}</td><td style="padding:4px 8px;text-align:right">${l.quantity}</td><td style="padding:4px 8px;text-align:right">${inv.currency} ${Number(l.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td style="padding:4px 8px;text-align:right">${inv.currency} ${Number(l.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>`
      ).join('');

      const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111;max-width:600px;margin:0 auto;padding:24px">
<h2 style="margin-bottom:4px">Invoice ${inv.invoiceNumber}</h2>
<p style="color:#666;font-size:14px">Please find your invoice details below.</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
  <thead><tr style="background:#f5f5f5">
    <th style="padding:4px 8px;text-align:left">Description</th>
    <th style="padding:4px 8px;text-align:right">Qty</th>
    <th style="padding:4px 8px;text-align:right">Unit</th>
    <th style="padding:4px 8px;text-align:right">Total</th>
  </tr></thead>
  <tbody>${linesHtml}</tbody>
</table>
<hr style="margin:16px 0"/>
${Number(inv.taxAmount) > 0 ? `<p style="font-size:14px">Subtotal: ${inv.currency} ${Number(inv.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p><p style="font-size:14px">Tax (${(Number(inv.taxRate) * 100).toFixed(1)}%): ${inv.currency} ${Number(inv.taxAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>` : ''}
${Number(inv.discountAmount) > 0 ? `<p style="font-size:14px">Discount: -${inv.currency} ${Number(inv.discountAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>` : ''}
<p style="font-size:16px;font-weight:bold">Total: ${inv.currency} ${Number(inv.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
${inv.dueDate ? `<p style="font-size:13px;color:#666">Due date: ${new Date(inv.dueDate).toLocaleDateString('en-US', { dateStyle: 'long' })}</p>` : ''}
${inv.notes ? `<p style="font-size:13px;color:#444;margin-top:12px">${inv.notes}</p>` : ''}
${inv.legalText ? `<p style="font-size:11px;color:#999;margin-top:16px;border-top:1px solid #eee;padding-top:12px">${inv.legalText}</p>` : ''}
<p style="font-size:12px;color:#999;margin-top:24px">This invoice was sent via Stage by Moongate.</p>
</body></html>`;

      sendEmail({
        to: inv.recipientEmail,
        subject: `Invoice ${inv.invoiceNumber}${inv.recipientCompany ? ` — ${inv.recipientCompany}` : ''}`,
        html,
        template: 'custom_invoice',
        tenantId: user.tenantId,
        resourceId: inv.id,
        resourceType: 'custom_invoice',
        metadata: { invoiceNumber: inv.invoiceNumber, total: Number(inv.total) },
      });

      logAudit({
        tenantId: user.tenantId, userId: user.userId,
        action: 'custom_invoice_sent', resource: 'custom_invoice', resourceId: inv.id,
        after: { recipientEmail: inv.recipientEmail },
      });

      return reply.send({ data: updated });
    }
  );

  // PATCH /api/organizer/custom-invoices/:invoiceId/status — mark paid/cancelled
  fastify.patch<{ Params: { invoiceId: string }; Body: { status: string } }>(
    '/custom-invoices/:invoiceId/status', async (request, reply) => {
      const user = request.user!;
      const { status } = request.body;
      const inv = await prisma.customInvoice.findFirst({
        where: { id: request.params.invoiceId, tenantId: user.tenantId },
      });
      if (!inv) return reply.status(404).send({ error: 'Not found' });
      if (!['paid', 'cancelled'].includes(status)) return reply.status(400).send({ error: 'Invalid status' });

      const updated = await prisma.customInvoice.update({
        where: { id: inv.id },
        data: {
          status,
          ...(status === 'paid' ? { paidAt: new Date() } : {}),
        },
      });

      logAudit({
        tenantId: user.tenantId, userId: user.userId,
        action: 'custom_invoice_status_changed', resource: 'custom_invoice', resourceId: inv.id,
        before: { status: inv.status }, after: { status },
      });

      return reply.send({ data: updated });
    }
  );

  // DELETE /api/organizer/custom-invoices/:invoiceId — delete draft only
  fastify.delete<{ Params: { invoiceId: string } }>(
    '/custom-invoices/:invoiceId', async (request, reply) => {
      const user = request.user!;
      const inv = await prisma.customInvoice.findFirst({
        where: { id: request.params.invoiceId, tenantId: user.tenantId },
      });
      if (!inv) return reply.status(404).send({ error: 'Not found' });
      if (inv.status !== 'draft') return reply.status(400).send({ error: 'Only drafts can be deleted' });
      await prisma.customInvoice.delete({ where: { id: inv.id } });
      return reply.status(204).send();
    }
  );
}
