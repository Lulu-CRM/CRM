import { describe, expect, it } from 'vitest';
import { buildManifest } from './manifest';
import { paths } from './openapi/paths';

describe('bundle manifest', () => {
  const manifest = buildManifest();

  it('lists every documented API operation, so it cannot drift from the API', () => {
    const documented = Object.entries(paths)
      .filter(([path]) => path.startsWith('/api/v1/'))
      .flatMap(([path, item]) =>
        Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`),
      );
    expect([...manifest.apis].sort()).toEqual(documented.sort());
    expect(manifest.apis).toContain('GET /api/v1/audit-log');
    expect(manifest.apis).toContain('POST /api/v1/events');
  });

  it('declares the events it publishes and consumes, its permissions and its AI tool', () => {
    expect(manifest.events.publishes).toContain('contact.created');
    expect(manifest.events.publishes).toContain('ai_insight.updated');
    expect(manifest.events.consumes).toEqual(['email.*', 'calendar.*', 'marketplace.*']);
    expect(manifest.capabilities.provides).toContain('contacts.edit');
    expect(manifest.aiTools[0]).toMatchObject({ risk: 'R1', approval: 'required_before_save' });
  });

  it('includes the database migrations, oldest first', () => {
    expect(manifest.migrations.length).toBeGreaterThan(0);
    expect(manifest.migrations).toContain('20261023180000_platform_audit_outbox_event_ids');
    expect([...manifest.migrations].sort()).toEqual(manifest.migrations);
  });
});
