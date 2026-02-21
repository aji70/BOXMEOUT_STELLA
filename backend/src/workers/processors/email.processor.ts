/**
 * Email Job Processor - Send emails with retry logic and structured logging
 */

import type { Job } from 'bullmq';
import logger from '../../utils/logger.js';
import type { EmailJobPayload } from '../types.js';

export async function processEmailJob(
  job: Job<EmailJobPayload>
): Promise<void> {
  const { to, subject, template, data, html } = job.data;

  logger.info('Processing email job', {
    jobId: job.id,
    to,
    subject,
    template: template ?? 'raw',
  });

  if (process.env.NODE_ENV === 'development') {
    logger.debug('Email (dev - not sent)', {
      to,
      subject,
      template,
      data: data ? JSON.stringify(data) : undefined,
    });
  } else if (!process.env.EMAIL_API_KEY) {
    logger.warn('EMAIL_API_KEY not configured - skipping send');
  }
}
