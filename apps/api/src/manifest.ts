import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { permissionActionSchema, permissionResourceSchema } from '@lulu/shared';
import { AUDITED_ENTITIES, PUBLISHED_EVENT_TYPES } from './db/audit';
import { paths } from './openapi/paths';

// The CRM's bundle manifest (Lulu Autonomous Bundle Platform, "4.1 Bundle manifest"): what the bundle
// is, what it needs and what it offers, for the platform's resolver and installer. Built from the code
// (API paths, events, permissions, migrations), not written by hand, so it cannot drift. Served at
// GET /manifest.json. The platform has not published its manifest schema yet; field names follow the
// architecture document and will be mapped when it does.

const VERSION = '0.1.0';

// UI routes of apps/web (the four menu pages first; the others stay reachable by link).
const UI_ROUTES = [
  '/crm/directory',
  '/crm/pipeline',
  '/crm/notes',
  '/crm/import',
  '/crm/overview',
  '/crm/contacts',
  '/crm/companies',
  '/crm/leads',
  '/crm/deals',
  '/crm/activities',
  '/crm/segments',
  '/crm/ai-analysis',
  '/crm/settings',
];

function migrationNames(): string[] {
  try {
    return readdirSync(resolve(process.cwd(), 'prisma/migrations'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return []; // Not shipped with this build; the platform reads them from the release instead.
  }
}

export function buildManifest() {
  const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
  return {
    id: 'lulu.crm',
    name: 'Lulu CRM',
    version: VERSION,
    platformRange: '>=1.0.0 <2.0.0',
    dependencies: [],
    capabilities: {
      // Server-side permissions the bundle checks: <resource>.<action>, e.g. contacts.edit.
      provides: permissionResourceSchema.options.flatMap((resource) =>
        permissionActionSchema.options.map((action) => `${resource}.${action}`),
      ),
    },
    routes: UI_ROUTES,
    apis: Object.entries(paths)
      .filter(([path]) => path.startsWith('/api/v1/'))
      .flatMap(([path, item]) =>
        methods
          .filter((method) => method in item)
          .map((method) => `${method.toUpperCase()} ${path}`),
      )
      .sort(),
    openapi: '/docs.json',
    events: {
      publishes: PUBLISHED_EVENT_TYPES,
      // POST /events from other modules (docs/api.md, "Events from other modules").
      consumes: ['email.*', 'calendar.*', 'marketplace.*'],
    },
    entities: Object.values(AUDITED_ENTITIES).concat(['activity', 'audit_log']),
    aiTools: [
      {
        id: 'crm.ai.analyze_contact',
        description: 'Summary, next step and data-quality check for one contact.',
        // R1: internal and reversible; nothing is saved until a person accepts (POST /ai-insights/:id/accept).
        risk: 'R1',
        approval: 'required_before_save',
        api: 'POST /api/v1/contacts/{id}/ai-analysis',
      },
      {
        id: 'crm.ai.company_notes',
        description:
          'AI notes for a company, from everything the CRM holds about it (shared notes only).',
        // R1: writes only the AI-owned aiNotes field; no business record changes.
        risk: 'R1',
        approval: 'not_required',
        api: 'POST /api/v1/companies/{id}/ai-notes',
      },
    ],
    jobs: ['import.process', 'ai.analyze', 'ai.company_notes'],
    migrations: migrationNames(),
    healthChecks: { live: '/health/live', ready: '/health' },
    entitlements: { plan: 'any', limits: {} },
  };
}
