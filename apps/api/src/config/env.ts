import 'dotenv/config';
import { z } from 'zod';

// Optional vars that arrive as an empty string (e.g. docker-compose ${VAR:-}) mean "not set".
const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, 'must start with redis:// or rediss://'),
  CORS_ORIGIN: z.url().default('http://localhost:3000'),
  JWT_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
  AI_PROVIDER: z.preprocess(emptyToUndefined, z.string().default('simulated')),
  AI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment variables:\n${issues}`);
    process.exit(1);
  }
  return Object.freeze(result.data);
}

export const env: Env = parseEnv();
