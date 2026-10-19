import { BEARER_AUTH_SCHEME, schemaRef } from './schemas';

// Authenticated operations carry the bearer token from POST /auth/login.
const bearer: Array<Record<string, string[]>> = [{ [BEARER_AUTH_SCHEME]: [] }];

// AGENTS.md envelope: { "data": ... }. Components are bare payloads, so the
// wrapper is expressed here instead of as a separate component.
function dataResponse(ref: string): Record<string, unknown> {
  return {
    'application/json': { schema: { type: 'object', properties: { data: { $ref: ref } } } },
  };
}

function listResponse(ref: string): Record<string, unknown> {
  return {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: ref } },
          meta: { $ref: schemaRef('ListMeta') },
        },
      },
    },
  };
}

function errorResponse(): Record<string, unknown> {
  return { 'application/json': { schema: { $ref: schemaRef('ErrorEnvelope') } } };
}

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
  '/api/v1/auth/login': {
    post: {
      operationId: 'login',
      summary: 'Log in',
      description:
        'Email and password. Returns a bearer token; the workspace is read from the token, never the body. A wrong password and an unknown email both answer 401 UNAUTHORIZED, so the response never says which part was wrong. Unauthenticated.',
      tags: ['Auth'],
      security: [],
      responses: {
        '200': {
          description: 'Logged in.',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { data: { $ref: schemaRef('AuthSession') } } },
              example: { data: { token: '<jwt>', expiresAt: '2026-10-19T12:00:00.000Z' } },
            },
          },
        },
        '400': { description: 'Invalid body.', content: errorResponse() },
        '401': { description: 'Bad credentials.', content: errorResponse() },
      },
    },
  },
  '/api/v1/auth/logout': {
    post: {
      operationId: 'logout',
      summary: 'Log out',
      description:
        'Revokes the current token by adding it to a server-side denylist until it expires, so it cannot be used again.',
      tags: ['Auth'],
      security: bearer,
      responses: {
        '204': { description: 'Logged out.' },
        '401': { description: 'Missing, invalid or expired token.', content: errorResponse() },
      },
    },
  },
  '/api/v1/me': {
    get: {
      operationId: 'getMe',
      summary: 'Current user',
      description: 'The user the token belongs to (role and language included).',
      tags: ['Auth'],
      security: bearer,
      responses: {
        '200': { description: 'Current user.', content: dataResponse(schemaRef('User')) },
        '401': { description: 'Missing, invalid or expired token.', content: errorResponse() },
      },
    },
    patch: {
      operationId: 'updateMe',
      summary: 'Update the current user',
      description:
        "Updates the user's name and/or language (at least one). role, email and workspaceId cannot be changed.",
      tags: ['Auth'],
      security: bearer,
      responses: {
        '200': { description: 'Updated user.', content: dataResponse(schemaRef('User')) },
        '400': { description: 'Invalid body.', content: errorResponse() },
        '401': { description: 'Missing, invalid or expired token.', content: errorResponse() },
      },
    },
  },
  '/api/v1/users': {
    get: {
      operationId: 'listUsers',
      summary: 'People in the workspace',
      description:
        'Every user in the workspace, for owner pickers. Uses the common list parameters.',
      tags: ['Users'],
      security: bearer,
      responses: {
        '200': { description: 'Workspace users.', content: listResponse(schemaRef('User')) },
        '401': { description: 'Missing, invalid or expired token.', content: errorResponse() },
      },
    },
  },
};
