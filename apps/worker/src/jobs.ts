import type { Job } from 'bullmq';

export const QUEUE_NAME = 'default';

/**
 * Job registry. v0.1 has only `ping` (proves the queue round-trip).
 * Upcoming: rsvp-confirmation, csv-import, slip-pdf, sprite-render, pg-dump, reminders.
 */
export const handlers: Record<string, (job: Job) => Promise<unknown>> = {
  ping: async (job) => ({ pong: true, receivedAt: job.timestamp }),
};

export async function processJob(job: Job): Promise<unknown> {
  const handler = handlers[job.name];
  if (!handler) throw new Error(`No handler for job "${job.name}"`);
  return handler(job);
}
