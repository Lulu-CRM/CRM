# CRM: Project Plan

Updated October 17, 2026. Dave told the team to start on Oct 17 and put Sudais in charge of leading it.

## What we are building

The CRM is the Lulu module where a business keeps its contacts, companies, deals and follow-ups in one place, with AI suggestions on top. Our team builds its UI and its backend from the MagicPath design.

- **Ours:** the 11 CRM pages.
- **Not ours:** the other modules (Online Presence, Accounting, Email, Calendar, Marketplace). The CRM only provides the connection points they will use later.
- **Source of truth:** the MagicPath export in `design/`. It is a clickable prototype with sample data only, so all saving, filtering and logic is still to be built.

## Objective and success criteria

The objective is a working CRM module, in English, German and Chinese, where a business manages its contacts, companies, deals and follow-ups. The first round succeeds when:

- A user can sign in, add and import contacts, and see them with their companies.
- Deals move across a pipeline board and the totals update.
- Tasks, notes and the activity timeline work on every record.
- Everything runs in all three languages with no hardcoded text.
- The code is on GitHub, tested, and runs from the Dockerfile.

## Pages and what each needs from the backend

Only adding a contact (kept in the browser) and search work in the prototype today.

| Page | The backend must provide |
| --- | --- |
| Overview | One summary call: contact count, open pipeline value, follow-ups due, recent contacts, activity feed |
| Contacts | List with search, filters, sort and paging; create, edit, delete; contact profile with timeline |
| Companies | List, create, edit; people and deal value per company |
| Leads | Contacts in early stages; move between stages; convert to customer |
| Deals & Pipeline | Stages, deals (create, edit, move), totals and win rate |
| Activities & Tasks | Tasks with due date and owner; activity timeline |
| Notes | Notes linked to a contact, company or deal; shared or private |
| Segments | Saved filter rules with a live member count |
| Import Contacts | CSV or XLSX upload, field mapping, duplicate check, background import, held duplicates to review |
| AI Analysis | Per-contact summary, next step and data quality; changes saved only after the user confirms |
| CRM Settings | Custom fields, stages, roles, consent rules, notifications |

See `docs/data-model.md` and `docs/api.md` for the details.

## Build order

One quick round, no separate phases: set up on day 1, build the core pages all at once, then add the rest as people free up.

1. **Day 1, setup:** repo, shared schemas, endpoint list, app shell, database, mock mode.
2. **Core, in parallel:** Contacts, Companies, Deals and the pipeline board, Tasks, Overview. Frontend builds on mock data while backend builds the endpoints.
3. **The rest, as people free up:** Leads, Notes, Segments, Import Contacts, CRM Settings, AI Analysis.

The core is the shippable version. Anything not finished from the rest goes to the next round.

## Milestones (proposed targets)

Days count from the day the repo is ready. Sudais adjusts them once everyone has claimed their tasks. They are rough targets, not deadlines.

| Target | Milestone | Lead |
| --- | --- | --- |
| Day 1 | Organisation, repo, `AGENTS.md`, shared schemas, app shell and mock mode ready | Sudais, Abdul, Franklin |
| Day 3 | Core pages clickable on mock data; login, Contacts and Companies API running | Frontend devs, Franklin |
| Day 5 | Core pages connected to the real API; Deals, Tasks and Activities endpoints done | All devs |
| Day 7 | Demo of the core to Dave, and a list of what moves to the next round | Sudais |

## Team and first tasks

We plan with the devs who are active and have given their GitHub handle, and add people as they join.

| Person | Role | First task | Done when |
| --- | --- | --- | --- |
| Sudais Jr. | Project manager, frontend | Create the GitHub organisation and repo, write `AGENTS.md`, then the Pipeline and Leads boards with drag and drop, Deals and Tasks | A deal moves between stages on the board in mock mode |
| Abdul Samad | Frontend, supports the PM | App shell, routing, design tokens and i18n setup, then the Contacts page | Everyone can clone and run `apps/web` with mock data |
| Franklin (replaced Tobi) | Backend (Express) | API base, database schema with workspace id, login, then the Contacts and Companies endpoints | Others can run the API, log in with a test user and create a contact |
| theLady (replaced Brobot) | Backend | Deals, pipeline stages, Tasks and Activities endpoints | Moving a deal updates the pipeline totals |

Task numbers for the backend (1 to 9) and frontend (A to D) are in the group message.

## Working agreement

- **Done for a task:** merged by pull request after one review, works against the mock and the real API, all text comes from translation files, tests pass, and docs are updated.
- **Status:** each dev posts a short update once a day: done, next, blocked. Sudais posts one summary for Dave, with help from Abdul.
- **Blockers:** anyone blocked for more than a few hours says so in the group, and Sudais or Abdul unblocks them.
- **Changes:** scope or design changes go through Sudais, who confirms with Dave.
- **Decisions:** technical decisions are made in the group and recorded in `docs/`.

## Risks

The biggest risk is a thin team: four devs for 11 pages, and the CRM is the most important module, so we ship the core first.

| Risk | What we do |
| --- | --- |
| Too few active devs for 11 pages | Ship the core pages first so there is a working product, and recruit only if the core slips |
| The design is a prototype with no states for edit, delete, empty, loading or error | The frontend devs list the missing screens in week one and show them to Sudais before building |
| Email and Calendar will feed the activity feed | One event format in `docs/api.md` now, and the other modules adopt it |
| EU customers, so consent and privacy matter | Consent and permissions are in the first schema, and imported contacts inherit them |
| Scope grows beyond the design | Freeze the 11-page list, and Sudais confirms any change with Dave before we build past it |

## Open questions

We keep building on the default below while we ask:

- [x] **Backend team:** Franklin (tasks 1 to 3, then 9) and theLady (4 and 5, then 6). Tasks 7 and 8 move to the next round.
- [ ] **AI provider and key:** Sudais asks Dave. Until then AI Analysis runs on a simulated reply, so nothing is blocked.
- [ ] **App shell:** ask Satyam whether his shell (login, sign-up, settings, language switch) is the base the CRM plugs into. Until then the CRM uses its own login (task 2) and sign-in page, which can be swapped out.

## Decisions from Dave (18 Oct)

- **No agents this round.** We build the manual version: every change is made or confirmed by a person. AI Analysis stays as planned (simulated provider, accept or dismiss), which is not an agent.
- **Currency.** Deal totals add up deals in the workspace's default currency; deals in other currencies are counted, not converted (`docs/data-model.md`).
- **Still open:** company health (Strong, Watch, New) from the design is not in the data model, so it is left out until someone asks for it.

## First 48 hours

- [x] Plan and task list posted in the group by Sudais, so everyone claims their numbers
- [ ] Collect every dev's stack and GitHub username, and chase the ones who have not replied
- [ ] Create the GitHub organisation and the repo, and invite the team
- [ ] Add `AGENTS.md`, the `docs/` folder, `design/` and `.env.example`
- [ ] Set up i18n in the app shell (English, German, Chinese) before anyone builds a page
- [ ] Write the shared schemas from `docs/data-model.md` and `docs/api.md`
- [ ] Hold a 30-minute devs' call: who does what, the API format and the branch rules
- [ ] Each dev gives a short status once a day, and Sudais posts one summary for Dave
- [ ] On day 2, check every first task against its "done when" and unblock whoever is stuck
