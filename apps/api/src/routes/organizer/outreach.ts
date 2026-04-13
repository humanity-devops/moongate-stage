import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { NotFoundError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';

export async function organizerOutreachRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // GET /api/organizer/outreach
  fastify.get<{
    Querystring: { status?: string; search?: string; page?: string; pageSize?: string };
  }>('/', async (request, reply) => {
    const user = request.user!;
    const { status, search, page = '1', pageSize = '50' } = request.query;

    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const [total, contacts] = await Promise.all([
      prisma.outreachContact.count({ where: whereClause }),
      prisma.outreachContact.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * size,
        take: size,
      }),
    ]);

    return reply.send({ data: contacts, total, page: pageNum, pageSize: size, totalPages: Math.ceil(total / size) });
  });

  // POST /api/organizer/outreach
  fastify.post<{ Body: unknown }>('/', async (request, reply) => {
    const user = request.user!;

    const schema = z.object({
      name: z.string().min(1).max(200),
      email: z.string().email(),
      company: z.string().max(200).optional(),
      title: z.string().max(200).optional(),
      linkedinUrl: z.string().url().optional(),
      notes: z.string().max(2000).optional(),
      tags: z.array(z.string()).default([]),
    });
    const data = schema.parse(request.body);

    const contact = await prisma.outreachContact.create({
      data: { ...data, tenantId: user.tenantId! },
    });

    return reply.status(201).send({ data: contact });
  });

  // GET /api/organizer/outreach/export — CSV export
  fastify.get('/export', async (request, reply) => {
    const user = request.user!;
    const contacts = await prisma.outreachContact.findMany({
      where: { tenantId: user.tenantId! },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['name', 'email', 'company', 'title', 'linkedinUrl', 'notes', 'status', 'tags'];
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = contacts.map(c =>
      [c.name, c.email, c.company, c.title, c.linkedinUrl, c.notes, c.status, (c.tags ?? []).join(';')]
        .map(escape)
        .join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="contacts.csv"');
    return reply.send(csv);
  });

  // POST /api/organizer/outreach/import — CSV import
  fastify.post<{ Body: { csv: string } }>('/import', async (request, reply) => {
    const user = request.user!;
    const { csv } = request.body as { csv: string };

    if (!csv || typeof csv !== 'string') {
      return reply.status(400).send({ error: 'csv field required' });
    }

    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return reply.status(400).send({ error: 'CSV must have header + at least one row' });

    // Parse header
    const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const nameIdx = rawHeaders.indexOf('name');
    const emailIdx = rawHeaders.indexOf('email');
    const companyIdx = rawHeaders.indexOf('company');
    const titleIdx = rawHeaders.indexOf('title');
    const notesIdx = rawHeaders.indexOf('notes');
    const statusIdx = rawHeaders.indexOf('status');
    const tagsIdx = rawHeaders.indexOf('tags');

    if (nameIdx === -1 || emailIdx === -1) {
      return reply.status(400).send({ error: 'CSV must have "name" and "email" columns' });
    }

    // Helper to parse CSV row (handles quoted fields)
    function parseRow(line: string): string[] {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          fields.push(current); current = '';
        } else {
          current += ch;
        }
      }
      fields.push(current);
      return fields;
    }

    const VALID_STATUSES = ['new', 'contacted', 'responded', 'converted', 'archived'];

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = parseRow(lines[i]);
      const name = fields[nameIdx]?.trim();
      const email = fields[emailIdx]?.trim();
      if (!name || !email) { errors.push(`Row ${i + 1}: missing name or email`); continue; }

      const rawStatus = statusIdx >= 0 ? fields[statusIdx]?.trim() : '';
      const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'new';

      const rawTags = tagsIdx >= 0 ? fields[tagsIdx]?.trim() : '';
      const tags = rawTags ? rawTags.split(';').map(t => t.trim()).filter(Boolean) : [];

      try {
        const existing = await prisma.outreachContact.findFirst({
          where: { tenantId: user.tenantId!, email },
        });
        if (existing) { skipped++; continue; }

        await prisma.outreachContact.create({
          data: {
            tenantId: user.tenantId!,
            name,
            email,
            company: companyIdx >= 0 ? (fields[companyIdx]?.trim() || undefined) : undefined,
            title: titleIdx >= 0 ? (fields[titleIdx]?.trim() || undefined) : undefined,
            notes: notesIdx >= 0 ? (fields[notesIdx]?.trim() || undefined) : undefined,
            status,
            tags,
          },
        });
        created++;
      } catch {
        errors.push(`Row ${i + 1}: failed to create ${email}`);
      }
    }

    return reply.send({ data: { created, skipped, errors } });
  });

  // PATCH /api/organizer/outreach/:contactId
  fastify.patch<{ Params: { contactId: string }; Body: unknown }>(
    '/:contactId',
    async (request, reply) => {
      const user = request.user!;

      const schema = z.object({
        name: z.string().min(1).max(200).optional(),
        company: z.string().max(200).optional(),
        title: z.string().max(200).optional(),
        linkedinUrl: z.string().url().optional(),
        notes: z.string().max(2000).optional(),
        status: z.enum(['new', 'contacted', 'responded', 'converted', 'archived']).optional(),
        tags: z.array(z.string()).optional(),
      });
      const data = schema.parse(request.body);

      const contact = await prisma.outreachContact.findFirst({
        where: { id: request.params.contactId, tenantId: user.tenantId },
      });
      if (!contact) throw new NotFoundError('OutreachContact', request.params.contactId);

      const updated = await prisma.outreachContact.update({
        where: { id: contact.id },
        data: {
          ...data,
          ...(data.status === 'converted' && !contact.convertedAt ? { convertedAt: new Date() } : {}),
        },
      });

      return reply.send({ data: updated });
    },
  );

  // POST /api/organizer/outreach/:contactId/invite  — sends an invite (marks inviteSentAt)
  fastify.post<{ Params: { contactId: string } }>(
    '/:contactId/invite',
    async (request, reply) => {
      const user = request.user!;

      const contact = await prisma.outreachContact.findFirst({
        where: { id: request.params.contactId, tenantId: user.tenantId },
      });
      if (!contact) throw new NotFoundError('OutreachContact', request.params.contactId);

      const updated = await prisma.outreachContact.update({
        where: { id: contact.id },
        data: {
          inviteSentAt: new Date(),
          status: contact.status === 'new' ? 'contacted' : contact.status,
        },
      });

      logAudit({
        tenantId: user.tenantId,
        userId: user.userId,
        action: 'invite_sent',
        resource: 'outreach_contact',
        resourceId: contact.id,
        after: { email: contact.email, inviteCode: contact.inviteCode },
      });

      return reply.send({ data: updated });
    },
  );

  // DELETE /api/organizer/outreach/:contactId
  fastify.delete<{ Params: { contactId: string } }>(
    '/:contactId',
    async (request, reply) => {
      const user = request.user!;

      const contact = await prisma.outreachContact.findFirst({
        where: { id: request.params.contactId, tenantId: user.tenantId },
      });
      if (!contact) throw new NotFoundError('OutreachContact', request.params.contactId);

      await prisma.outreachContact.delete({ where: { id: contact.id } });

      return reply.status(204).send();
    },
  );
}
