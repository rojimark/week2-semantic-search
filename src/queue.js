import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null  // required by BullMQ
});

export const embeddingQueue = new Queue('embedding', { connection });
