import pkg from '../../package.json';
import { env } from '../config/env';
import { paths } from './paths';
import { buildComponentSchemas } from './schemas';

export const BEARER_AUTH_SCHEME = 'bearerAuth';

// OpenAPI 3.1 (JSON Schema 2020-12 compatible). Schemas are generated from the
// Zod contracts in packages/shared; operations mirror docs/api.md.
export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Lulu CRM API',
      version: pkg.version,
      description:
        'CRM module of Lulu. The endpoint contract lives in docs/api.md; schemas live in packages/shared and are the source for the components below. Add a newly implemented endpoint to apps/api/src/openapi/paths.ts in the same pull request.',
    },
    servers: [{ url: '/' }, { url: `http://localhost:${env.PORT}` }],
    tags: [{ name: 'Operations', description: 'Unauthenticated operational endpoints.' }],
    paths,
    components: {
      securitySchemes: {
        [BEARER_AUTH_SCHEME]: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token from POST /api/v1/auth/login. The workspace comes from the token.',
        },
      },
      schemas: buildComponentSchemas(),
    },
  };
}
