import { schemaRef } from './schemas';

export interface OpenApiOperation {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  security?: Array<Record<string, string[]>>;
  responses: Record<string, unknown>;
}

export type OpenApiPaths = Record<
  string,
  Partial<Record<'get' | 'post' | 'put' | 'patch' | 'delete', OpenApiOperation>>
>;

// Machine-readable mirror of the "Operations and health" section in docs/api.md.
// Add every newly implemented endpoint here in the same pull request.
export const paths: OpenApiPaths = {
  '/health': {
    get: {
      operationId: 'getHealth',
      summary: 'Readiness check',
      description:
        'Checks Postgres and Redis. Each dependency check is bounded by a timeout (CHECK_TIMEOUT_MS, 2000ms) so a hung database cannot hang the response. Returns 200 when both are up, 503 when either is down. Unauthenticated.',
      tags: ['Operations'],
      security: [],
      responses: {
        '200': {
          description: 'All dependencies are up.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } },
              },
            },
          },
        },
        '503': {
          description: 'At least one dependency is down.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'degraded', checks: { database: 'down', redis: 'ok' } },
              },
            },
          },
        },
      },
    },
  },
  '/health/live': {
    get: {
      operationId: 'getHealthLive',
      summary: 'Liveness check',
      description:
        'Always returns 200 and touches no dependency — use it to detect a hung process. Unauthenticated.',
      tags: ['Operations'],
      security: [],
      responses: {
        '200': {
          description: 'Process is alive.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthLiveStatus') },
              example: { data: { status: 'ok' } },
            },
          },
        },
      },
    },
  },
  '/api/v1/health': {
    get: {
      operationId: 'getHealthVersioned',
      summary: 'Readiness check (versioned alias)',
      description:
        'Alias of GET /health, for clients that only know the versioned /api/v1 base path. Unauthenticated.',
      tags: ['Operations'],
      security: [],
      responses: {
        '200': {
          description: 'All dependencies are up.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } },
              },
            },
          },
        },
        '503': {
          description: 'At least one dependency is down.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'degraded', checks: { database: 'down', redis: 'ok' } },
              },
            },
          },
        },
      },
    },
  },
};
