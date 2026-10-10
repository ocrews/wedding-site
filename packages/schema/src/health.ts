import { z } from 'zod';

export const checkStatus = z.enum(['ok', 'error']);

export const healthResponse = z.object({
  status: checkStatus,
  service: z.string(),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponse>;

export const readyResponse = z.object({
  status: checkStatus,
  checks: z.record(z.string(), checkStatus),
});
export type ReadyResponse = z.infer<typeof readyResponse>;
