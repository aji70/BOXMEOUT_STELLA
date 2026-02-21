/**
 * Sync Job Processor - Sync DB state with on-chain data
 */

import type { Job } from 'bullmq';
import logger from '../../utils/logger.js';
import type { SyncJobPayload } from '../types.js';

export async function processSyncJob(job: Job<SyncJobPayload>): Promise<void> {
  const { entity, entityId, contractAddress, ledgerFrom, ledgerTo } = job.data;

  logger.info('Processing sync job', {
    jobId: job.id,
    entity,
    entityId,
    contractAddress,
  });

  // TODO: Integrate with Prisma and blockchain services
  // - Fetch market/prediction/user from chain
  // - Upsert into DB
  switch (entity) {
    case 'market':
      logger.debug('Would sync market', { contractAddress });
      break;
    case 'prediction':
      logger.debug('Would sync prediction', { entityId });
      break;
    case 'user':
      logger.debug('Would sync user', { entityId });
      break;
    case 'full':
      logger.debug('Would run full sync', { ledgerFrom, ledgerTo });
      break;
  }
}
