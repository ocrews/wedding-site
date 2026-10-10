import { createServer } from 'node:http';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { parseEnv, workerEnvSchema } from '@wedding/schema';
import { QUEUE_NAME, processJob } from './jobs.js';

const env = parseEnv(workerEnvSchema, process.env);

// BullMQ requires maxRetriesPerRequest: null on worker connections.
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(QUEUE_NAME, processJob, { connection, concurrency: 4 });
worker.on('failed', (job, err) => {
  console.error(
    JSON.stringify({ msg: 'job failed', job: job?.name, id: job?.id, err: err.message }),
  );
});

// Minimal health endpoint for Docker/compose healthchecks.
const health = createServer((req, res) => {
  const ready = connection.status === 'ready' && worker.isRunning();
  if (req.url === '/healthz') {
    res.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: ready ? 'ok' : 'error', service: 'worker' }));
    return;
  }
  res.writeHead(404).end();
});
health.listen(env.HEALTH_PORT);

const shutdown = async () => {
  health.close();
  await worker.close();
  await connection.quit();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
