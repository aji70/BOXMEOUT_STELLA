/**
 * EventBridgeService - Poll Soroban events and sync DB state
 */

import { rpc } from '@stellar/stellar-sdk';
import logger from '../utils/logger.js';
import { getQueueService } from './queue.service.js';

const RPC_URL =
  process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const POLL_INTERVAL_MS = parseInt(
  process.env.EVENT_POLL_INTERVAL_MS || '15000',
  10
);
const LAST_LEDGER_KEY = 'event_bridge:last_ledger';

export class EventBridgeService {
  private server: rpc.Server;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastLedger = 0;
  private isPolling = false;

  constructor() {
    this.server = new rpc.Server(RPC_URL, {
      allowHttp: RPC_URL.includes('localhost'),
    });
  }

  async getLastLedgerFromRedis(): Promise<number> {
    try {
      const { getRedisClient } = await import('../config/redis.js');
      const redis = getRedisClient();
      const stored = await redis.get(LAST_LEDGER_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  async setLastLedgerInRedis(ledger: number): Promise<void> {
    try {
      const { getRedisClient } = await import('../config/redis.js');
      const redis = getRedisClient();
      await redis.set(LAST_LEDGER_KEY, ledger.toString());
    } catch (err) {
      logger.error('Failed to persist last ledger', {
        error: (err as Error).message,
      });
    }
  }

  async fetchLatestLedger(): Promise<number> {
    const res = await this.server.getLatestLedger();
    return res.sequence;
  }

  async pollAndEmitEvents(contractIds?: string[]): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      this.lastLedger = await this.getLastLedgerFromRedis();
      const latestLedger = await this.fetchLatestLedger();
      if (this.lastLedger >= latestLedger) return;

      const startLedger = this.lastLedger + 1;
      const endLedger = Math.min(this.lastLedger + 100, latestLedger);

      const filters =
        contractIds?.length && contractIds.length > 0
          ? [{ type: 'contract' as const, contractIds, topics: [['*']] }]
          : [{ type: 'contract' as const, topics: [['*']] }];

      const response = await this.server.getEvents({
        startLedger,
        endLedger,
        filters,
        limit: 200,
      });

      if (response.events?.length) {
        const queueService = getQueueService();
        for (const evt of response.events) {
          const contractAddress =
            typeof evt.contractId === 'string' ? evt.contractId : undefined;
          await queueService.addSyncJob({
            type: 'sync',
            entity: 'market',
            ledgerFrom: startLedger,
            ledgerTo: endLedger,
            contractAddress,
          });
        }
        logger.info('Events polled and sync jobs queued', {
          count: response.events.length,
          ledgerRange: `${startLedger}-${endLedger}`,
        });
      }

      await this.setLastLedgerInRedis(endLedger);
      this.lastLedger = endLedger;
    } catch (err) {
      logger.error('EventBridge poll failed', {
        error: (err as Error).message,
      });
      throw err;
    } finally {
      this.isPolling = false;
    }
  }

  startPolling(contractIds?: string[]): void {
    if (this.intervalId) return;
    logger.info('EventBridgeService starting poll', {
      intervalMs: POLL_INTERVAL_MS,
    });
    this.intervalId = setInterval(() => {
      this.pollAndEmitEvents(contractIds).catch((err) =>
        logger.error('EventBridge poll error', {
          error: (err as Error).message,
        })
      );
    }, POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('EventBridgeService stopped polling');
    }
  }
}

let instance: EventBridgeService | null = null;

export const getEventBridgeService = (): EventBridgeService => {
  if (!instance) instance = new EventBridgeService();
  return instance;
};
