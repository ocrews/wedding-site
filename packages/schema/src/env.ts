import { z } from 'zod';

const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

/** 12-factor config: every service validates its environment at boot and fails fast. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: logLevel.default('info'),
});

export const apiEnvSchema = baseEnvSchema.extend({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const workerEnvSchema = baseEnvSchema.extend({
  HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
});
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

/** Parse env or throw a readable error listing every bad key (values are never echoed). */
export function parseEnv<S extends z.ZodType>(schema: S, source: NodeJS.ProcessEnv): z.infer<S> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const keys = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${keys}`);
  }
  return result.data;
}
