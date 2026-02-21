/**
 * Notification Job Processor - In-app, push, or email notifications
 */

import type { Job } from 'bullmq';
import logger from '../../utils/logger.js';
import type { NotificationJobPayload } from '../types.js';

export async function processNotificationJob(
  job: Job<NotificationJobPayload>
): Promise<void> {
  const { userId, title, body, channel = 'in_app' } = job.data;

  logger.info('Processing notification job', {
    jobId: job.id,
    userId,
    title,
    channel,
  });

  // TODO: Integrate with push service (FCM, APNs) or DB write for in_app
  if (channel === 'in_app') {
    // Placeholder: would insert into notifications table
    logger.debug('In-app notification queued', { userId, title });
  } else if (channel === 'push') {
    logger.debug('Push notification would be sent', { userId, title });
  } else if (channel === 'email') {
    logger.debug('Notification email would be sent', { userId, title });
  }
}
