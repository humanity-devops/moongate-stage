import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  publicUrl?: string;
}

export interface UploadOptions {
  key: string;
  contentType: string;
  contentLength?: number;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

export interface StorageClient {
  getSignedUploadUrl(options: UploadOptions, expiresIn?: number): Promise<string>;
  getSignedDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): string;
  delete(key: string): Promise<void>;
}

export function createStorageClient(config: StorageConfig): StorageClient {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true, // Required for MinIO
  });

  return {
    async getSignedUploadUrl(options, expiresIn = 3600) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: options.key,
        ContentType: options.contentType,
        ...(options.contentLength ? { ContentLength: options.contentLength } : {}),
        ...(options.isPublic ? { ACL: 'public-read' } : {}),
        ...(options.metadata ? { Metadata: options.metadata } : {}),
      });
      return getSignedUrl(client, command, { expiresIn });
    },

    async getSignedDownloadUrl(key, expiresIn = 3600) {
      const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
      return getSignedUrl(client, command, { expiresIn });
    },

    getPublicUrl(key) {
      return `${config.publicUrl ?? config.endpoint}/${config.bucket}/${key}`;
    },

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

export function createStorageClientFromEnv(): StorageClient {
  return createStorageClient({
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    bucket: process.env.S3_BUCKET ?? 'moongate-dev',
    region: process.env.S3_REGION ?? 'us-east-1',
    publicUrl: process.env.S3_PUBLIC_URL,
  });
}

export function generateStorageKey(
  tenantId: string,
  category: string,
  filename: string,
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  return `${tenantId}/${category}/${timestamp}_${sanitized}`;
}
