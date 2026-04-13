import { Queue, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './env.js';

let _redis: Redis | null = null;
let _queue: Queue | null = null;
let _available: boolean | null = null;

export async function isQueueAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    const r = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 1000, lazyConnect: true });
    await r.connect();
    await r.ping();
    await r.quit();
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

export function getRedisConnection(): Redis {
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return _redis;
}

/** Returns plain connection options so BullMQ can create its own dedicated connections. */
export function getRedisConnectionOptions(): ConnectionOptions {
  return { url: env.REDIS_URL, maxRetriesPerRequest: null } as ConnectionOptions;
}

export function getExtractionQueue(): Queue {
  if (!_queue) {
    _queue = new Queue('pdf-extraction', { connection: getRedisConnection() as unknown as ConnectionOptions });
  }
  return _queue;
}

export async function enqueueExtraction(jobId: string, deckId: string, storageKey: string | null): Promise<boolean> {
  try {
    if (!(await isQueueAvailable())) return false;
    await getExtractionQueue().add('extract', { jobId, deckId, storageKey });
    return true;
  } catch {
    return false;
  }
}

let _reminderQueue: Queue | null = null;

export function getReminderQueue(): Queue {
  if (!_reminderQueue) {
    _reminderQueue = new Queue('order-reminders', { connection: getRedisConnection() as unknown as ConnectionOptions });
  }
  return _reminderQueue;
}

/**
 * Schedule a final-payment reminder for an order.
 * @param orderId - the order to remind about
 * @param delayMs - milliseconds from now to send the reminder (0 = immediate)
 */
export async function enqueueReminderJob(orderId: string, delayMs: number): Promise<boolean> {
  try {
    if (!(await isQueueAvailable())) return false;
    await getReminderQueue().add('send-reminder', { orderId }, {
      delay: Math.max(0, delayMs),
      jobId: `reminder-${orderId}`, // deduplicate per order
      removeOnComplete: true,
      removeOnFail: false,
    });
    return true;
  } catch {
    return false;
  }
}
