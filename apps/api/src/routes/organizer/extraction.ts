import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { createStorageClientFromEnv, generateStorageKey } from '@moongate/storage';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError } from '../../lib/errors.js';
import { enqueueExtraction } from '../../lib/queue.js';

export async function extractionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // ── GET / — list decks for event ──────────────────────────────────────────
  fastify.get<{ Params: { eventId: string } }>('/', async (request, reply) => {
    const user = request.user!;
    const decks = await prisma.sponsorshipDeck.findMany({
      where: { eventId: request.params.eventId, tenantId: user.tenantId },
      include: {
        extractionJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, errorMessage: true, completedAt: true, createdAt: true, aiProvider: true },
        },
        _count: { select: { pageAssets: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ data: decks });
  });

  // ── POST / — upload PDF deck ───────────────────────────────────────────────
  fastify.post<{ Params: { eventId: string } }>('/', async (request, reply) => {
    await requirePermission('upload_deck')(request);
    const user = request.user!;

    const contentType = request.headers['content-type'] ?? '';
    let name = '';
    let fileBuffer: Buffer | null = null;
    let originalFilename = 'deck.pdf';
    let mimeType = 'application/pdf';

    if (contentType.includes('multipart/form-data')) {
      // Real file upload
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'field' && part.fieldname === 'name') {
          name = (part.value as string).trim();
        } else if (part.type === 'file' && part.fieldname === 'file') {
          originalFilename = part.filename || 'deck.pdf';
          mimeType = part.mimetype;
          fileBuffer = await part.toBuffer();
        }
      }
    } else {
      // JSON body (mock/demo mode — no real file)
      const body = request.body as Record<string, unknown>;
      name = String(body?.name ?? '').trim();
    }

    if (!name) {
      return reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'Deck name is required' });
    }

    // Upload to S3 if we have a real file
    let storageKey: string | null = null;
    let fileAssetId: string | undefined;

    if (fileBuffer) {
      const isPdf = mimeType === 'application/pdf' || originalFilename.endsWith('.pdf');
      if (!isPdf) {
        return reply.status(422).send({ error: 'VALIDATION_ERROR', message: 'Only PDF files are accepted' });
      }
      if (fileBuffer.byteLength > 50 * 1024 * 1024) {
        return reply.status(413).send({ error: 'FILE_TOO_LARGE', message: 'Maximum file size is 50MB' });
      }

      try {
        const storage = createStorageClientFromEnv();
        storageKey = generateStorageKey(user.tenantId!, 'decks', originalFilename);
        const uploadUrl = await storage.getSignedUploadUrl({
          key: storageKey,
          contentType: mimeType,
          contentLength: fileBuffer.byteLength,
        });

        // Upload via presigned URL
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mimeType, 'Content-Length': String(fileBuffer.byteLength) },
          body: fileBuffer,
        });

        // Create FileAsset record
        const fileAsset = await prisma.fileAsset.create({
          data: {
            tenantId: user.tenantId!,
            originalName: originalFilename,
            storagePath: storageKey,
            mimeType,
            sizeBytes: BigInt(fileBuffer.byteLength),
            uploadedBy: user.userId,
            isPublic: false,
          },
        });
        fileAssetId = fileAsset.id;
      } catch (err) {
        fastify.log.warn({ err }, 'S3 upload failed; continuing without stored file');
        // Non-fatal: proceed without storage in dev
      }
    }

    // Create deck + job records
    const deck = await prisma.sponsorshipDeck.create({
      data: {
        eventId: request.params.eventId,
        tenantId: user.tenantId!,
        name,
        fileAssetId,
        status: 'pending',
        uploadedBy: user.userId,
      },
    });

    const job = await prisma.extractionJob.create({
      data: {
        deckId: deck.id,
        tenantId: user.tenantId!,
        status: 'pending',
        aiProvider: process.env.AI_PROVIDER ?? 'mock',
      },
    });

    // Enqueue via BullMQ; fall back to inline if Redis not available
    const queued = await enqueueExtraction(job.id, deck.id, storageKey);
    if (!queued) {
      // Run asynchronously without blocking the response
      setImmediate(() => {
        runInlineExtraction(job.id, deck.id, storageKey).catch((err) =>
          fastify.log.error({ err }, 'Inline extraction failed'),
        );
      });
    }

    return reply.status(201).send({ data: deck });
  });

  // ── GET /:deckId — deck detail + latest job status ────────────────────────
  fastify.get<{ Params: { eventId: string; deckId: string } }>(
    '/:deckId',
    async (request, reply) => {
      const user = request.user!;
      const deck = await prisma.sponsorshipDeck.findFirst({
        where: { id: request.params.deckId, eventId: request.params.eventId, tenantId: user.tenantId },
        include: {
          extractionJobs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!deck) throw new NotFoundError('Deck', request.params.deckId);
      return reply.send({ data: deck });
    },
  );

  // ── GET /:deckId/suggestions ───────────────────────────────────────────────
  fastify.get<{ Params: { eventId: string; deckId: string } }>(
    '/:deckId/suggestions',
    async (request, reply) => {
      const user = request.user!;
      const deck = await prisma.sponsorshipDeck.findFirst({
        where: { id: request.params.deckId, eventId: request.params.eventId, tenantId: user.tenantId },
        include: {
          extractionJobs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              suggestions: { orderBy: { createdAt: 'asc' } },
            },
          },
          pageAssets: { orderBy: { pageNumber: 'asc' } },
        },
      });
      if (!deck) throw new NotFoundError('Deck', request.params.deckId);
      return reply.send({ data: deck });
    },
  );

  // ── PATCH /:deckId/suggestions/:suggestionId ───────────────────────────────
  fastify.patch<{
    Params: { eventId: string; deckId: string; suggestionId: string };
    Body: unknown;
  }>('/:deckId/suggestions/:suggestionId', async (request, reply) => {
    await requirePermission('review_ai_suggestions')(request);
    const user = request.user!;

    const schema = z.object({
      status: z.enum(['accepted', 'rejected', 'merged']).optional(),
      reviewNotes: z.string().optional(),
      suggestedData: z.record(z.unknown()).optional(),
    });
    const data = schema.parse(request.body);

    const updated = await prisma.extractionSuggestion.update({
      where: { id: request.params.suggestionId },
      data: {
        ...data,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(data.suggestedData ? { suggestedData: data.suggestedData as any } : {}),
        reviewedBy: user.userId,
        reviewedAt: new Date(),
      },
    });

    return reply.send({ data: updated });
  });

  // ── POST /:deckId/suggestions/bulk-create-items ────────────────────────────
  fastify.post<{
    Params: { eventId: string; deckId: string };
    Body: { suggestionIds: string[] };
  }>('/:deckId/suggestions/bulk-create-items', async (request, reply) => {
    await requirePermission('publish_items')(request);
    const user = request.user!;

    const { suggestionIds } = z.object({
      suggestionIds: z.array(z.string()),
    }).parse(request.body);

    const suggestions = await prisma.extractionSuggestion.findMany({
      where: { id: { in: suggestionIds }, status: 'accepted' },
    });

    const createdItems = [];
    for (const suggestion of suggestions) {
      const data = suggestion.suggestedData as Record<string, unknown>;
      const publicTitle = (data.publicTitle as string) ?? (data.title as string) ?? 'Untitled Item';
      const baseSlug = publicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.sponsorItem.findFirst({ where: { eventId: request.params.eventId, slug } })) {
        slug = `${baseSlug}-${counter++}`;
      }

      const item = await prisma.sponsorItem.create({
        data: {
          eventId: request.params.eventId,
          tenantId: user.tenantId!,
          slug,
          publicTitle,
          shortDescription: data.shortDescription as string | undefined,
          longDescription: data.longDescription as string | undefined,
          category: (data.category as string) ?? 'other',
          mode: (data.mode as string) ?? 'fixed_price',
          currency: (data.currency as string) ?? 'USD',
          listPrice: data.listPrice as number | undefined,
          quantityTotal: data.quantityTotal as number | undefined,
          isExclusive: (data.isExclusive as boolean) ?? false,
          visibleToPublic: (data.visibleToPublic as boolean) ?? false,
          status: 'review_required',
          sourceJobId: suggestion.jobId,
        },
      });

      await prisma.extractionSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'merged', mergedItemId: item.id },
      });

      createdItems.push(item);
    }

    return reply.send({ data: { created: createdItems.length, items: createdItems } });
  });

  // ── POST /:deckId/re-extract — re-run extraction ──────────────────────────
  fastify.post<{ Params: { eventId: string; deckId: string } }>(
    '/:deckId/re-extract',
    async (request, reply) => {
      await requirePermission('upload_deck')(request);
      const user = request.user!;

      const deck = await prisma.sponsorshipDeck.findFirst({
        where: { id: request.params.deckId, eventId: request.params.eventId, tenantId: user.tenantId },
        include: { fileAsset: true },
      });
      if (!deck) throw new NotFoundError('Deck', request.params.deckId);

      // Mark old suggestions as superseded by deleting them
      const oldJob = await prisma.extractionJob.findFirst({
        where: { deckId: deck.id },
        orderBy: { createdAt: 'desc' },
      });
      if (oldJob) {
        await prisma.extractionSuggestion.deleteMany({ where: { jobId: oldJob.id, status: 'pending' } });
      }

      await prisma.sponsorshipDeck.update({ where: { id: deck.id }, data: { status: 'pending' } });

      const job = await prisma.extractionJob.create({
        data: {
          deckId: deck.id,
          tenantId: user.tenantId!,
          status: 'pending',
          aiProvider: process.env.AI_PROVIDER ?? 'mock',
        },
      });

      const storageKey = deck.fileAsset?.storagePath ?? null;
      const queued = await enqueueExtraction(job.id, deck.id, storageKey);
      if (!queued) {
        setImmediate(() => {
          runInlineExtraction(job.id, deck.id, storageKey).catch((err) =>
            fastify.log.error({ err }, 'Inline re-extraction failed'),
          );
        });
      }

      return reply.status(202).send({ data: { jobId: job.id } });
    },
  );
}

// ── Inline extraction (mock / Redis-unavailable fallback) ─────────────────────
async function runInlineExtraction(jobId: string, deckId: string, _storageKey: string | null) {
  // Real extraction runs via BullMQ worker; this fallback always uses mock
  await runMockExtraction(jobId, deckId);
}

async function runMockExtraction(jobId: string, deckId: string) {
  await prisma.extractionJob.update({
    where: { id: jobId },
    data: { status: 'processing', startedAt: new Date() },
  });

  const mockSuggestions = [
    {
      type: 'event_meta',
      confidence: 0.95,
      sourcePageNumbers: [1],
      suggestedData: {
        name: 'ETHMilan 2025',
        tagline: 'The Premier Ethereum Conference in Southern Europe',
        city: 'Milan',
        country: 'Italy',
        expectedAttendees: 800,
      },
    },
    {
      type: 'stats',
      confidence: 0.90,
      sourcePageNumbers: [2],
      suggestedData: {
        expectedAttendees: 800,
        onlineReach: 15000,
        newsletterSubs: 8500,
        internationalPct: 60,
        topicTags: ['Ethereum', 'DeFi', 'L2s', 'ZK'],
      },
    },
    {
      type: 'sponsor_item',
      confidence: 0.92,
      sourcePageNumbers: [4],
      suggestedData: {
        publicTitle: 'Title Sponsor',
        category: 'title_sponsorship',
        mode: 'sealed_bid',
        listPrice: 50000,
        currency: 'USD',
        isExclusive: true,
        quantityTotal: 1,
        shortDescription: 'Exclusive title sponsorship with maximum visibility and keynote slot.',
        benefits: [
          { type: 'stage_access', label: 'Keynote slot', value: '30 minutes' },
          { type: 'logo_placement', label: 'Logo', value: 'Presented by placement' },
          { type: 'pass_count', label: 'Passes', quantity: 10 },
        ],
      },
    },
    {
      type: 'sponsor_item',
      confidence: 0.95,
      sourcePageNumbers: [5],
      suggestedData: {
        publicTitle: 'Premium Sponsor',
        category: 'sponsor_pack',
        mode: 'fixed_price',
        listPrice: 30000,
        currency: 'USD',
        quantityTotal: 3,
        packageTier: 'premium',
        shortDescription: 'Premier brand positioning with main stage panel and 4×4m booth.',
        benefits: [
          { type: 'stage_access', label: 'Panel slot', value: '45 minutes' },
          { type: 'booth_size', label: 'Booth', value: '4×4m' },
          { type: 'pass_count', label: 'Passes', quantity: 6 },
        ],
      },
    },
    {
      type: 'sponsor_item',
      confidence: 0.88,
      sourcePageNumbers: [6],
      suggestedData: {
        publicTitle: 'Silver Sponsor',
        category: 'sponsor_pack',
        mode: 'hybrid',
        listPrice: 20000,
        currency: 'USD',
        quantityTotal: 5,
        packageTier: 'silver',
        shortDescription: 'Strong brand visibility with lightning talk and 3×2m booth.',
        benefits: [
          { type: 'stage_access', label: 'Lightning talk', value: '10 minutes' },
          { type: 'booth_size', label: 'Booth', value: '3×2m' },
          { type: 'pass_count', label: 'Passes', quantity: 4 },
        ],
      },
    },
    {
      type: 'add_on',
      confidence: 0.85,
      sourcePageNumbers: [8],
      suggestedData: {
        publicTitle: 'Coffee Station Sponsor',
        category: 'food_beverage',
        mode: 'fixed_price',
        listPrice: 5000,
        currency: 'USD',
        quantityTotal: 2,
        shortDescription: 'Brand the coffee station serving all 800 attendees.',
      },
    },
    {
      type: 'add_on',
      confidence: 0.82,
      sourcePageNumbers: [8],
      suggestedData: {
        publicTitle: 'Badge / Lanyard Sponsor',
        category: 'badge',
        mode: 'fixed_price',
        listPrice: 7500,
        currency: 'USD',
        isExclusive: true,
        quantityTotal: 1,
        shortDescription: 'Your logo on every attendee badge and lanyard.',
      },
    },
    {
      type: 'contact',
      confidence: 0.78,
      sourcePageNumbers: [10],
      suggestedData: {
        contactEmail: 'sponsors@ethmilan.xyz',
        contactName: 'ETHMilan Sponsorship Team',
        telegram: '@ethmilan_sponsors',
      },
    },
  ];

  for (const s of mockSuggestions) {
    await prisma.extractionSuggestion.create({
      data: {
        jobId,
        deckId,
        type: s.type,
        confidence: s.confidence,
        sourcePageNumbers: s.sourcePageNumbers,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        suggestedData: s.suggestedData as any,
        status: 'pending',
      },
    });
  }

  await prisma.extractionJob.update({
    where: { id: jobId },
    data: { status: 'completed', completedAt: new Date() },
  });

  await prisma.sponsorshipDeck.update({
    where: { id: deckId },
    data: { status: 'completed' },
  });
}
