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

const OPERATIONAL_PATHS = ['/health', '/health/live', '/api/v1/health'];

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument();

  it('has the required top-level fields', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toMatchObject({ title: 'Lulu CRM API' });
    expect(doc.paths).toBeDefined();
    expect(doc.components).toBeDefined();
  });

  it('documents every implemented endpoint from docs/api.md', () => {
    const paths = doc.paths as Json;
    expect(Object.keys(paths).sort()).toEqual([
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
      '/api/v1/health',
      '/api/v1/me',
      '/api/v1/users',
      '/health',
      '/health/live',
    ]);
    for (const path of Object.keys(paths)) {
      const operations = Object.values(paths[path] as Json) as Json[];
      expect(operations.length, `no operations on ${path}`).toBeGreaterThan(0);
      for (const operation of operations) {
        expect(Object.keys(operation.responses as Json).length).toBeGreaterThan(0);
      }
    }
  });

  it('marks operational endpoints as unauthenticated', () => {
    const paths = doc.paths as Json;
    for (const path of OPERATIONAL_PATHS) {
      const operation = (paths[path] as Json).get as Json;
      expect(operation.security, `GET ${path}`).toEqual([]);
    }
  });

  it('marks the auth endpoints with the right bearer security', () => {
    const paths = doc.paths as Json;
    expect(((paths['/api/v1/auth/login'] as Json).post as Json).security).toEqual([]);
    for (const path of ['/api/v1/auth/logout', '/api/v1/me', '/api/v1/users']) {
      const operations = Object.values(paths[path] as Json) as Json[];
      for (const operation of operations) {
        expect(operation.security, path).toEqual([{ bearerAuth: [] }]);
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
      example: { data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } } },
    });

    const degraded = responses['503'] as Json;
    expect((degraded.content as Json)['application/json']).toMatchObject({
      example: { data: { status: 'degraded', checks: { database: 'down', redis: 'ok' } } },
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
