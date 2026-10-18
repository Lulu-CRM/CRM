import { describe, expect, it } from 'vitest';
import { envSchema, parseEnv } from './env';

const validSource = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/crm_test',
  REDIS_URL: 'redis://localhost:6379',
};

describe('envSchema', () => {
  it('applies defaults for PORT, CORS_ORIGIN and AI_PROVIDER', () => {
    const parsed = envSchema.parse(validSource);
    expect(parsed.PORT).toBe(4000);
    expect(parsed.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(parsed.AI_PROVIDER).toBe('simulated');
  });

  it('coerces PORT to a number', () => {
    const parsed = envSchema.parse({ ...validSource, PORT: '8080' });
    expect(parsed.PORT).toBe(8080);
  });

  it('rejects a REDIS_URL that is not redis:// or rediss://', () => {
    const result = envSchema.safeParse({ ...validSource, REDIS_URL: 'http://localhost:6379' });
    expect(result.success).toBe(false);
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({ ...validSource, JWT_SECRET: 'too-short' });
    expect(result.success).toBe(false);
  });

  it('accepts a JWT_SECRET of 32 characters or more', () => {
    const parsed = envSchema.parse({ ...validSource, JWT_SECRET: 'a'.repeat(32) });
    expect(parsed.JWT_SECRET).toBe('a'.repeat(32));
  });

  it('rejects an invalid DATABASE_URL', () => {
    const result = envSchema.safeParse({ ...validSource, DATABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown NODE_ENV', () => {
    const result = envSchema.safeParse({ ...validSource, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });
});

describe('parseEnv', () => {
  it('returns a frozen object for valid input', () => {
    const parsed = parseEnv(validSource);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(parsed.NODE_ENV).toBe('test');
  });
});
