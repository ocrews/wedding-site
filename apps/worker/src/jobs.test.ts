import type { Job } from 'bullmq';
import { describe, expect, it } from 'vitest';
import { processJob } from './jobs.js';

const job = (name: string) => ({ name, timestamp: 1 }) as Job;

describe('processJob', () => {
  it('handles ping', async () => {
    await expect(processJob(job('ping'))).resolves.toEqual({ pong: true, receivedAt: 1 });
  });

  it('rejects unknown jobs so they land in the failed set', async () => {
    await expect(processJob(job('nope'))).rejects.toThrow(/No handler/);
  });
});
