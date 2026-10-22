# AGENTS.md: Lulu CRM

Read this file first, then the files in `docs/`. Every dev and every AI tool on this project works from them, so we do not drift apart.

## What we are building

The CRM module of Lulu, a SaaS where a business runs itself. A business keeps its contacts, companies, deals, tasks, notes and follow-ups in one place, with AI suggestions on top.

We build the UI and the backend for the CRM module only. The other modules (Online Presence, Accounting, Email, Calendar, Marketplace) are other teams' work.

The design is the MagicPath export in `design/`. It is a clickable prototype with sample data. Use it for how things look and flow. Do not copy its single 640-line file (`design/src/components/generated/LuluCRM.tsx`): split it into components.

## The 11 pages

Overview, Contacts, Companies, Leads, Deals & Pipeline, Activities & Tasks, Notes, Segments, Import Contacts, AI Analysis, CRM Settings. Details are in `docs/plan.md`.

**Design update (Oct 22, 2026):** the MagicPath design now shows a CRM menu of four: Contacts & Companies (`/crm/directory`, with Notes and AI Analysis cards), Leads & Deals (`/crm/pipeline`), Notes and Import Contacts. The menu follows it; the other pages keep their routes and stay reachable by link until the team decides whether to remove them.

## Repository layout

```
apps/web         Next.js frontend
apps/api         TypeScript API (Express)
packages/shared  Zod schemas and types used by both
docs/            plan, data model, API
design/          MagicPath export, reference only, never edit
```

## Stack

TypeScript everywhere. Next.js, an Express API, PostgreSQL with Prisma, Zod, Redis with BullMQ for background jobs, Vitest, Docker. The backend lead can change the API framework if the team agrees, and records it here.

## Rules for every change

1. **No hardcoded text.** Every label, message and error comes from a translation file (i18n). English, German and Chinese from day one. Dates and numbers follow the user's language. Adding a language must not need a code change.
2. **Workspace id on every record.** Every table has `workspaceId`, and every query filters by it. The server checks permissions on every request.
3. **Money is a number plus a currency.** Never store `'€24,000'` as text. Dates are timestamps. Links between records are ids.
4. **Contract first.** Zod schemas in `packages/shared` and the endpoints in `docs/api.md` come before the screens. If you change one, change the other in the same pull request.
5. **Mock mode.** The web app can run against a mock API using the design's sample data, so the frontend never waits for the backend.
6. **Background jobs.** Import and AI analysis run through the queue, not inside a request.
7. **AI behind one interface.** A simulated provider answers until we have a model key. AI never saves a change without the user's confirmation.
8. **Secrets.** Read every key from environment variables. Commit `.env.example` with names only. Never commit `.env`.
9. **Tests.** Add Vitest tests for API endpoints and the import logic. Dave has the code reviewed, so no code without tests on the risky parts.

## API response format (proposed, backend lead confirms)

Success:

```json
{ "data": { }, "meta": { "page": 1, "pageSize": 25, "total": 120 } }
```

Error:

```json
{ "error": { "code": "CONTACT_NOT_FOUND", "message": "Contact not found", "details": null } }
```

`message` is a translation key or a code the frontend translates. The server never sends user-facing text in one language only.

## Git rules

- One branch per person and task, named `name/short-task` (for example `abdul/app-shell`).
- Never push to `main`.
- Open a pull request when a task is done. One review before merge.
- Do not edit files in `design/`.

## Done for a task

Merged by pull request after one review, works against the mock and the real API, all text comes from translation files, tests pass, and docs are updated.

## Working with AI tools

Read this file and `docs/` before generating code. Stay inside your task. Follow the rules above even when a quicker way exists. Do not invent endpoints or fields: add them to `docs/api.md` and `docs/data-model.md` first. Do not just paste output: Dave has the code reviewed.
