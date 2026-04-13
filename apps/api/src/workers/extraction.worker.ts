import { Worker } from 'bullmq';
import { PDFParse } from 'pdf-parse';
import { prisma } from '@moongate/db';
import { createAIClient, extractSponsorshipDeck, normalizeToDraftSuggestions } from '@moongate/ai';
import { createStorageClientFromEnv } from '@moongate/storage';
import { getRedisConnectionOptions } from '../lib/queue.js';
import { env } from '../lib/env.js';

async function processExtractionJob(jobId: string, deckId: string, storageKey: string | null) {
  await prisma.extractionJob.update({
    where: { id: jobId },
    data: { status: 'processing', startedAt: new Date() },
  });

  const deck = await prisma.sponsorshipDeck.findUnique({
    where: { id: deckId },
    include: { fileAsset: true },
  });
  if (!deck) throw new Error(`Deck not found: ${deckId}`);

  const key = storageKey ?? deck.fileAsset?.storagePath;
  if (!key) throw new Error('No storage key for deck');

  // Download PDF from S3
  const storage = createStorageClientFromEnv();
  const downloadUrl = await storage.getSignedDownloadUrl(key, 600);
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`Failed to download deck: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Parse PDF text using pdf-parse v2 API
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText({ parsePageInfo: true });
  const rawText: string = parsed.text ?? '';
  // Truncate to ~40k chars (~10k tokens) — sponsorship deck key data is never in the tail
  const deckText = rawText.length > 40000 ? rawText.slice(0, 40000) : rawText;
  const pageCount: number = parsed.total ?? 0;

  await prisma.sponsorshipDeck.update({
    where: { id: deckId },
    data: { pageCount },
  });

  // Run AI extraction
  const aiClient = createAIClient(
    env.AI_PROVIDER,
    env.AI_PROVIDER === 'anthropic'
      ? env.ANTHROPIC_API_KEY
      : env.AI_PROVIDER === 'openai'
      ? env.OPENAI_API_KEY
      : undefined,
  );

  const extraction = await extractSponsorshipDeck(aiClient, deckText);
  const suggestions = normalizeToDraftSuggestions(extraction.output, jobId, deckId);

  for (const s of suggestions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.extractionSuggestion.create({ data: s as any });
  }

  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawOutput: extraction.output as any,
      aiProvider: env.AI_PROVIDER,
    },
  });

  await prisma.sponsorshipDeck.update({
    where: { id: deckId },
    data: { status: 'completed' },
  });
}

export function startExtractionWorker(): Worker {
  const worker = new Worker(
    'pdf-extraction',
    async (job: import('bullmq').Job) => {
      const { jobId, deckId, storageKey } = job.data as {
        jobId: string;
        deckId: string;
        storageKey: string | null;
      };

      try {
        await processExtractionJob(jobId, deckId, storageKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await prisma.extractionJob.update({
          where: { id: jobId },
          data: { status: 'failed', completedAt: new Date(), errorMessage: message },
        }).catch(() => {});
        await prisma.sponsorshipDeck.update({
          where: { id: deckId },
          data: { status: 'failed' },
        }).catch(() => {});
        throw error;
      }
    },
    { connection: getRedisConnectionOptions() },
  );

  worker.on('failed', (job, err) => {
    console.error(`[ExtractionWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    console.log(`[ExtractionWorker] Job ${job.id} completed`);
  });

  return worker;
}

// Export for inline use (mock / Redis-unavailable fallback)
export { processExtractionJob };
