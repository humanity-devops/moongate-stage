import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { NotFoundError } from '../../lib/errors.js';

const proposalItemSchema = z.object({
  itemId: z.string().optional(),
  label: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
  sortOrder: z.number().int().default(0),
});

const proposalBodySchema = z.object({
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  companyName: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  packageData: z.unknown().optional(),
  items: z.array(proposalItemSchema).min(1),
  currency: z.string().length(3).default('USD'),
  // 'draft' saves without submitting; 'submitted' triggers review
  status: z.enum(['draft', 'submitted']).default('submitted'),
});

export async function publicProposalRoutes(fastify: FastifyInstance) {
  // POST /api/public/events/:tenantSlug/:eventSlug/proposals
  fastify.post<{
    Params: { tenantSlug: string; eventSlug: string };
    Body: unknown;
  }>('/events/:tenantSlug/:eventSlug/proposals', async (request, reply) => {
    const { tenantSlug, eventSlug } = request.params;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: eventSlug } },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const data = proposalBodySchema.parse(request.body);

    const totalBudget = data.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const proposal = await prisma.proposal.create({
      data: {
        tenantId: tenant.id,
        eventId: event.id,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        companyName: data.companyName,
        notes: data.notes,
        packageData: data.packageData as object | undefined,
        currency: data.currency,
        status: data.status,
        totalBudget,
        items: {
          create: data.items.map((item) => ({
            itemId: item.itemId,
            label: item.label,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.unitPrice * item.quantity,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: { items: true },
    });

    return reply.status(201).send({ data: proposal });
  });

  // GET /api/public/events/:tenantSlug/:eventSlug/proposals/:proposalId
  // (sponsors can look up their own proposal by ID + email)
  fastify.get<{
    Params: { tenantSlug: string; eventSlug: string; proposalId: string };
    Querystring: { email: string };
  }>('/events/:tenantSlug/:eventSlug/proposals/:proposalId', async (request, reply) => {
    const { tenantSlug, eventSlug, proposalId } = request.params;
    const { email } = request.query;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: eventSlug } },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, tenantId: tenant.id, eventId: event.id, contactEmail: email },
      include: { items: true },
    });
    if (!proposal) throw new NotFoundError('Proposal', proposalId);

    return reply.send({ data: proposal });
  });
}
