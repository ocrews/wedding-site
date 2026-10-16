import Fastify, { type FastifyServerOptions } from 'fastify';
import type { HealthResponse, ReadyResponse } from '@wedding/schema';

/** A dependency the API needs before it can serve traffic. Must resolve or throw. */
export type ReadinessCheck = () => Promise<void>;

export interface AppDeps {
  version: string;
  checks: Record<string, ReadinessCheck>;
}

const CHECK_TIMEOUT_MS = 2000;

function withTimeout(p: Promise<void>, ms: number): Promise<void> {
  return Promise.race([
    p,
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms).unref()),
  ]);
}

export function buildApp(deps: AppDeps, opts: FastifyServerOptions = {}) {
  const app = Fastify({
    ...opts,
    // Never log request bodies or auth headers; guest data and codes pass through here later.
    logger:
      opts.logger === undefined
        ? { redact: ['req.headers.authorization', 'req.headers.cookie'] }
        : opts.logger,
  });

  // Liveness: process is up. No dependency checks, so orchestrators don't restart on a DB blip.
  app.get('/healthz', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'api',
    version: deps.version,
  }));

  // Readiness: dependencies reachable. Returns 503 with per-check status (no error details).
  app.get('/readyz', async (_req, reply) => {
    const entries = await Promise.all(
      Object.entries(deps.checks).map(async ([name, check]) => {
        try {
          await withTimeout(check(), CHECK_TIMEOUT_MS);
          return [name, 'ok'] as const;
        } catch (err) {
          app.log.warn({ check: name, err }, 'readiness check failed');
          return [name, 'error'] as const;
        }
      }),
    );
    const checks = Object.fromEntries(entries);
    const ok = entries.every(([, s]) => s === 'ok');
    const body: ReadyResponse = { status: ok ? 'ok' : 'error', checks };
    return reply.code(ok ? 200 : 503).send(body);
  });

  return app;
}
