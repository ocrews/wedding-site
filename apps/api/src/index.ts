import { Redis } from 'ioredis';
import pg from 'pg';
import { apiEnvSchema, parseEnv } from '@wedding/schema';
import { buildApp } from './app.js';

const env = parseEnv(apiEnvSchema, process.env);

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 });
const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });

const app = buildApp(
  {
    version: process.env.APP_VERSION ?? 'dev',
    checks: {
      postgres: async () => {
        await pool.query('select 1');
      },
      redis: async () => {
        if (redis.status === 'wait') await redis.connect();
        await redis.ping();
      },
    },
  },
  { logger: { level: env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] } },
);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await Promise.allSettled([pool.end(), redis.quit()]);
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: env.HOST, port: env.PORT });
