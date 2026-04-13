import type { FastifyInstance } from 'fastify';
import { prisma } from '@moongate/db';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../plugins/auth.js';
import { NotFoundError } from '../../lib/errors.js';
import { logAudit } from '../../lib/audit.js';
import { trackEvent } from '../../lib/analytics.js';
import { getSignedDownloadUrl } from '../../lib/storage.js';

const KycFieldSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  type: z.enum(['text', 'textarea', 'file', 'select', 'url', 'email']),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(), // for select type
  placeholder: z.string().optional(),
});

export async function organizerKycRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await requireAuth(request);
  });

  // GET /api/organizer/kyc/config
  fastify.get('/config', async (request, reply) => {
    const user = request.user!;
    const config = await prisma.kycConfig.findUnique({
      where: { tenantId: user.tenantId! },
    });
    return reply.send({ data: config ?? { fields: [] } });
  });

  // PUT /api/organizer/kyc/config
  fastify.put<{ Body: unknown }>('/config', async (request, reply) => {
    await requirePermission('manage_inventory')(request);
    const user = request.user!;

    const schema = z.object({
      fields: z.array(KycFieldSchema),
    });
    const { fields } = schema.parse(request.body);

    const existing = await prisma.kycConfig.findUnique({ where: { tenantId: user.tenantId! } });

    const config = existing
      ? await prisma.kycConfig.update({
          where: { tenantId: user.tenantId! },
          data: { fields: fields as object },
        })
      : await prisma.kycConfig.create({
          data: {
            tenantId: user.tenantId!,
            fields: fields as object,
          },
        });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'kyc_config_updated',
      resource: 'kyc_config',
      resourceId: config.id,
      after: { fieldCount: fields.length },
      request,
    });

    return reply.send({ data: config });
  });

  // GET /api/organizer/kyc/submissions
  fastify.get<{
    Querystring: { status?: string; bidId?: string; orderId?: string };
  }>('/submissions', async (request, reply) => {
    const user = request.user!;
    const { status, bidId, orderId } = request.query;

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (bidId) where.bidId = bidId;
    if (orderId) where.orderId = orderId;

    const submissions = await prisma.kycSubmission.findMany({
      where: where as Parameters<typeof prisma.kycSubmission.findMany>[0]['where'],
      include: {
        config: { select: { fields: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ data: submissions });
  });

  // GET /api/organizer/kyc/submissions/:submissionId
  fastify.get<{ Params: { submissionId: string } }>(
    '/submissions/:submissionId',
    async (request, reply) => {
      const user = request.user!;
      const submission = await prisma.kycSubmission.findFirst({
        where: { id: request.params.submissionId, tenantId: user.tenantId! },
        include: { config: true },
      });
      if (!submission) throw new NotFoundError('KYC Submission', request.params.submissionId);
      return reply.send({ data: submission });
    },
  );

  // PATCH /api/organizer/kyc/submissions/:submissionId/review
  fastify.patch<{
    Params: { submissionId: string };
    Body: unknown;
  }>('/submissions/:submissionId/review', async (request, reply) => {
    await requirePermission('manage_bids')(request);
    const user = request.user!;

    const schema = z.object({
      status: z.enum(['approved', 'rejected', 'needs_more_info']),
      reviewNotes: z.string().max(2000).optional(),
    });
    const { status, reviewNotes } = schema.parse(request.body);

    const submission = await prisma.kycSubmission.findFirst({
      where: { id: request.params.submissionId, tenantId: user.tenantId! },
    });
    if (!submission) throw new NotFoundError('KYC Submission', request.params.submissionId);

    const fromStatus = submission.status;
    const updated = await prisma.kycSubmission.update({
      where: { id: submission.id },
      data: {
        status,
        reviewNotes: reviewNotes ?? null,
        reviewedBy: user.userId,
        reviewedAt: new Date(),
      },
    });

    // Create structured audit entry in KycAuditEntry
    await prisma.kycAuditEntry.create({
      data: {
        submissionId: submission.id,
        action: 'status_changed',
        actorId: user.userId,
        actorName: user.email,
        fromStatus,
        toStatus: status,
        reason: reviewNotes ?? null,
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.userId,
      action: `kyc_${status}`,
      resource: 'kyc_submission',
      resourceId: submission.id,
      before: { status: fromStatus },
      after: { status, reviewNotes },
      request,
    });

    trackEvent({
      eventType: 'kyc_status_changed',
      tenantId: user.tenantId,
      userId: user.userId,
      resourceId: submission.id,
      resourceType: 'kyc_submission',
      metadata: { fromStatus, toStatus: status },
      request,
    });

    return reply.send({ data: updated });
  });

  // POST /api/organizer/kyc/submissions/:id/notes
  fastify.post<{ Params: { id: string }; Body: unknown }>(
    '/submissions/:id/notes',
    async (request, reply) => {
      const user = request.user!;

      const schema = z.object({
        content: z.string().min(1).max(2000),
        isInternal: z.boolean().default(true),
      });
      const { content, isInternal } = schema.parse(request.body);

      const submission = await prisma.kycSubmission.findFirst({
        where: { id: request.params.id, tenantId: user.tenantId! },
      });
      if (!submission) throw new NotFoundError('KYC Submission', request.params.id);

      // Resolve author name from membership
      const membership = await prisma.membership.findUnique({
        where: { userId_tenantId: { userId: user.userId, tenantId: user.tenantId! } },
        include: { user: { select: { name: true } } },
      });
      const authorName = membership?.user?.name ?? user.email;

      const note = await prisma.kycNote.create({
        data: {
          submissionId: submission.id,
          authorId: user.userId,
          authorName,
          content,
          isInternal,
        },
      });

      await prisma.kycAuditEntry.create({
        data: {
          submissionId: submission.id,
          action: 'note_added',
          actorId: user.userId,
          actorName: authorName,
          metadata: { noteId: note.id, isInternal },
        },
      });

      trackEvent({
        eventType: 'kyc_note_added',
        tenantId: user.tenantId,
        userId: user.userId,
        resourceId: submission.id,
        resourceType: 'kyc_submission',
        request,
      });

      return reply.status(201).send({ data: note });
    },
  );

  // GET /api/organizer/kyc/submissions/:submissionId/files/download-all
  // NOTE: must be registered before /:submissionId/files/:fileAssetId/download
  // so Fastify matches the literal "download-all" segment first.
  fastify.get<{ Params: { submissionId: string } }>(
    '/submissions/:submissionId/files/download-all', async (request, reply) => {
      const user = request.user!;

      const sub = await prisma.kycSubmission.findFirst({
        where: { id: request.params.submissionId, tenantId: user.tenantId },
        include: { config: true },
      });
      if (!sub) return reply.status(404).send({ error: 'Not found' });

      const data = sub.data as Record<string, unknown> ?? {};
      const config = sub.config;
      const fields = (config?.fields as Array<{ key: string; type: string; label: string }>) ?? [];
      const fileFields = fields.filter(f => f.type === 'file');
      const assetIds = fileFields
        .map(f => data[f.key])
        .filter(v => typeof v === 'string') as string[];

      if (!assetIds.length) return reply.status(404).send({ error: 'No files found' });

      const assets = await prisma.fileAsset.findMany({
        where: { id: { in: assetIds }, tenantId: user.tenantId },
      });
      if (!assets.length) return reply.status(404).send({ error: 'No files accessible' });

      logAudit({
        tenantId: user.tenantId, userId: user.userId,
        action: 'kyc_files_bulk_downloaded', resource: 'kyc_submission', resourceId: sub.id,
        after: { fileCount: assets.length },
      });

      // Stream ZIP response
      const archiver = (await import('archiver')).default;
      const archive = archiver('zip', { zlib: { level: 6 } });

      reply.raw.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="kyc-${sub.id.slice(-8)}.zip"`,
        'Transfer-Encoding': 'chunked',
      });

      archive.pipe(reply.raw);

      for (const asset of assets) {
        try {
          const url = await getSignedDownloadUrl(asset.storagePath, 60);
          const resp = await fetch(url);
          if (resp.ok && resp.body) {
            // Convert Web ReadableStream to Node.js Readable
            const { Readable } = await import('stream');
            const nodeStream = Readable.fromWeb(resp.body as import('stream/web').ReadableStream);
            archive.append(nodeStream, { name: asset.originalName });
          }
        } catch {
          // Skip files that fail to fetch — ZIP will still complete
        }
      }

      await archive.finalize();
    }
  );

  // GET /api/organizer/kyc/submissions/:submissionId/files
  fastify.get<{ Params: { submissionId: string } }>(
    '/submissions/:submissionId/files',
    async (request, reply) => {
      const user = request.user!;

      const sub = await prisma.kycSubmission.findFirst({
        where: { id: request.params.submissionId, tenantId: user.tenantId! },
        include: { config: true },
      });
      if (!sub) return reply.status(404).send({ error: 'Not found' });

      const data = (sub.data as Record<string, unknown>) ?? {};
      const config = sub.config;
      const fields = (config?.fields as Array<{ key: string; type: string; label: string }>) ?? [];
      const fileFields = fields.filter(f => f.type === 'file');

      const fileEntries: Array<{
        fieldKey: string;
        fieldLabel: string;
        fileAssetId: string | null;
        value: unknown;
      }> = [];

      for (const field of fileFields) {
        const value = data[field.key];
        fileEntries.push({
          fieldKey: field.key,
          fieldLabel: field.label,
          fileAssetId: typeof value === 'string' ? value : null,
          value,
        });
      }

      const assetIds = fileEntries.map(f => f.fileAssetId).filter(Boolean) as string[];
      const assets =
        assetIds.length > 0
          ? await prisma.fileAsset.findMany({
              where: { id: { in: assetIds }, tenantId: user.tenantId! },
              select: {
                id: true,
                originalName: true,
                mimeType: true,
                sizeBytes: true,
                publicUrl: true,
                storagePath: true,
                createdAt: true,
              },
            })
          : [];

      const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));

      const result = fileEntries.map(f => ({
        ...f,
        asset: f.fileAssetId ? (assetMap[f.fileAssetId] ?? null) : null,
      }));

      return reply.send({ data: result });
    },
  );

  // GET /api/organizer/kyc/submissions/:submissionId/files/:fileAssetId/download
  fastify.get<{ Params: { submissionId: string; fileAssetId: string } }>(
    '/submissions/:submissionId/files/:fileAssetId/download',
    async (request, reply) => {
      const user = request.user!;

      const sub = await prisma.kycSubmission.findFirst({
        where: { id: request.params.submissionId, tenantId: user.tenantId! },
      });
      if (!sub) return reply.status(404).send({ error: 'Not found' });

      const asset = await prisma.fileAsset.findFirst({
        where: { id: request.params.fileAssetId, tenantId: user.tenantId! },
      });
      if (!asset) return reply.status(404).send({ error: 'File not found' });

      logAudit({
        tenantId: user.tenantId,
        userId: user.userId,
        action: 'kyc_file_downloaded',
        resource: 'file_asset',
        resourceId: asset.id,
        after: { submissionId: sub.id, fileName: asset.originalName },
      });

      if (asset.isPublic && asset.publicUrl) {
        return reply.redirect(302, asset.publicUrl);
      }

      try {
        const signedUrl = await getSignedDownloadUrl(asset.storagePath, 900);
        return reply.send({
          data: { url: signedUrl, expiresInSeconds: 900, fileName: asset.originalName },
        });
      } catch {
        return reply.send({
          data: { url: asset.publicUrl ?? asset.storagePath, fileName: asset.originalName },
        });
      }
    },
  );

  // GET /api/organizer/kyc/submissions/:id/timeline
  fastify.get<{ Params: { id: string } }>(
    '/submissions/:id/timeline',
    async (request, reply) => {
      const user = request.user!;

      const submission = await prisma.kycSubmission.findFirst({
        where: { id: request.params.id, tenantId: user.tenantId! },
      });
      if (!submission) throw new NotFoundError('KYC Submission', request.params.id);

      const [notes, auditEntries] = await Promise.all([
        prisma.kycNote.findMany({
          where: { submissionId: submission.id },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.kycAuditEntry.findMany({
          where: { submissionId: submission.id },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      const timeline = [
        ...notes.map(n => ({ type: 'note' as const, ...n })),
        ...auditEntries.map(a => ({ type: 'audit' as const, ...a })),
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      return reply.send({ data: { notes, auditEntries, timeline } });
    },
  );
}

/**
 * Create a KYC submission when a bid is accepted.
 * Call this after creating the order in the bid accept flow.
 */
export async function createKycSubmissionForBid(
  tenantId: string,
  bidId: string,
  orderId: string,
  contactId?: string,
): Promise<void> {
  const config = await prisma.kycConfig.findUnique({ where: { tenantId } });
  if (!config) return; // no KYC config for this tenant

  // Skip if already exists
  const existing = await prisma.kycSubmission.findUnique({ where: { bidId } });
  if (existing) return;

  await prisma.kycSubmission.create({
    data: {
      tenantId,
      kycConfigId: config.id,
      bidId,
      orderId,
      contactId: contactId ?? null,
      status: 'not_started',
    },
  });
}
