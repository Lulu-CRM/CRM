import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './document';
import { COMPONENT_REF_PREFIX } from './schemas';

type Json = Record<string, unknown>;

function collectRefs(node: unknown, refs: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs);
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') refs.push(value);
      else collectRefs(value, refs);
    }
  }

  return refs;
}

// The only endpoints that do not need a bearer token: the health checks and
// login. Everything else under /api/v1 sits behind requireAuth (routes/index.ts).
const UNAUTHENTICATED = new Set([
  '/health',
  '/health/live',
  '/api/v1/health',
  '/api/v1/auth/login',
]);

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument();

  it('has the required top-level fields', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toMatchObject({ title: 'Lulu CRM API' });
    expect(doc.paths).toBeDefined();
    expect(doc.components).toBeDefined();
  });

  it('documents every implemented operational endpoint from docs/api.md', () => {
    const paths = doc.paths as Json;

    expect(Object.keys(paths).sort()).toEqual([
      '/api/v1/ai-insights/{id}/accept',
      '/api/v1/ai-insights/{id}/dismiss',
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
      '/api/v1/companies',
      '/api/v1/companies/{id}',
      '/api/v1/contacts',
      '/api/v1/contacts/{id}',
      '/api/v1/contacts/{id}/ai-analysis',
      '/api/v1/contacts/{id}/ai-insights',
      '/api/v1/contacts/{id}/convert',
      '/api/v1/contacts/{id}/timeline',
      '/api/v1/deals',
      '/api/v1/deals/summary',
      '/api/v1/deals/{id}',
      '/api/v1/deals/{id}/move',
      '/api/v1/health',
      '/api/v1/imports',
      '/api/v1/imports/{id}',
      '/api/v1/imports/{id}/confirm',
      '/api/v1/imports/{id}/held',
      '/api/v1/imports/{id}/held/{rowId}/resolve',
      '/api/v1/imports/{id}/mapping',
      '/api/v1/imports/{id}/preview',
      '/api/v1/me',
      '/api/v1/pipelines',
      '/api/v1/settings/ai',
      '/api/v1/settings/consent',
      '/api/v1/settings/custom-fields',
      '/api/v1/settings/custom-fields/{id}',
      '/api/v1/settings/notifications',
      '/api/v1/settings/roles',
      '/api/v1/settings/stages',
      '/api/v1/settings/stages/{id}',
      '/api/v1/users',
      '/health',
      '/health/live',
    ]);

    const expectedMethods: Record<string, string[]> = {
      '/api/v1/settings/ai': ['get', 'put'],
      '/api/v1/settings/consent': ['get', 'put'],
      '/api/v1/settings/custom-fields': ['get', 'post'],
      '/api/v1/settings/custom-fields/{id}': ['patch', 'delete'],
      '/api/v1/settings/notifications': ['get', 'put'],
      '/api/v1/settings/roles': ['get', 'put'],
      '/api/v1/settings/stages': ['post'],
      '/api/v1/settings/stages/{id}': ['patch', 'delete'],
      '/api/v1/imports': ['post'],
      '/api/v1/imports/{id}': ['get'],
      '/api/v1/imports/{id}/mapping': ['put'],
      '/api/v1/imports/{id}/preview': ['get'],
      '/api/v1/imports/{id}/confirm': ['post'],
      '/api/v1/imports/{id}/held': ['get'],
      '/api/v1/imports/{id}/held/{rowId}/resolve': ['post'],
      '/api/v1/ai-insights/{id}/accept': ['post'],
      '/api/v1/ai-insights/{id}/dismiss': ['post'],
      '/api/v1/contacts/{id}/ai-analysis': ['post'],
      '/api/v1/contacts/{id}/ai-insights': ['get'],
      '/api/v1/auth/login': ['post'],
      '/api/v1/auth/logout': ['post'],
      '/api/v1/companies': ['get', 'post'],
      '/api/v1/companies/{id}': ['get', 'patch', 'delete'],
      '/api/v1/contacts': ['get', 'post'],
      '/api/v1/contacts/{id}': ['get', 'patch', 'delete'],
      '/api/v1/contacts/{id}/convert': ['post'],
      '/api/v1/contacts/{id}/timeline': ['get'],
      '/api/v1/deals': ['get', 'post'],
      '/api/v1/deals/summary': ['get'],
      '/api/v1/deals/{id}': ['get', 'patch', 'delete'],
      '/api/v1/deals/{id}/move': ['post'],
      '/api/v1/health': ['get'],
      '/api/v1/me': ['get', 'patch'],
      '/api/v1/pipelines': ['get'],
      '/api/v1/users': ['get'],
      '/health': ['get'],
      '/health/live': ['get'],
    };

    for (const [path, methods] of Object.entries(expectedMethods)) {
      const pathItem = paths[path] as Json;

      for (const method of methods) {
        const operation = pathItem[method] as Json | undefined;

        expect(operation, `missing ${method.toUpperCase()} ${path}`).toBeDefined();
        expect(
          Object.keys(operation!.responses as Json).length,
          `${method.toUpperCase()} ${path} must document responses`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('marks only the unauthenticated endpoints with empty security', () => {
    const paths = doc.paths as Json;

    for (const [path, pathItemValue] of Object.entries(paths)) {
      const pathItem = pathItemValue as Json;

      for (const [method, operationValue] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;

        const operation = operationValue as Json;
        const label = `${method.toUpperCase()} ${path}`;

        if (UNAUTHENTICATED.has(path)) {
          expect(operation.security, label).toEqual([]);
        } else {
          // Everything under /api/v1 except login sits behind requireAuth.
          expect(operation.security, label).toEqual([{ bearerAuth: [] }]);
        }
      }
    }
  });

  it('declares the bearer auth scheme for future authenticated endpoints', () => {
    const components = doc.components as Json;
    const securitySchemes = components.securitySchemes as Json;

    expect(securitySchemes).toHaveProperty('bearerAuth');
  });

  it('every $ref resolves against components.schemas', () => {
    const components = doc.components as Json;
    const schemas = components.schemas as Json;
    const refs = collectRefs(doc);

    expect(refs.length).toBeGreaterThan(0);

    for (const ref of refs) {
      expect(ref.startsWith(COMPONENT_REF_PREFIX), ref).toBe(true);

      const name = ref.slice(COMPONENT_REF_PREFIX.length);
      expect(schemas, `unresolved ref ${ref}`).toHaveProperty(name);
    }
  });

  it('uses the health response examples from docs/api.md', () => {
    const paths = doc.paths as Json;
    const health = (paths['/health'] as Json).get as Json;
    const responses = health.responses as Json;

    const ok = responses['200'] as Json;
    expect((ok.content as Json)['application/json']).toMatchObject({
      example: {
        data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } },
      },
    });

    const degraded = responses['503'] as Json;
    expect((degraded.content as Json)['application/json']).toMatchObject({
      example: {
        data: { status: 'degraded', checks: { database: 'down', redis: 'ok' } },
      },
    });

    const live = ((paths['/health/live'] as Json).get as Json).responses as Json;
    expect(((live['200'] as Json).content as Json)['application/json']).toMatchObject({
      example: { data: { status: 'ok' } },
    });
  });

  it('generates schemas from packages/shared contracts', () => {
    const components = doc.components as Json;
    const schemas = components.schemas as Json;
    const healthStatus = schemas.HealthStatus as Json;

    expect(healthStatus).toMatchObject({
      type: 'object',
      properties: {
        data: {
          properties: {
            status: { enum: ['ok', 'degraded'] },
            checks: {
              properties: {
                database: { enum: ['ok', 'down'] },
                redis: { enum: ['ok', 'down'] },
              },
            },
          },
        },
      },
    });
  });
});
