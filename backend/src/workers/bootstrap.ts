/**
 * Standalone worker bootstrap - run workers without HTTP server
 * Usage: tsx src/workers/bootstrap.ts
 */

import { config } from 'dotenv';
config();

import { initializeRedis, closeRedisConnection } from '../config/redis.js';
import {
  registerAllWorkers,
  closeAllWorkers,
  getEventBridgeService,
} from './index.js';
import logger from '../utils/logger.js';

async function main(): Promise<void> {
  logger.info('Starting worker processes...');
  await initializeRedis();
  registerAllWorkers();

  const eventBridge = getEventBridgeService();
  if (process.env.ENABLE_EVENT_BRIDGE !== 'false') {
    eventBridge.startPolling();
  }

  logger.info('Workers running. Press Ctrl+C to stop.');

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down workers...');
    eventBridge.stopPolling();
    await closeAllWorkers();
    await closeRedisConnection();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('Worker bootstrap failed', { error: err.message });
  process.exit(1);
});
