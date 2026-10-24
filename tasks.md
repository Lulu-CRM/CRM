# Tasks

The PM (Sudais) keeps the Owner and Status columns up to date. To claim a task, reply in the group with its number or letter, then the PM updates this file.

Every task: one pull request, one review before merge, no hardcoded text (i18n), tests on risky parts. Read `AGENTS.md` and `docs/` before you start.

Status values: `open`, `in progress`, `in review`, `done`.

## Board

| ID | Task | Owner | Status | Waits for |
| --- | --- | --- | --- | --- |
| PM | Organisation, repo, invites, task list, daily status | Sudais | in progress | |
| 1 | API base and database | Franklin | done | |
| 2 | Auth, workspace, roles | Franklin | done | |
| 3 | Contacts and Companies API | Franklin | done | 1, 2 |
| 4 | Deals and pipeline API | theLady | done | 1 |
| 5 | Tasks, Notes, Activities API | theLady | done | 1 |
| 6 | Segments API | Sudais | done | 3 |
| 7 | Contact import | Sudais | done | 3 |
| 8 | AI analysis | Sudais | done | 3 |
| 9 | CRM settings API | Sudais | done | 2 |
| A1 | App shell and i18n | Abdul | done | |
| A2 | Contacts page and profile drawer | Abdul | done | A1 |
| B1 | Deals and pipeline board | Sudais | done | A1 |
| B2 | Leads board | Sudais | done | A1 |
| B3 | Tasks page | Sudais | done | A1 |
| C | Overview, Companies, Notes | Abdul | done | A1 |
| D | Segments, Import wizard, AI Analysis, Settings | Sudais | done | A1 |
| W1 | Sign-in page and per-area mock/real switch | Sudais | done | 2 |
| W2 | Overview API (`GET /overview`) | Sudais | done | 3, 4 |
| W3 | New design: 4-page CRM menu, Contacts & Companies, Leads & Deals | Sudais | done | |
| W4 | Dave's review: company lead status, WhatsApp, Instagram, Facebook, product/service, notes, AI notes; Notes and AI cards removed | Sudais | done | |
| W5 | Platform alignment (Dave's architecture PDFs): AI through canonical services, audit log, outbox events, correlation ids, deduplicated events, bundle manifest | Sudais | done | |
| W6 | Dave's review (Oct 24): AI-written company notes, WhatsApp country picker, clickable WhatsApp/Instagram/Facebook, link existing contacts to a company | Sudais | done | |
| W7 | Import Contacts as a pop-up on Contacts & Companies, out of the menu (Dave, Oct 24) | Sudais | done | |
| W8 | Company assigned to a person by name; company and contact forms no longer share fields (Dave, Oct 24) | Sudais | in review | |

Franklin replaced Tobi and theLady replaced Brobot. Sudais took 6 (segments), 7 (import) and 8 (AI) off theLady and 9 (settings) off Franklin. Every task above is merged. Pages move to the real API one area at a time with `NEXT_PUBLIC_REAL_API` (`apps/web/README.md`).

## PM: Sudais

First hour:

- [x] Create the GitHub organisation and the repo
- [x] Add `AGENTS.md`, `docs/`, `design/` and `.env.example`, and protect `main`
- [x] Invite everyone who sent a GitHub username
- [x] Post the tasks and keep this board up to date

Every day:

- [ ] Collect each dev's update (done, next, blocked)
- [ ] Post one status summary for Dave

## Backend

### 1. API base and database

- [x] Create `apps/api`: TypeScript and Express, folders `routes`, `services`, `middleware`, `jobs`, eslint and prettier
- [x] Postgres (Neon or Docker) and Prisma. First migration: Workspace, User, and the base fields on every table (`workspaceId`, `createdAt`, `updatedAt`, `deletedAt`), as in `data-model.md`
- [x] Redis and BullMQ connection (Upstash), and `GET /health`
- [x] Response helpers and a global error handler using the format in `AGENTS.md`. Validate requests with the Zod schemas in `packages/shared`
- [x] Complete `.env.example`, and send the real `.env` to the team privately
- [x] Dockerfile and docker-compose (api, postgres, redis)
- [x] Seed script with the design's sample data (5 contacts, 4 companies, 4 deals, 3 notes, 5 activities)
- [x] Vitest set up with one passing test

Done when: everyone can start the API with one command, `/health` returns ok and the seed runs.

### 2. Auth, workspace, roles

- [x] `POST /auth/login` and `/auth/logout`, `GET` and `PATCH /me`, `GET /users`
- [x] Hashed passwords, token auth, middleware that loads the workspace from the token
- [x] Role guard (owner, admin, member) and a permission helper
- [x] Seed owner user Jamie Morgan
- [x] Tests for login and the role guard

Done when: a test user logs in and calls a protected endpoint, and a member cannot delete.

### 3. Contacts and Companies API

- [x] All endpoints in `api.md` under Contacts and Companies
- [x] Search `q` across name, email, company name and tags; filters, sort and paging
- [x] Create, edit, soft delete, convert lead to customer, contact timeline
- [x] Every query filters by `workspaceId`
- [x] Tests for list, create and the filters

Done when: the frontend can switch the Contacts page from mock to real.

### 4. Deals and pipeline API

- [x] Default pipeline with stages New, Qualified, Proposal, Negotiation, Won, Lost, with probabilities
- [x] Endpoints in `api.md` under Deals and pipeline: list with filters, create, edit, soft delete, `POST /deals/:id/move`
- [x] `GET /deals/summary`: open value, weighted value, win rate, active deals, average days to close, computed on the server
- [x] Tests for move and summary

Done when: moving a deal updates the totals.

### 5. Tasks, Notes, Activities API

- [x] Endpoints for tasks, notes (private notes only for their author) and activities
- [x] `POST /events` so other modules can post activities (format in `api.md`)
- [x] `GET /contacts/:id/timeline` combines all three

Done when: a posted event shows on the contact's timeline.

### 6. Segments API

- [x] Saved filter rules, live member count, contacts in a segment
- [x] Background job `segments.refresh`: not needed yet. Counts are worked out live on every read (`docs/api.md`, "Background jobs")

Done when: a segment's count changes when a matching contact is added.

### 7. Contact import

- [x] Upload CSV or XLSX (up to 10,000 rows), save mapping, preview
- [x] Duplicate check on email, then name plus company
- [x] BullMQ job `import.process`, held duplicates, resolve (skip, create, merge)
- [x] Tests with a 1,000-row file

Done when: a 1,000-row file imports and duplicates wait for review.

### 8. AI analysis

- [x] Provider interface with a simulated provider
- [x] Background job `ai.analyze`, summary, next step, data quality
- [x] Accept and dismiss. Nothing is saved without the user's confirmation

Done when: running an analysis returns an insight, and accepting it saves the change.

### 9. CRM settings API

- [x] Custom fields, stages and pipelines, roles, consent, notifications, AI switches

Done when: a custom field appears on the contact form.

Still open after the merge: custom fields are saved and listed but the contact form does not show them yet, and the API keeps one pipeline (no create or delete of pipelines).

## Frontend

### A1. App shell and i18n (first, everyone builds on it)

- [x] Create `apps/web`: Next.js, TypeScript, Tailwind
- [x] Move the design's colours, fonts (Poppins) and spacing from `design/src/components/generated/LuluCRM.css` into CSS variables
- [x] i18n: English, German, Chinese. Translation files, language switcher, dates, numbers and currency through `Intl`. Match Satyam's library once we know it
- [x] Layout from the design: left rail with the modules, CRM sub-navigation with the 11 pages, top bar with breadcrumb, search and user card. Works on mobile
- [x] Routes `/crm/overview`, `/crm/contacts` and so on. Pages not built yet show a placeholder
- [x] Shared components: Button, Avatar, Pill, Modal, Drawer, Toast, Table, EmptyState, Skeleton
- [x] API client with a mock switch (`NEXT_PUBLIC_USE_MOCK`) and mock data from the design, typed with the Zod schemas in `packages/shared`

Done when: `apps/web` runs in mock mode, the language switches, and all 11 routes open.

### A2. Contacts page and profile drawer

- [x] Table with search, filter chips (all, mine, needs follow-up, new this month), sorting, paging, row select
- [x] Add contact modal (react-hook-form and zod), edit, delete with confirm
- [x] Profile drawer: details, owner, source, timeline, notes, tasks, email and task buttons
- [x] Empty, loading and error states

Done when: every Contacts action works on mock data, then on the real API.

### B1. Deals and pipeline board

- [x] Board with the stages from the API (New, Qualified, Proposal, Negotiation, plus Won and Lost)
- [x] Drag and drop with dnd-kit, optimistic update, totals recalculate
- [x] Deal card: name, company, contact, value, probability bar, close date
- [x] Summary strip: open value, win rate, active deals, average days to close
- [x] Add deal modal, edit, delete, table view toggle

Done when: a deal moves between stages and the totals update, on mock data.

### B2. Leads board

- [x] Four columns by lifecycle stage (New, Qualified, Follow-up, Customer), drag to change stage
- [x] Lead card with owner, source and last touch, add lead button, convert to customer

Done when: dragging a lead changes its stage.

### B3. Tasks (Activities & Tasks page)

- [x] Task list with checkbox, due chips (today, tomorrow, overdue) and owner
- [x] New task modal, edit, filters by owner and due date
- [x] Activity timeline next to it

Done when: ticking a task updates the timeline.

### C. Overview, Companies, Notes

- [x] Overview: four KPI cards, recent contacts, pipeline snapshot bars, activity stream, all from `GET /overview`
- [x] Companies: directory cards with health, contact count and pipeline value, add company modal, company page with people and deals
- [x] Notes: cards with shared or private, add and edit note modal, link a note to a contact, company or deal

Done when: all three pages run on mock data with empty, loading and error states.

### D. Segments, Import wizard, AI Analysis, Settings

- [x] Segments: list with live counts, filter-rule builder, view contacts
- [x] Import wizard: upload, map fields, check quality and duplicates, confirm. Held duplicates screen
- [x] AI Analysis: pick a contact, summary, next step and data quality cards, confirm before saving, AI switches
- [x] Settings: custom fields, statuses and pipelines, roles, consent, notifications

Done when: the wizard runs end to end on mock data and every settings row opens a real screen.

## Design gaps (for the designer, if Dave agrees)

- [ ] Edit contact form and delete confirmation
- [ ] Company page (people, deals, notes)
- [ ] Deal page
- [ ] Edit task
- [ ] Segment rule builder
- [ ] Duplicate review screen for imports
- [ ] The five CRM Settings screens
- [ ] Empty, loading and error states for tables and boards
- [ ] Mobile layouts for Contacts and the pipeline board
