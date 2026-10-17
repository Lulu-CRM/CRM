# Data model (draft)

Every table has `id`, `workspaceId`, `createdAt`, `updatedAt`, and `deletedAt` for soft delete. The backend dev who owns the schema refines this and records changes here.

The prototype in `design/` stores money, dates and links as text. This model replaces that with real fields.

## Entities

| Entity | Key fields |
| --- | --- |
| Workspace | name, defaultCurrency, defaultLanguage |
| User | name, email, language, role (`owner`, `admin`, `member`), workspaceId |
| Contact | name, email, phone, companyId, jobRole, source, lifecycleStage, ownerId, tags, marketingConsent, consentUpdatedAt, lastTouchAt |
| Company | name, domain, industry, size, ownerId |
| Pipeline | name, isDefault |
| Stage | pipelineId, name, order, probability, type (`open`, `won`, `lost`) |
| Deal | name, value (number), currency, stageId, probability, expectedCloseAt, contactId, companyId, ownerId, closedAt |
| Task | title, dueAt, priority (`high`, `normal`, `low`), ownerId, done, doneAt, linked record |
| Note | title, body, visibility (`shared`, `private`), authorId, linked record |
| Activity | type, linked record, occurredAt, sourceModule, actorId, payload |
| Segment | name, description, rules (JSON), color |
| ImportJob | fileName, status, mapping (JSON), rowsTotal, rowsAdded, rowsHeld, ownerId, tag |
| ImportRow | importJobId, rowNumber, raw (JSON), status (`added`, `held`, `skipped`), duplicateOfContactId |
| AiInsight | contactId, summary, nextStep, dataQualityScore, missingFields, status (`suggested`, `accepted`, `dismissed`) |
| CustomField | entity, key, label, type, options |
| Setting | key, value (JSON): consent rules, notification rules, AI switches |
| Permission | role, resource, actions |

"Linked record" on Task, Note and Activity means `recordType` (`contact`, `company`, `deal`) plus `recordId`.

## Enums

- **Contact lifecycle stage:** `new`, `qualified`, `follow_up`, `customer`
- **Contact source:** `website_form`, `referral`, `email`, `import`, `marketplace`, `instagram`, plus custom values
- **Activity type:** `email`, `meeting`, `task`, `note`, `ai_signal`, `created`, `stage_changed`
- **Source module:** `crm`, `email`, `calendar`, `online_presence`, `marketplace`

## Decisions

- **One stage model.** The prototype has three different stage lists. A lead is a contact whose lifecycle stage is `new`, `qualified` or `follow_up`. Converting a lead sets the stage to `customer`. Deals use their own configurable stages (`Stage`) and gain `won` and `lost` types, so win rate can be calculated.
- **Money.** `value` is a decimal number, `currency` is an ISO code (for example `EUR`). The platform supports more than one currency.
- **Pipeline totals and win rate** are computed on the server, not stored.
- **Duplicates.** A possible duplicate of a contact is matched on email first, then on name plus company. Duplicates are held for review, never merged automatically.
- **Consent.** `marketingConsent` and its timestamp are stored on the contact, and imported contacts inherit the workspace rules.
- **Activity feed from other modules.** Email, Calendar and others create `Activity` rows through the event format in `docs/api.md`.
- **Delete.** Soft delete everywhere. Permanent deletion is a later feature.

## Indexes to add early

`(workspaceId, email)` on Contact, `(workspaceId, companyId)` on Contact and Deal, `(workspaceId, stageId)` on Deal, `(workspaceId, ownerId, done, dueAt)` on Task, and a text index on Contact name, email and company name for search.
