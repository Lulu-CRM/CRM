# API (draft)

Base path: `/api/v1`. JSON only. Authenticated with a bearer token. The workspace comes from the token, never from the request body. Response format is in `AGENTS.md`.

This list is the contract for the frontend and the backend. Add or change an endpoint here in the same pull request as the code.

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

## Segments

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/segments` | List with live member count |
| POST | `/segments` | Create with filter rules |
| PATCH | `/segments/:id` | Edit |
| DELETE | `/segments/:id` | Delete |
| GET | `/segments/:id/contacts` | Contacts in the segment |

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

## AI analysis

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/contacts/:id/ai-analysis` | Run analysis as a background job, returns the job |
| GET | `/contacts/:id/ai-insights` | Latest insight: summary, next step, data quality |
| POST | `/ai-insights/:id/accept` | The user confirms. Only then are changes saved |
| POST | `/ai-insights/:id/dismiss` | Dismiss |

AI runs behind one provider interface. A simulated provider answers until a model key is available.

## Settings

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST, PATCH, DELETE | `/settings/custom-fields` | Custom contact fields |
| GET, POST, PATCH, DELETE | `/settings/pipelines` and `/settings/stages` | Pipelines and stages |
| GET, PUT | `/settings/roles` | Roles and permissions |
| GET, PUT | `/settings/consent` | Consent and privacy rules |
| GET, PUT | `/settings/notifications` | Notification rules |
| GET, PUT | `/settings/ai` | AI switches (analyze new activity, suggest follow-ups, auto-update fields) |

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
