/**
 * JobProcessorRegistry - Worker index to manage background processes
 * Configures worker concurrency and graceful error handling for failed jobs
 */

import type { Job } from 'bullmq';
import { getQueueService } from './queue.service.js';
import { QUEUE_NAMES } from './types.js';
import {
  processEmailJob,
  processNotificationJob,
  processSyncJob,
  processBlockchainTxJob,
} from './processors/index.js';
import logger from '../utils/logger.js';

const WORKER_CONCURRENCY = {
  email: parseInt(process.env.WORKER_EMAIL_CONCURRENCY || '2', 10),
  notification: parseInt(process.env.WORKER_NOTIFICATION_CONCURRENCY || '3', 10),
  sync: parseInt(process.env.WORKER_SYNC_CONCURRENCY || '1', 10),
  blockchain_tx: parseInt(process.env.WORKER_BLOCKCHAIN_CONCURRENCY || '1', 10),
};

function wrapProcessor(
  name: string,
  processor: (job: Job) => Promise<void>
): (job: Job) => Promise<void> {
  return async (job: Job) => {
    try {
      await processor(job);
    } catch (err) {
      logger.error('Job processor failed', {
        queue: name,
        jobId: job.id,
        error: (err as Error).message,
      });
      throw err;
    }
  };
}

export function registerAllWorkers(): void {
  const queueService = getQueueService();

  queueService.registerWorker(
    QUEUE_NAMES.EMAIL,
    wrapProcessor(QUEUE_NAMES.EMAIL, processEmailJob as (j: Job) => Promise<void>),
    WORKER_CONCURRENCY.email
  );

  queueService.registerWorker(
    QUEUE_NAMES.NOTIFICATION,
    wrapProcessor(
      QUEUE_NAMES.NOTIFICATION,
      processNotificationJob as (j: Job) => Promise<void>
    ),
    WORKER_CONCURRENCY.notification
  );

  queueService.registerWorker(
    QUEUE_NAMES.SYNC,
    wrapProcessor(QUEUE_NAMES.SYNC, processSyncJob as (j: Job) => Promise<void>),
    WORKER_CONCURRENCY.sync
  );

  queueService.registerWorker(
    QUEUE_NAMES.BLOCKCHAIN_TX,
    wrapProcessor(
      QUEUE_NAMES.BLOCKCHAIN_TX,
      processBlockchainTxJob as (j: Job) => Promise<void>
    ),
    WORKER_CONCURRENCY.blockchain_tx
  );

  logger.info('JobProcessorRegistry: all workers registered', {
    concurrency: WORKER_CONCURRENCY,
  });
}

export async function closeAllWorkers(): Promise<void> {
  const queueService = getQueueService();
  await queueService.close();
  logger.info('JobProcessorRegistry: all workers closed');
}
