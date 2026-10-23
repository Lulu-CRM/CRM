# CRM and the Lulu platform architecture

How the CRM bundle stands against Dave's two architecture documents of Oct 23, 2026 (*Lulu AGI System — Exact
Technical Architecture* and *Lulu Autonomous Bundle Platform*). Platform-level items are for the platform team;
the CRM plugs into them when they exist.

## Done in the CRM

| Requirement | How the CRM meets it |
| --- | --- |
| `workspace_id` on every operation | Every table has it; `scopedDb` forces it on every query; tests check workspaces never see each other |
| Permissions checked on the server | `requirePermission` on every write route, from the workspace's role table |
| Manual UI and AI call the same application service | AI acceptance creates tasks and changes stages through `createTask` and `updateContact`, the services behind the screens, in one transaction |
| Every mutation leaves audit evidence | Audit log written by the database layer for every change (`GET /audit-log`) |
| Domain events with an outbox | `<entity>.created/updated/deleted` written next to each change and dispatched at least once, with retries and a failed state |
| Correlation ids | `X-Request-Id` on every request, stored on audit entries and events, carried into background jobs |
| Actor is human, AI or system | Audit entries and events record `actorType` and `actorId` |
| Incoming events are idempotent | `POST /events` with `eventId`: a repeat is recorded once |
| Financial values as NUMERIC | Deal values `NUMERIC(14,2)` with a currency |
| Long AI and import work outside the request | BullMQ jobs `ai.analyze` and `import.process` |
| AI never saves without a person | Insights are suggestions until a person accepts; the manifest declares the AI tool as risk R1 |
| Bounded, paginated lists | Every list endpoint is paged (maximum 100) |
| Versioned migrations | Prisma migrations, applied on deploy |
| Bundle manifest | `GET /manifest.json`, built from the code |

## Known limits in the CRM

- The audit entry and event are written right after a change, not inside its transaction (see `docs/api.md`, "Domain events").
- Lists use page numbers, not keyset pagination.
- Domain event listeners are in-process until the platform event bus exists.
- `eventId` on `POST /events` is optional so existing senders keep working; make it required once Email, Calendar and Marketplace send it.

## Platform level (not CRM work)

- Central identity (the CRM keeps its own sign-in until there is one to plug into).
- Platform event bus, manifest schema, Marketplace installer and resolver.
- Action Gateway, provider readback and Composio adapters.
- Separate staging environment (a hosting decision: a second Render, Vercel and Neon setup).
