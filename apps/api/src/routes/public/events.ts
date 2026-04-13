import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { NotFoundError } from '../../lib/errors.js';

/**
 * Verify access for a private event.
 * Returns null if access is permitted, or an error object if denied.
 */
async function checkEventAccess(
  event: { id: string; accessMode: string },
  request: import('fastify').FastifyRequest,
): Promise<{ code: string; message: string } | null> {
  if (event.accessMode === 'public') return null;

  // Check one-time token in query string
  const query = request.query as Record<string, string>;
  const accessToken = query.access_token;
  if (accessToken) {
    const grant = await prisma.eventAccessGrant.findUnique({
      where: { token: accessToken },
    });
    if (grant && grant.eventId === event.id && (!grant.expiresAt || grant.expiresAt > new Date())) {
      return null; // valid token
    }
  }

  // For email whitelist, check the Authorization header (organizer session token resolves userId → email)
  if (event.accessMode === 'whitelist') {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const session = await prisma.session.findFirst({ where: { token, expiresAt: { gt: new Date() } } });
      if (session) {
        const user = await prisma.user.findUnique({ where: { id: session.userId } });
        if (user) {
          const grant = await prisma.eventAccessGrant.findFirst({
            where: { eventId: event.id, grantType: 'email', email: user.email },
          });
          if (grant) return null;
        }
      }
    }
    return { code: 'ACCESS_DENIED', message: 'This event is private. You need to be invited to view it.' };
  }

  // invite_only / any other mode — require a valid access_token
  return { code: 'ACCESS_REQUIRED', message: 'This event requires an access link to view.' };
}

export async function publicEventRoutes(fastify: FastifyInstance) {
  // GET /api/public/events — public discovery listing (only public events)
  fastify.get<{
    Querystring: {
      search?: string;
      category?: string;
      location?: string;
      dateFrom?: string;
      dateTo?: string;
      sort?: string;
      page?: string;
      pageSize?: string;
    };
  }>('/events', async (request, reply) => {
    const { search, category, location, dateFrom, dateTo, sort = 'startDate', page = '1', pageSize = '24' } = request.query;

    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(50, Math.max(1, parseInt(pageSize)));

    const where: Record<string, unknown> = {
      status: 'published',
      accessMode: 'public',
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { tagline: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (location) where.country = { contains: location, mode: 'insensitive' };
    if (dateFrom) where.startDate = { gte: new Date(dateFrom) };
    if (dateTo) {
      where.startDate = { ...(where.startDate as object ?? {}), lte: new Date(dateTo) };
    }

    const orderBy = sort === 'name'
      ? { name: 'asc' as const }
      : sort === 'createdAt'
      ? { createdAt: 'desc' as const }
      : { startDate: 'asc' as const };

    const [total, events] = await Promise.all([
      prisma.event.count({ where: where as Parameters<typeof prisma.event.count>[0]['where'] }),
      prisma.event.findMany({
        where: where as Parameters<typeof prisma.event.findMany>[0]['where'],
        include: {
          branding: { select: { primaryColor: true, logoUrl: true } },
          tenant: { select: { name: true, slug: true } },
          _count: { select: { sponsorItems: true } },
        },
        orderBy,
        skip: (pageNum - 1) * size,
        take: size,
      }),
    ]);

    return reply.send({
      data: events,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  });

  // POST /api/public/events/:tenantSlug/:eventSlug/access/verify
  fastify.post<{
    Params: { tenantSlug: string; eventSlug: string };
    Body: unknown;
  }>('/events/:tenantSlug/:eventSlug/access/verify', async (request, reply) => {
    const { tenantSlug, eventSlug } = request.params;
    const body = request.body as Record<string, unknown>;
    const accessToken = (body?.token as string) ?? '';

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findFirst({
      where: { tenantId: tenant.id, slug: eventSlug, status: 'published' },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    if (event.accessMode === 'public') {
      return reply.send({ data: { valid: true } });
    }

    const grant = await prisma.eventAccessGrant.findUnique({ where: { token: accessToken } });
    if (!grant || grant.eventId !== event.id || (grant.expiresAt && grant.expiresAt <= new Date())) {
      return reply.status(403).send({ error: 'ACCESS_DENIED', message: 'Invalid or expired access token.' });
    }

    return reply.send({ data: { valid: true } });
  });

  // GET /api/public/events/:tenantSlug/:eventSlug
  fastify.get<{
    Params: { tenantSlug: string; eventSlug: string };
  }>('/events/:tenantSlug/:eventSlug', async (request, reply) => {
    const { tenantSlug, eventSlug } = request.params;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findFirst({
      where: {
        tenantId: tenant.id,
        slug: eventSlug,
        status: 'published',
      },
      include: {
        branding: true,
        stats: true,
        tenant: {
          select: { name: true, slug: true, logoUrl: true },
        },
      },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const denied = await checkEventAccess(event, request);
    if (denied) {
      return reply.status(403).send({
        error: denied.code,
        message: denied.message,
        data: { accessMode: event.accessMode },
      });
    }

    return reply.send({ data: event });
  });

  // GET /api/public/events/:tenantSlug/:eventSlug/items
  fastify.get<{
    Params: { tenantSlug: string; eventSlug: string };
    Querystring: {
      category?: string;
      mode?: string;
      featured?: string;
      page?: string;
      pageSize?: string;
    };
  }>('/events/:tenantSlug/:eventSlug/items', async (request, reply) => {
    const { tenantSlug, eventSlug } = request.params;
    const { category, mode, featured, page = '1', pageSize = '24' } = request.query;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findFirst({
      where: { tenantId: tenant.id, slug: eventSlug, status: 'published' },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const denied = await checkEventAccess(event, request);
    if (denied) return reply.status(403).send({ error: denied.code, message: denied.message });

    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));

    const where: Record<string, unknown> = {
      eventId: event.id,
      visibleToPublic: true,
      status: { in: ['published', 'sold_out'] },
    };
    if (category) where.category = category;
    if (mode) where.mode = mode;
    if (featured === 'true') where.featured = true;

    const [total, items] = await Promise.all([
      prisma.sponsorItem.count({ where }),
      prisma.sponsorItem.findMany({
        where,
        include: {
          benefits: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
        skip: (pageNum - 1) * size,
        take: size,
      }),
    ]);

    // Strip organizer-only fields
    const publicItems = items.map(item => ({
      ...item,
      reservePrice: undefined,
      minimumBid: undefined,
    }));

    return reply.send({
      data: publicItems,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  });

  // GET /api/public/events/:tenantSlug/:eventSlug/items/:slug
  fastify.get<{
    Params: { tenantSlug: string; eventSlug: string; slug: string };
  }>('/events/:tenantSlug/:eventSlug/items/:slug', async (request, reply) => {
    const { tenantSlug, eventSlug, slug } = request.params;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundError('Tenant', tenantSlug);

    const event = await prisma.event.findFirst({
      where: { tenantId: tenant.id, slug: eventSlug, status: 'published' },
    });
    if (!event) throw new NotFoundError('Event', eventSlug);

    const denied = await checkEventAccess(event, request);
    if (denied) return reply.status(403).send({ error: denied.code, message: denied.message });

    const item = await prisma.sponsorItem.findFirst({
      where: {
        eventId: event.id,
        slug,
        visibleToPublic: true,
        status: { in: ['published', 'sold_out'] },
      },
      include: {
        benefits: { orderBy: { sortOrder: 'asc' } },
        assetReqs: true,
      },
    });
    if (!item) throw new NotFoundError('Item', slug);

    // Strip organizer-only fields
    const { reservePrice, minimumBid, ...publicItem } = item;

    return reply.send({ data: publicItem });
  });
}
