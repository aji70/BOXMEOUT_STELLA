/**
 * Job payload types for QueueService
 * Structured payloads for Email, Notification, Sync, and BlockchainTx jobs
 */

export type JobType =
  | 'email'
  | 'notification'
  | 'sync'
  | 'blockchain_tx';

export interface BaseJobPayload {
  jobId: string;
  createdAt: string; // ISO
}

export interface EmailJobPayload extends BaseJobPayload {
  type: 'email';
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, unknown>;
  html?: string;
}

export interface NotificationJobPayload extends BaseJobPayload {
  type: 'notification';
  userId: string;
  title: string;
  body: string;
  channel?: 'push' | 'in_app' | 'email';
  data?: Record<string, unknown>;
}

export interface SyncJobPayload extends BaseJobPayload {
  type: 'sync';
  entity: 'market' | 'prediction' | 'user' | 'full';
  entityId?: string;
  contractAddress?: string;
  ledgerFrom?: number;
  ledgerTo?: number;
}

export interface BlockchainTxJobPayload extends BaseJobPayload {
  type: 'blockchain_tx';
  operation: string;
  params: Record<string, unknown>;
  marketId?: string;
  userId?: string;
  retryCount?: number;
}

export type JobPayload =
  | EmailJobPayload
  | NotificationJobPayload
  | SyncJobPayload
  | BlockchainTxJobPayload;

export const QUEUE_NAMES = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  SYNC: 'sync',
  BLOCKCHAIN_TX: 'blockchain_tx',
} as const;
