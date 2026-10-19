# API

Base path: `/api/v1`. JSON only. Authenticated with a bearer token. The workspace comes from the token, never from the request body. Response format is in `AGENTS.md`.

This list is the contract for the frontend and the backend. Add or change an endpoint here in the same pull request as the code.

## Swagger UI

Swagger UI is served by the API at `/docs` (the OpenAPI 3.1 document is at `/docs.json`). It documents the implemented endpoints only. Schemas are generated from the Zod contracts in `packages/shared`; the operations live in `apps/api/src/openapi/paths.ts`. When you implement an endpoint from this document, add it to `paths.ts` in the same pull request so the two stay in step.

## Errors

Every error body is `{ code, message, details }` (see `AGENTS.md`). `ERROR_CODES` in `packages/shared/src/errors.ts` is the single list of codes; this document and the translation files (`errors.<CODE>` in `apps/web/messages`) must cover all of them. Codes that can occur on any endpoint: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`. Codes that can occur wherever those records are touched: `CONTACT_NOT_FOUND`, `COMPANY_NOT_FOUND`, `DEAL_NOT_FOUND`, `TASK_NOT_FOUND`, `RECORD_NOT_FOUND`, `RECORD_LINK_INCOMPLETE`, `DUPLICATE_CONTACT`. Endpoints also document their own codes in their section below.

## Operations and health

Unauthenticated endpoints for the container, the load balancer and the developer. They live outside the versioned `/api/v1` base path (mounted on the app root) because they must answer before the rest of the stack is verified.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Readiness: checks Postgres and Redis, `200` when both are up, `503` when either is down |
| GET | `/health/live` | Liveness: always `200`, touches no dependency — use it to detect a hung process |
| GET | `/api/v1/health` | Alias of `/health`, for clients that only know the versioned base path |

Each dependency check is bounded by a timeout (`CHECK_TIMEOUT_MS`, 2000ms) so a hung database cannot hang the response.

`GET /health` — both up:

```json
{ "data": { "status": "ok", "checks": { "database": "ok", "redis": "ok" } } }
```

`GET /health` — Postgres down (status `503`):

```json
{ "data": { "status": "degraded", "checks": { "database": "down", "redis": "ok" } } }
```

`GET /health/live`:

```json
{ "data": { "status": "ok" } }
```

## Common list parameters

`q` (search text), `sort` (for example `-lastTouchAt`), `page`, `pageSize` (max 100), plus filters named in each section.

## Auth and workspace

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Email and password, returns a token. Replaced if the shared app shell provides login |
| POST | `/auth/logout` | End the session |
| GET | `/me` | Current user, workspace, role, language |
| PATCH | `/me` | Update language and profile |
| GET | `/users` | People in the workspace (for owner pickers) |

## Overview

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/overview` | Contact count, open pipeline value, follow-ups due, AI signal count, pipeline value by stage, recent contacts, recent activity |

Response (`overviewSchema` in `packages/shared/src/overview.ts`, computed by `buildOverview`):

| Field | Meaning |
| --- | --- |
| `contactCount`, `contactChange` | Live contacts, and the change against the same day last month as a fraction (`null` if there were none) |
| `openPipeline`, `weightedPipeline`, `activeDeals` | From `summarizeDeals` on the default pipeline, in the workspace currency |
| `followUpsDue`, `dueToday` | Open tasks overdue or due in the next 7 days, and how many are due today (workspace time zone) |
| `aiSignals`, `aiSignalsThisWeek` | `ai_signal` activities in the last 30 days, and since Monday |
| `pipelineByStage` | `{ stageId, value, dealCount }` per open stage, in pipeline order |
| `recentContacts` | 4 contacts touched most recently |
| `recentActivity` | 5 newest activities, each with `recordName` |

## Contacts

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/contacts` | List. Filters: `stage`, `ownerId`, `companyId`, `tag`, `needsFollowUp`, `createdSince`, `segmentId` |
| POST | `/contacts` | Create |
| GET | `/contacts/:id` | Profile, with company and counts |
| PATCH | `/contacts/:id` | Edit |
| DELETE | `/contacts/:id` | Soft delete |
| POST | `/contacts/:id/convert` | Lead to customer |
| GET | `/contacts/:id/timeline` | Activities, notes and tasks for this contact |

`GET /contacts/:id/timeline` returns a list of `TimelineItem` (see `packages/shared/src/timeline.ts`), newest first by `at`: activities (`occurredAt`), notes (`createdAt`, private ones only for their author) and open tasks (`createdAt`).

## Companies

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/companies` | List, with contact count and open deal value |
| POST | `/companies` | Create |
| GET | `/companies/:id` | Detail with people and deals |
| PATCH | `/companies/:id` | Edit |
| DELETE | `/companies/:id` | Soft delete. The company's contacts and deals keep their link |

`GET /companies` filters: `ownerId`, `industry`, `health` (`strong`, `watch`, `new`). `q` searches name, domain and industry. `sort`: `name`, `contactCount`, `openDealValue` or `lastTouchAt`, default `-openDealValue`. Each item is the company plus numbers computed from its records (`summarizeCompany` in `packages/shared`):

```json
{
  "id": "company_atlas",
  "name": "Atlas Logistics",
  "domain": "atlaslogistics.co",
  "industry": "Logistics",
  "size": "11-50",
  "ownerId": "user_jamie",
  "contactCount": 1,
  "openDealValue": { "amount": 42500, "currency": "EUR" },
  "openDealCount": 1,
  "otherCurrencyDeals": 0,
  "lastTouchAt": "2026-10-16T16:18:00.000Z",
  "health": "strong"
}
```

- `openDealValue` is in the workspace's default currency. `otherCurrencyDeals` counts open deals in another currency that are left out of it.
- `lastTouchAt` is the latest `lastTouchAt` of the company's contacts.
- `health` follows `companyHealth` in `packages/shared`: `strong` when a deal is won or an open deal is at 70% or more and a contact was touched in the last 30 days; `new` when no deal has moved past the first stage; `watch` otherwise.
- `GET /companies/:id` returns the same fields plus `contacts` (most recent touch first) and `deals`.
- `domain` is a bare host name (`northstar.studio`), stored in lower case. `size` is one of `1-10`, `11-50`, `51-200`, `201+`.
- Errors: `COMPANY_NOT_FOUND`.

## Deals and pipeline

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/pipelines` | Pipelines with their stages |
| GET | `/deals` | List. Filters: `stageId`, `ownerId`, `companyId`, `contactId`, `status` (`open`, `won`, `lost`) |
| POST | `/deals` | Create |
| GET | `/deals/:id` | Detail |
| PATCH | `/deals/:id` | Edit. Cannot change the stage: use `/move` |
| POST | `/deals/:id/move` | Move to another stage, body `{ stageId }`. Updates probability and closedAt |
| DELETE | `/deals/:id` | Soft delete |
| GET | `/deals/summary` | Open value, weighted value, win rate, active deals, average days to close |

`GET /deals/summary` takes an optional `pipelineId` (default pipeline if left out) and returns:

```json
{
  "data": {
    "openValue": { "amount": 97900, "currency": "EUR" },
    "weightedValue": { "amount": 61765, "currency": "EUR" },
    "winRate": 0.63,
    "activeDeals": 4,
    "averageDaysToClose": 14,
    "otherCurrencyDeals": 0
  }
}
```

- Money is in the workspace's default currency. `otherCurrencyDeals` counts open deals in another currency that are left out of the totals.
- `winRate` is won / (won + lost); `averageDaysToClose` is the mean of `closedAt - createdAt` for won deals. Both are `null` when there are no closed deals yet.
- Errors from `/move`: `STAGE_NOT_FOUND`, `STAGE_IN_OTHER_PIPELINE`.

Schemas: `packages/shared/src/pipeline.ts` and `deal.ts`.

- `POST /deals`: currency defaults to the workspace currency, probability to the stage's, owner to the current user. A deal created straight into Won or Lost gets `closedAt`.
- `PATCH /deals/:id` returns 400 `VALIDATION_ERROR` if the body has `stageId`.
- `POST /deals/:id/move` returns the updated deal and logs a `stage_changed` activity (`{ fromStageId, toStageId }`). Moving to the current stage changes nothing.
- `DELETE /deals/:id` returns 204.
- Move errors: `STAGE_NOT_FOUND` (404) and `STAGE_IN_OTHER_PIPELINE` (400).
- A missing deal is `DEAL_NOT_FOUND` (404); a missing pipeline on `/deals/summary` is `PIPELINE_NOT_FOUND` (404). Responses use the shared `dealSchema` shape.

## Tasks, notes, activities

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/tasks` | List. Filters: `ownerId`, `done` (`true` or `false`), `dueBefore`, `recordType`, `recordId` |
| POST | `/tasks` | Create |
| PATCH | `/tasks/:id` | Edit or mark done. Changing `done` sets `doneAt` and logs a `task` activity |
| DELETE | `/tasks/:id` | Soft delete |
| GET | `/notes` | List. Filters: `recordType`, `recordId`, `visibility`. Private notes only for their author |
| POST | `/notes` | Create |
| PATCH | `/notes/:id` | Edit |
| DELETE | `/notes/:id` | Soft delete |
| GET | `/activities` | Timeline. Filters: `recordType`, `recordId`, `type` |
| POST | `/activities` | Log an activity by hand |
| POST | `/events` | Other modules post an event (see below) |

`GET /notes` returns `noteSchema` rows, most recently edited first. Filters: `q` (title and body), `visibility`, `recordType` with `recordId`. Private notes of other users are left out, for every role.

- `POST /notes` takes `title` (required, up to 200 characters), `body` (up to 10,000), `visibility` (`shared` by default) and an optional link (`recordType` plus `recordId`). The author is the current user.
- `PATCH /notes/:id` takes the same fields. Send `recordType` and `recordId` together, or both as `null` to unlink the note. The author does not change.
- Errors: `NOTE_NOT_FOUND` (also for someone else's private note, so its existence is not revealed), `RECORD_NOT_FOUND` when the linked record is not in the workspace, `VALIDATION_ERROR` with `RECORD_LINK_INCOMPLETE` for a half link.

Schemas: `packages/shared/src/note.ts`. Who sees what: `canSeeNote` and `filterNotes` in `note-logic.ts`.

## Segments

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/segments` | List with live member count |
| POST | `/segments` | Create with filter rules |
| PATCH | `/segments/:id` | Edit |
| DELETE | `/segments/:id` | Delete |
| GET | `/segments/:id/contacts` | Contacts in the segment |

A segment's `rules` (schema: `segmentRulesSchema` in `packages/shared/src/segment.ts`):

```json
{
  "match": "all",
  "conditions": [
    { "field": "lifecycleStage", "op": "is", "value": "qualified" },
    { "field": "lastTouch", "op": "within_days", "value": 14 }
  ]
}
```

| Field | Operators | Value |
| --- | --- | --- |
| `lifecycleStage` | `is`, `is_not` | a lifecycle stage |
| `ownerId` | `is`, `is_not` | a user id |
| `tag` | `has`, `has_not` | tag text (case does not matter) |
| `marketingConsent` | `is` | `true` or `false` |
| `lastTouch` | `within_days`, `older_than_days` | number of days (never-touched contacts count as older) |
| `lastTouch` | `never` | none |
| `followUp` | `due` | none: an open task on the contact is due today or earlier |
| `openDeal` | `exists`, `none` | none: the contact is on an open deal, or not |

`match` is `all` or `any`; 1 to 20 conditions. Membership is worked out by `segmentMembers` in `packages/shared`, which the API, the `segments.refresh` job and the web app's live preview all use. `GET /segments` returns each segment with `memberCount`. Errors: `SEGMENT_NOT_FOUND`.

## Import

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/imports` | Upload a CSV or XLSX (max 10,000 rows). Returns the job and detected columns |
| GET | `/imports/:id` | Status, counts, mapping |
| PUT | `/imports/:id/mapping` | Save the field mapping |
| GET | `/imports/:id/preview` | First rows as they will be imported, and duplicates found |
| POST | `/imports/:id/confirm` | Start the background import. Options: default owner, tag, duplicate handling (`hold`, `skip`, `update`) |
| GET | `/imports/:id/held` | Held duplicates to review |
| POST | `/imports/:id/held/:rowId/resolve` | `skip`, `create`, or `merge` |

Import details (schemas: `packages/shared/src/import.ts`, rules: `import-logic.ts`):

- **Upload:** `POST /imports` takes `multipart/form-data` with the file in the field `file`. It returns the job with `status: "uploaded"`, `columns`, `sampleRow` (the first data row) and a guessed `mapping` (`guessMapping`).
- **Mapping:** source column to Lulu field: `name`, `firstName`, `lastName`, `email`, `phone`, `company`, `jobRole`, `source`, `lifecycleStage`, `tags` or `ignore`. Each field takes one column at most.
- **Preview:** `GET /imports/:id/preview` returns counts for the whole file (`newCount`, `duplicateCount`, `problemCount`) and the first 20 rows, each with `problems` (`nameMissing`, `emailInvalid`, `stageUnknown`) and `duplicateOfContactId` / `duplicateMatch` (`email` or `nameAndCompany`).
- **Confirm:** `POST /imports/:id/confirm` starts the `import.process` job and returns at once with `status: "processing"`. The web app polls `GET /imports/:id` until `done` or `failed`. Rows with problems are skipped. Duplicates are held, skipped or used to update the existing contact (`mergeIntoContact`, mode `overwrite`). New contacts get the default owner, the tag, source `import` when the file has none, and the workspace consent rules.
- **Held rows:** `merge` fills empty fields of the existing contact and adds tags (`mergeIntoContact`, mode `fill`); `create` adds the row as a new contact; `skip` drops it.
- **Companies:** a company name that matches an existing company (ignoring case) links to it; otherwise a company is created.
- **Errors:** `IMPORT_NOT_FOUND`, `IMPORT_EMPTY`, `IMPORT_TOO_MANY_ROWS` (over 10,000 rows), `IMPORT_FILE_UNREADABLE`, `IMPORT_ALREADY_STARTED`, `IMPORT_ROW_NOT_FOUND`.

## AI analysis

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/contacts/:id/ai-analysis` | Run analysis as a background job, returns the job |
| GET | `/contacts/:id/ai-insights` | Latest insight: summary, next step, data quality |
| POST | `/ai-insights/:id/accept` | The user confirms. Only then are changes saved |
| POST | `/ai-insights/:id/dismiss` | Dismiss |

AI runs behind one provider interface. A simulated provider answers until a model key is available.

AI details (schemas: `packages/shared/src/ai.ts`, provider interface and the simulated provider: `ai-logic.ts`):

- **Run:** `POST /contacts/:id/ai-analysis` queues `ai.analyze` and returns `{ jobId, status }`. The web app polls `GET /contacts/:id/ai-insights` (the newest insight, or `null`) until one newer than the run appears.
- **Insight:** `summary`, `nextStep { title, detail }`, `suggestedTask { title, dueAt }` or `null`, `suggestedStage` or `null`, `dataQualityScore` (0 to 1 over email, phone, company, role, source), `missingFields`, `status` (`suggested`, `accepted`, `dismissed`), `provider` (`simulated` or `model`).
- **AI text:** either `{ key, params }` (the simulated provider; the web app shows `aiAnalysis.generated.<key>`) or `{ text, language }` (a real model, asked to write in the user's language). The server never sends one-language text for the simulated provider.
- **Accept:** `POST /ai-insights/:id/accept` with `{ createTask, taskTitle, applyStage }`. Only the ticked changes are saved; the task title is the text the user confirmed. This is the only way an insight changes a record. Errors: `AI_INSIGHT_NOT_FOUND`, `AI_INSIGHT_CLOSED`.
- **Switches:** `autoUpdateFields` only pre-ticks field changes in the confirm step. Nothing is ever saved without confirmation.

## Settings

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST, PATCH, DELETE | `/settings/custom-fields` | Custom contact fields |
| GET, POST, PATCH, DELETE | `/settings/pipelines` and `/settings/stages` | Pipelines and stages |
| GET, PUT | `/settings/roles` | Roles and permissions |
| GET, PUT | `/settings/consent` | Consent and privacy rules |
| GET, PUT | `/settings/notifications` | Notification rules |
| GET, PUT | `/settings/ai` | AI switches (analyze new activity, suggest follow-ups, auto-update fields) |

Settings details (schemas: `packages/shared/src/settings.ts`, defaults and the permission check: `settings-logic.ts`):

- **Who:** only roles with `settings: edit` may change settings (owners always). The web app shows the screens read-only to everyone else.
- **Custom fields:** `key` (lowercase, set once from the label with `fieldKeyFromLabel`), `label`, `type` (`text`, `number`, `date`, `select`, `checkbox`), `options` (required for `select`). PATCH changes only `label` and `options`. Errors: `CUSTOM_FIELD_NOT_FOUND`, `CUSTOM_FIELD_KEY_TAKEN`.
- **Stages:** `POST /settings/stages` adds an open stage after the other open stages (Won and Lost stay last). PATCH takes `name`, `probability` and `order` (position among open stages). Renaming a default stage sets its `key` to `null`. Changing a probability does not change existing deals. Errors: `STAGE_LOCKED` (Won and Lost cannot be deleted), `STAGE_IN_USE` (the stage still has deals).
- **Roles:** `{ admin: { contacts: ["view", ...], ... }, member: { ... } }`. Resources: `contacts`, `companies`, `deals`, `tasks`, `notes`, `segments`, `imports`, `settings`; actions: `view`, `create`, `edit`, `delete`. Owners are not stored. The API's role guard uses `can()`.
- **Consent:** `requireConsentForMarketing`, `requireConsentEvidence`, `importedContactsConsent` (`not_granted` by default).
- **Notifications:** per event (`taskAssigned`, `taskDue`, `dealAssigned`, `dealStageChanged`, `leadAssigned`, `importFinished`) `{ inApp, email }`.

## Events from other modules

Email, Calendar and other modules tell the CRM something happened with `POST /events` (schema: `moduleEventSchema` in `packages/shared/src/activity.ts`):

```json
{
  "type": "email.received",
  "sourceModule": "email",
  "occurredAt": "2026-10-17T09:42:00Z",
  "contact": { "email": "sophie@northstar.studio" },
  "summary": "Reply received from Sophie Laurent",
  "payload": { }
}
```

The CRM finds the contact by email, creates an `Activity`, and updates `lastTouchAt`. Event types start with `email.`, `calendar.` or `marketplace.`. The CRM can send events the other way (for example "prepare a follow-up in Email") through the same format.

## Background jobs (BullMQ)

`import.process`, `ai.analyze`, `segments.refresh`, `notifications.send`.
