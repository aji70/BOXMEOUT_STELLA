/**
 * QueueService - Formalized queue abstraction using Redis/BullMQ
 * Structured payload handling and queue management
 */

import {
  Queue,
  Worker,
  Job,
  QueueEvents,
  type ConnectionOptions,
  type JobsOptions,
} from 'bullmq';
import logger from '../utils/logger.js';
import type { JobPayload } from './types.js';
import { QUEUE_NAMES } from './types.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

function getConnectionOptions(): ConnectionOptions {
  return {
    host: new URL(REDIS_URL).hostname,
    port: parseInt(new URL(REDIS_URL).port || '6379', 10),
    password: REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}

const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

export class QueueService {
  private static instance: QueueService;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

  private constructor() {}

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(
        name,
        new Queue(name, {
          connection: getConnectionOptions(),
          defaultJobOptions: DEFAULT_JOB_OPTS,
        })
      );
    }
    return this.queues.get(name)!;
  }

  async addJob<T extends JobPayload>(
    queueName: string,
    payload: T,
    opts?: JobsOptions
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(
      payload.type,
      { ...payload } as Record<string, unknown>,
      { ...DEFAULT_JOB_OPTS, ...opts }
    );
    logger.info('Job queued', {
      queue: queueName,
      jobId: job.id,
      type: payload.type,
    });
    return job;
  }

  async addEmailJob(payload: Omit<JobPayload & { type: 'email' }, 'jobId' | 'createdAt'>): Promise<Job> {
    return this.addJob(QUEUE_NAMES.EMAIL, {
      ...payload,
      jobId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    } as JobPayload);
  }

  async addNotificationJob(
    payload: Omit<JobPayload & { type: 'notification' }, 'jobId' | 'createdAt'>
  ): Promise<Job> {
    return this.addJob(QUEUE_NAMES.NOTIFICATION, {
      ...payload,
      jobId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    } as JobPayload);
  }

  async addSyncJob(
    payload: Omit<JobPayload & { type: 'sync' }, 'jobId' | 'createdAt'>
  ): Promise<Job> {
    return this.addJob(QUEUE_NAMES.SYNC, {
      ...payload,
      jobId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    } as JobPayload);
  }

  async addBlockchainTxJob(
    payload: Omit<JobPayload & { type: 'blockchain_tx' }, 'jobId' | 'createdAt'>
  ): Promise<Job> {
    return this.addJob(QUEUE_NAMES.BLOCKCHAIN_TX, {
      ...payload,
      jobId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    } as JobPayload);
  }

  registerWorker(
    queueName: string,
    processor: (job: Job) => Promise<void>,
    concurrency = 1
  ): Worker {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName)!;
    }
    const worker = new Worker(
      queueName,
      async (job: Job) => {
        logger.info('Processing job', { queue: queueName, jobId: job.id });
        await processor(job);
      },
      {
        connection: getConnectionOptions(),
        concurrency,
      }
    );

    worker.on('completed', (job) => {
      logger.info('Job completed', { queue: queueName, jobId: job.id });
    });

    worker.on('failed', (job, err) => {
      logger.error('Job failed', {
        queue: queueName,
        jobId: job?.id,
        error: err.message,
      });
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    for (const [name, worker] of this.workers) {
      closePromises.push(worker.close());
      logger.info('Worker closed', { queue: name });
    }
    for (const queue of this.queues.values()) {
      closePromises.push(queue.close());
    }
    for (const events of this.queueEvents.values()) {
      closePromises.push(events.close());
    }
    await Promise.all(closePromises);
    this.workers.clear();
    this.queues.clear();
    this.queueEvents.clear();
  }
}

export const getQueueService = () => QueueService.getInstance();
