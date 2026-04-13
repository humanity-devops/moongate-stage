import { createStorageClientFromEnv, generateStorageKey } from '@moongate/storage';

// Re-export utility so callers don't need to import from the package directly
export { generateStorageKey };

let _client: ReturnType<typeof createStorageClientFromEnv> | null = null;

function getClient() {
  if (_client) return _client;
  _client = createStorageClientFromEnv();
  return _client;
}

/**
 * Generate a pre-signed download URL for an object in S3/MinIO.
 * @param storagePath - the object key in the bucket
 * @param expiresInSeconds - URL TTL (default 900 = 15 min)
 */
export async function getSignedDownloadUrl(
  storagePath: string,
  expiresInSeconds = 900,
): Promise<string> {
  return getClient().getSignedDownloadUrl(storagePath, expiresInSeconds);
}

/**
 * Generate a pre-signed upload URL (PUT) for direct browser → S3 uploads.
 * @param storagePath - destination object key
 * @param mimeType - Content-Type for the upload
 * @param expiresInSeconds - URL TTL (default 300 = 5 min)
 */
export async function getSignedUploadUrl(
  storagePath: string,
  mimeType: string,
  expiresInSeconds = 300,
): Promise<string> {
  return getClient().getSignedUploadUrl({ key: storagePath, contentType: mimeType }, expiresInSeconds);
}

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function validateUpload(mimeType: string, sizeBytes: number): { ok: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: `File type ${mimeType} is not allowed` };
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` };
  }
  return { ok: true };
}

export type ScanResult = { clean: boolean; threat?: string };

/**
 * Scan a file for malware after upload.
 * - If MALWARE_SCAN_ENDPOINT is set, POSTs the storage path for scanning.
 * - Otherwise returns clean (dev mode).
 * Fire-and-forget: call without await; errors are logged, not thrown.
 */
export async function scanFileAsync(
  storagePath: string,
  fileAssetId: string,
  onThreat?: (result: ScanResult) => Promise<void>,
): Promise<void> {
  const endpoint = process.env.MALWARE_SCAN_ENDPOINT;
  if (!endpoint) {
    // Dev mode: no scanner configured — log and treat as clean
    console.debug(`[storage] scan skipped (no MALWARE_SCAN_ENDPOINT): ${storagePath}`);
    return;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: storagePath, fileAssetId }),
    });
    const result: ScanResult = res.ok ? await res.json() : { clean: true };

    if (!result.clean) {
      console.warn(`[storage] THREAT DETECTED in ${storagePath}: ${result.threat}`);
      if (onThreat) await onThreat(result);
    }
  } catch (err) {
    console.error(`[storage] scan error for ${storagePath}:`, err instanceof Error ? err.message : err);
    // Fail open — do not block upload on scanner error
  }
}

/**
 * Quarantine a file asset by flagging it in the DB.
 * Call this as the `onThreat` handler.
 */
export async function quarantineFileAsset(fileAssetId: string, threat: string): Promise<void> {
  const { prisma } = await import('@moongate/db');
  await prisma.fileAsset.update({
    where: { id: fileAssetId },
    data: {
      metadata: { quarantined: true, threat, quarantinedAt: new Date().toISOString() } as object,
      isPublic: false,
    },
  }).catch(e => console.error('[storage] quarantine update failed:', e?.message));
}
