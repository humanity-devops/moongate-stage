import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

async function checkItemAccess(itemId: string, email: string): Promise<{ allowed: boolean; reason?: string }> {
  const item = await prisma.sponsorItem.findUnique({
    where: { id: itemId },
    include: { event: { select: { accessMode: true } } },
  });
  if (!item) return { allowed: false, reason: 'not_found' };

  const effectiveMode = item.itemAccessMode ?? item.event.accessMode;
  if (effectiveMode === 'public') return { allowed: true };

  // Check item-level whitelist grant
  const grant = await prisma.itemAccessGrant.findFirst({
    where: { itemId, email: email.toLowerCase() },
  });
  if (grant) return { allowed: true };

  // Fallback to event-level grant
  const eventGrant = await prisma.eventAccessGrant.findFirst({
    where: { eventId: item.eventId, email: email.toLowerCase() },
  });
  if (eventGrant) return { allowed: true };

  return { allowed: false, reason: 'not_whitelisted' };
}

const submitBidSchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  email: z.string().email(),
  telegram: z.string().optional(),
  whatsapp: z.string().optional(),
  proposedBudget: z.number().positive(),
  currency: z.string().default('USD'),
  notes: z.string().max(2000).optional(),
  customAsks: z.string().max(1000).optional(),
  termsAccepted: z.boolean().refine(v => v === true, 'Terms must be accepted'),
});

export async function publicBidRoutes(fastify: FastifyInstance) {
  // POST /api/public/events/:tenantSlug/:eventSlug/items/:itemSlug/bids
  fastify.post<{
    Params: { tenantSlug: string; eventSlug: string; itemSlug: string };
    Body: unknown;
  }>('/events/:tenantSlug/:eventSlug/items/:itemSlug/bids', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const { tenantSlug, eventSlug, itemSlug } = request.params;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findFirst({
      where: { tenantId: tenant.id, slug: eventSlug, status: 'published' },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const item = await prisma.sponsorItem.findFirst({
      where: {
        eventId: event.id,
        slug: itemSlug,
        visibleToPublic: true,
        status: 'published',
        bidAllowed: true,
      },
      select: {
        id: true, eventId: true, tenantId: true, slug: true, publicTitle: true,
        minimumBid: true, maximumBid: true, reservePrice: true, listPrice: true,
        currency: true, itemAccessMode: true,
      },
    });
    if (!item) throw new NotFoundError('Item', itemSlug);

    const result = submitBidSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid bid data', result.error.format());
    }

    const data = result.data;

    // Validate budget against item pricing constraints
    const minBid = item.minimumBid ? Number(item.minimumBid) : null;
    const maxBid = item.maximumBid ? Number(item.maximumBid) : null;

    if (minBid !== null && data.proposedBudget < minBid) {
      throw new ValidationError(
        `Offer amount must be at least ${data.currency} ${minBid.toLocaleString()} for this package`,
      );
    }
    if (maxBid !== null && data.proposedBudget > maxBid) {
      throw new ValidationError(
        `Offer amount cannot exceed ${data.currency} ${maxBid.toLocaleString()} for this package`,
      );
    }

    // Check item-level access control
    const access = await checkItemAccess(item.id, data.email);
    if (!access.allowed) {
      throw new ValidationError(
        access.reason === 'not_whitelisted'
          ? 'You are not on the access list for this package'
          : 'Package not found',
      );
    }

    // Check/create sponsor contact
    let contact = await prisma.sponsorContact.findFirst({
      where: { email: data.email, tenantId: tenant.id },
    });
    if (!contact) {
      contact = await prisma.sponsorContact.create({
        data: {
          tenantId: tenant.id,
          name: data.contactName,
          email: data.email,
          telegram: data.telegram,
          whatsapp: data.whatsapp,
        },
      });
    }

    // Check/create sponsor company
    let company = await prisma.sponsorCompany.findFirst({
      where: { tenantId: tenant.id, name: data.companyName },
    });
    if (!company) {
      company = await prisma.sponsorCompany.create({
        data: { tenantId: tenant.id, name: data.companyName },
      });
    }

    const bid = await prisma.bid.create({
      data: {
        tenantId: tenant.id,
        eventId: event.id,
        itemId: item.id,
        sponsorContactId: contact.id,
        sponsorCompanyId: company.id,
        status: 'submitted',
        companyName: data.companyName,
        contactName: data.contactName,
        email: data.email,
        telegram: data.telegram,
        whatsapp: data.whatsapp,
        proposedBudget: data.proposedBudget,
        currency: data.currency,
        notes: data.notes,
        customAsks: data.customAsks,
        termsAccepted: data.termsAccepted,
      },
    });

    // Log activity
    await prisma.activityFeedEntry.create({
      data: {
        tenantId: tenant.id,
        eventId: event.id,
        type: 'bid_submitted',
        title: `New private offer from ${data.companyName}`,
        body: `${data.contactName} submitted a bid of ${data.proposedBudget} ${data.currency} for "${item.publicTitle}"`,
        resourceId: bid.id,
        resourceType: 'bid',
      },
    });

    return reply.status(201).send({
      data: {
        id: bid.id,
        status: bid.status,
        message: 'Your private offer has been submitted. Our team will be in touch within 2 business days.',
      },
    });
  });

  // POST /api/public/events/:tenantSlug/:eventSlug/leads
  fastify.post<{
    Params: { tenantSlug: string; eventSlug: string };
    Body: unknown;
  }>('/events/:tenantSlug/:eventSlug/leads', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const { tenantSlug, eventSlug } = request.params;

    const leadSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      companyName: z.string().optional(),
      message: z.string().optional(),
      source: z.string().optional(),
    });

    const result = leadSchema.safeParse(request.body);
    if (!result.success) throw new ValidationError('Invalid lead data');

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findFirst({
      where: { tenantId: tenant.id, slug: eventSlug },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const { name, email, companyName, message, source } = result.data;

    let contact = await prisma.sponsorContact.findFirst({
      where: { email, tenantId: tenant.id },
    });
    if (!contact) {
      contact = await prisma.sponsorContact.create({
        data: { tenantId: tenant.id, name, email },
      });
    }

    let company: { id: string } | null = null;
    if (companyName) {
      company = await prisma.sponsorCompany.findFirst({
        where: { tenantId: tenant.id, name: companyName },
      }) ?? await prisma.sponsorCompany.create({
        data: { tenantId: tenant.id, name: companyName },
      });
    }

    await prisma.sponsorLead.create({
      data: {
        tenantId: tenant.id,
        eventId: event.id,
        contactId: contact.id,
        companyId: company?.id,
        source: source ?? 'organic',
        notes: message,
      },
    });

    return reply.status(201).send({
      data: { message: 'Thank you for your interest! Our team will be in touch soon.' },
    });
  });
}
