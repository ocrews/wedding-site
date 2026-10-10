import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const ok = async () => {};
const fail = async () => {
  throw new Error('connection refused to 10.0.0.5');
};

describe('api health', () => {
  it('GET /healthz is ok without touching dependencies', async () => {
    const app = buildApp({ version: 't', checks: { postgres: fail } }, { logger: false });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'api', version: 't' });
  });

  it('GET /readyz is 200 when all checks pass', async () => {
    const app = buildApp({ version: 't', checks: { postgres: ok, redis: ok } }, { logger: false });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', checks: { postgres: 'ok', redis: 'ok' } });
  });

  it('GET /readyz is 503 and leaks no error detail when a check fails', async () => {
    const app = buildApp(
      { version: 't', checks: { postgres: fail, redis: ok } },
      { logger: false },
    );
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'error', checks: { postgres: 'error', redis: 'ok' } });
    expect(res.body).not.toContain('10.0.0.5');
  });
});
