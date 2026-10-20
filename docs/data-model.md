# Data model

Every table has `id`, `workspaceId`, `createdAt`, `updatedAt`, and `deletedAt` for soft delete. This document matches `apps/api/prisma/schema.prisma`; change both in the same pull request.

The prototype in `design/` stores money, dates and links as text. This model replaces that with real fields.

## Base fields (the pattern every new model follows)

In `apps/api/prisma/schema.prisma`, every workspace-scoped model carries:

```prisma
model Example {
  id          String    @id @default(uuid())
  workspaceId String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  workspace Workspace @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId])
  @@map("examples")
}
```

Rules: `@@map` uses snake_case plural table names, model names are PascalCase singular. `Workspace` itself has no `workspaceId`. After adding a model to the schema, add its delegate name to `SCOPED_MODELS` in `apps/api/src/db/scoped.ts` so scoping and soft delete apply to it.

## Query rule

**All application queries go through `scopedDb(workspaceId)`** (`apps/api/src/db/scoped.ts`). It forces `workspaceId` and `deletedAt = null` into reads, stamps `workspaceId` on create, forces it into update/upsert `where`, and converts `delete`/`deleteMany` into soft deletes. The base client (`src/db/prisma.ts`) is only for the `Workspace` table, migrations, and infrastructure code. Hard delete is never exposed through `scopedDb`.

## Entities

| Entity | Key fields |
| --- | --- |
| Workspace | name, defaultCurrency, defaultLanguage |
| User | name, email, language, role (`owner`, `admin`, `member`), workspaceId |
| Contact | name, email, phone, companyId, jobRole, source, lifecycleStage, ownerId, tags, marketingConsent, consentUpdatedAt, lastTouchAt, customFields (JSON) |
| Company | name, domain (bare host name, lower case), industry, size (`1-10`, `11-50`, `51-200`, `201+`), ownerId. Contact count, open deal value, last touch and health are computed, not stored |
| Pipeline | key, name, isDefault |
| Stage | pipelineId, key, name, order, probability, type (`open`, `won`, `lost`) |
| Deal | name, value (number), currency, stageId, probability, expectedCloseAt, contactId, companyId, ownerId, closedAt |
| Task | title, dueAt, priority (`high`, `normal`, `low`), ownerId, done, doneAt, linked record |
| Note | title, body, visibility (`shared`, `private`), authorId, linked record |
| Activity | type, linked record, occurredAt, sourceModule, actorId, payload, summary |
| Segment | name, description, rules (JSON, format in `docs/api.md`), color (`violet`, `coral`, `blue`, `mint`, `peach`; defaults to `violet`) |
| ImportJob | fileName, status (`uploaded`, `processing`, `done`, `failed`), columns, sampleRow (JSON), mapping (JSON), rowsTotal, rowsAdded, rowsUpdated, rowsHeld, rowsSkipped, ownerId, tag, duplicateHandling (`hold`, `skip`, `update`), error |
| ImportRow | importJobId, rowNumber, raw (JSON), status (`pending`, `added`, `updated`, `held`, `skipped`, `merged`), contact (JSON, for held rows), duplicateMatch, duplicateOfContactId |
| AiInsight | contactId, provider, summary (JSON AI text), nextStep (JSON `{ title, detail }`), suggestedTask (JSON or null), suggestedStage, dataQualityScore, missingFields, status (`suggested`, `accepted`, `dismissed`) |
| CustomField | entity, key, label, type, options |
| Setting | key, value (JSON): consent rules, notification rules, AI switches |
| Permission | role, resource, actions |

"Linked record" on Task, Note and Activity means `recordType` (`contact`, `company`, `deal`) plus `recordId`. Both are set or both are `null`: a task or a note can stand on its own (and ticking an unlinked task logs an activity without a record), but a half link is rejected.

## Enums

These are the `enum` types in `schema.prisma`. The first block is database enums (the name in parentheses is the `@@map` DB type name where it differs from the model name). The second block is open value sets: columns typed `String`, validated in the API.

- **Role:** `owner`, `admin`, `member`
- **LifecycleStage** (`lifecycle_stage`): `new`, `qualified`, `follow_up`, `customer`
- **StageType** (`stage_type`): `open`, `won`, `lost`
- **TaskPriority** (`task_priority`): `high`, `normal`, `low`
- **NoteVisibility** (`note_visibility`): `shared`, `private`
- **RecordType** (`record_type`): `contact`, `company`, `deal`
- **ActivityType** (`activity_type`): `email`, `meeting`, `task`, `note`, `ai_signal`, `created`, `stage_changed`, `marketplace`
- **SourceModule** (`source_module`): `crm`, `email`, `calendar`, `online_presence`, `marketplace`
- **ImportJobStatus** (`import_job_status`): `uploaded`, `processing`, `done`, `failed`
- **ImportRowStatus** (`import_row_status`): `pending` (stored at upload, not processed yet), `added`, `updated`, `held`, `skipped`, `merged`
- **AiInsightStatus** (`ai_insight_status`): `suggested`, `accepted`, `dismissed`

Open value sets (`String` columns, not DB enums — validated in the API):

- **Contact source:** `website_form`, `referral`, `email`, `import`, `marketplace`, `instagram`, plus custom values
- **Segment color:** `violet`, `coral`, `blue`, `mint`, `peach`

## Decisions

- **One stage model.** The prototype has three different stage lists. A lead is a contact whose lifecycle stage is `new`, `qualified` or `follow_up`. Converting a lead sets the stage to `customer`. Deals use their own configurable stages (`Stage`) and gain `won` and `lost` types, so win rate can be calculated.
- **Money.** `value` is a decimal number, `currency` is an ISO code (for example `EUR`). The platform supports more than one currency.
- **Pipeline totals and win rate** are computed on the server, not stored. The calculation lives in `packages/shared` (`summarizeDeals`, `moveDeal`) so the API and the board's optimistic update give the same numbers.
- **Probability and rates** are fractions from 0 to 1 (`0.7`, not `70`), on Stage and Deal and in the deal summary. The UI formats them with `Intl`.
- **Default stage and pipeline names are translated.** Default rows have a `key` (`new`, `qualified`, `proposal`, `negotiation`, `won`, `lost`; pipeline `sales`) and the UI shows the translation for that key. Rows a workspace adds itself have `key = null` and show `name`.
- **Moving a deal** sets its probability to the new stage's probability. Moving to a `won` or `lost` stage sets `closedAt`; moving back to an `open` stage clears it; moving between `won` and `lost` keeps the first close date.
- **Totals in one currency.** Deal summaries add up deals in the workspace's `defaultCurrency` only. Open deals in other currencies are counted, not converted, until we add exchange rates.
- **Duplicates.** A possible duplicate of a contact is matched on email first, then on name plus company. Duplicates are held for review, never merged automatically.
- **Consent.** `marketingConsent` and its timestamp are stored on the contact, and imported contacts inherit the workspace rules.
- **Activity feed from other modules.** Email, Calendar and others create `Activity` rows through the event format in `docs/api.md`. The module's own event type stays in `payload.eventType`; its `summary` is kept in `summary` for reference, but the UI builds the line from `type` through the translation files.
- **User table exists now.** Created in `init_base` migration with `passwordHash String?` (nullable) so the login task needs no extra migration. `User.email` is **globally unique** (`@unique`, not per-workspace): login uses email alone, and a user belongs to exactly one workspace.
- **Auth is stateless.** The seed sets `passwordHash` (bcrypt, cost `PASSWORD_HASH_ROUNDS`). Login checks the password and returns a signed HS256 JWT (`AUTH_TOKEN_TTL`) carrying `userId`, `workspaceId`, `role`, `jti` and `exp`. No token is stored server-side: logout only remembers the revoked `jti` in Redis until the token's own expiry, so the denylist key is the single piece of session state.
- **Role guard.** The workspace comes from the token, and the user row is reloaded on every request so a role change takes effect at once. Permissions are the shared `defaultPermissions`, overridden per role and resource by rows in the `Permission` table (`role`, `resource`, `actions`).
- **Delete.** Soft delete everywhere. Permanent deletion is a later feature. The API enforces this: `scopedDb` converts every `delete` into `deletedAt = now()`. All foreign keys are `onDelete: Restrict` in the schema, so a hard cascade can never remove rows behind the soft delete.
- **Contact.customFields.** `Json` column defaulting to `{}` on Contact, so ST-1 custom field values have a place to live before the CustomField definition UI maps keys to types. The `CustomField` model defines the definitions; this column holds the values.
- **Contact.source is a nullable String with no default.** Source values are open (`website_form`, `referral`, `email`, `import`, `marketplace`, `instagram`, plus custom), so the database assumes nothing; the API validates known values.
- **ImportJobStatus enum values:** `uploaded`, `processing`, `done`, `failed`, matching `importStatusSchema` in `packages/shared/src/import.ts` (migration `import_contract`; `mapped` folded into `uploaded`, `completed` renamed `done`).
- **Decimal precision.** `Stage.probability` and `Deal.probability` are `Decimal(5,4)` (0 to 1, four decimals); `Deal.value` is `Decimal(14,2)`. The 0–1 range is validated in the API (Zod), not by a DB `CHECK` constraint — Prisma Migrate treats unknown checks as drift and would drop them in a later migration. Prisma returns `Decimal` columns as JS Decimal objects; the API serializes them per the money rule.
- **Trigram search.** The migration creates `pg_trgm` and GIN trigram indexes on `lower(contacts.name)`, `lower(contacts.email)` and `lower(companies.name)` for case-insensitive search (the "text index" from the indexes section). Creating the extension needs a database user allowed to `CREATE EXTENSION`.
- **Enum naming.** `Role` keeps its original DB type name (already migrated). New enums are mapped to snake_case DB type names with `@@map` (`lifecycle_stage`, `stage_type`, …).
- **Linked record is polymorphic.** Task, Note and Activity store `recordType` + `recordId` (string id), not foreign keys — so there is no `ON DELETE` behavior to define and rows from other modules (Email, Calendar) can be linked without shared tables. `(workspaceId, recordType, recordId)` indexes back these lookups.
- **Due dates.** A due date picked without a time is stored at 12:00 UTC, so it stays on the same calendar day in every time zone we serve. Chips (`overdue`, `today`, `tomorrow`, `this_week`, `later`, `done`) are worked out by calendar day in the user's time zone (`dueKind` in `packages/shared`).
- **Activities store facts, not sentences.** An activity has a `type` and a `payload` (for example `{ "taskId": "...", "action": "completed" }`). The UI builds the line from the translation files, so the timeline reads in the user's language. Only `summary` from other modules' events is free text.
- **Ticking a task** sets `done` and `doneAt` and adds a `task` activity to the timeline (`action: completed`); unticking clears `doneAt` and adds `action: reopened`.
- **Private notes.** A private note is seen, edited and deleted only by its author. Shared notes are seen and edited by everyone in the workspace. A note's link to a contact, company or deal can be changed after saving.
- **Segments are rules, not lists.** A segment stores filter rules; its members are worked out when asked (`segmentMembers` in `packages/shared`). "Due today" for follow-ups uses UTC on the server until workspaces have a time zone.

## Indexes to add early

`(workspaceId, email)` on Contact, `(workspaceId, companyId)` on Contact and Deal, `(workspaceId, stageId)` on Deal, `(workspaceId, ownerId, done, dueAt)` on Task, and a text index on Contact name, email and company name for search.
