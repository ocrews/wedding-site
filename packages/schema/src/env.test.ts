import { describe, expect, it } from 'vitest';
import { apiEnvSchema, parseEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('apiEnvSchema', () => {
  it('applies defaults', () => {
    const env = parseEnv(apiEnvSchema, valid);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('coerces PORT', () => {
    expect(parseEnv(apiEnvSchema, { ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() => parseEnv(apiEnvSchema, { ...valid, DATABASE_URL: 'mysql://x' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('never echoes secret values in errors', () => {
    const secret = 'postgres-but-not-a-url-s3cr3t';
    try {
      parseEnv(apiEnvSchema, { ...valid, DATABASE_URL: secret });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain(secret);
    }
  });
});
