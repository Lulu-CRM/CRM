import {
  ERROR_CODES,
  type Contact,
  type ContactCreateInput,
  type ContactListQuery,
  type ContactUpdateInput,
  type Company,
} from '@lulu/shared';
import { db } from '../db/prisma';
import { scopedDb, type DbTx } from '../db/scoped';
import type { Prisma } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { toSharedCompany } from './companyMapper';
import { toSharedContact } from './contactMapper';
import { loadMembershipData, memberIds } from './segmentMembership';

const SORTABLE = ['name', 'email', 'lifecycleStage', 'lastTouchAt', 'createdAt', 'updatedAt'];

// Specific codes, because the web app translates errors by code (errors.CONTACT_NOT_FOUND, ...).
function notFound(): AppError {
  return AppError.notFound(ERROR_CODES.CONTACT_NOT_FOUND);
}

function parseSort(sort: string | undefined): Prisma.ContactOrderByWithRelationInput {
  const raw = sort ?? '-lastTouchAt';
  const descending = raw.startsWith('-');
  const field = descending ? raw.slice(1) : raw;
  if (!SORTABLE.includes(field)) {
    throw AppError.validation([
      { path: 'sort', code: 'invalid_value', message: 'errors.validation.invalid_value' },
    ]);
  }
  const order = descending ? 'desc' : 'asc';
  // Nullable columns: the mock sorts nulls like an empty string, so they come first
  // ascending and last descending. Prisma's default would put them first descending.
  if (field === 'lastTouchAt' || field === 'email') {
    return { [field]: { sort: order, nulls: descending ? 'last' : 'first' } };
  }
  return { [field]: order };
}

async function assertExists(path: string, lookup: Promise<unknown>): Promise<void> {
  if ((await lookup) === null) {
    throw AppError.validation([{ path, code: 'custom', message: 'errors.validation.custom' }]);
  }
}

async function assertReferences(
  scoped: DbTx,
  input: { companyId?: string | null | undefined; ownerId?: string | undefined },
): Promise<void> {
  if (input.companyId) {
    await assertExists(
      'companyId',
      scoped.company.findFirst({ where: { id: input.companyId }, select: { id: true } }),
    );
  }
  if (input.ownerId) {
    await assertExists(
      'ownerId',
      scoped.user.findFirst({ where: { id: input.ownerId }, select: { id: true } }),
    );
  }
}

// Manual creates and edits block only an email that is already used (ignoring case). Two people
// can share a name at one company, so name + company is only a hint for imports, where
// findDuplicate (packages/shared/src/import-logic.ts) holds the row for review instead.
async function assertNotDuplicate(
  scoped: DbTx,
  candidate: { email?: string | null | undefined },
  excludeId?: string,
): Promise<void> {
  const exclude = excludeId === undefined ? {} : { id: { not: excludeId } };
  if (candidate.email !== null && candidate.email !== undefined && candidate.email.trim() !== '') {
    const byEmail = await scoped.contact.findFirst({
      where: { email: { equals: candidate.email.trim(), mode: 'insensitive' }, ...exclude },
      select: { id: true },
    });
    if (byEmail !== null) throw AppError.conflict(ERROR_CODES.DUPLICATE_CONTACT);
  }
}

// Tags are a String[] column, which Prisma can only match exactly. A substring search needs
// plain SQL (the pg_trgm indexes on contacts.name/email do not cover arrays).
async function tagMatchIds(workspaceId: string, q: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT c.id
    FROM contacts c
    WHERE c."workspaceId" = ${workspaceId}
      AND c."deletedAt" IS NULL
      AND EXISTS (
        SELECT 1 FROM unnest(c.tags) AS t
        WHERE strpos(lower(t), lower(${q})) > 0
      )`;
  return rows.map((row) => row.id);
}

// The segment's live members, with the same shared rules as GET /segments (services/segmentMembership.ts).
export async function segmentMemberIds(ctx: RequestContext, segmentId: string): Promise<string[]> {
  const scoped = scopedDb(ctx.workspaceId);
  const segment = await scoped.segment.findFirst({ where: { id: segmentId } });
  if (segment === null) throw AppError.notFound(ERROR_CODES.SEGMENT_NOT_FOUND);
  return memberIds(await loadMembershipData(scoped), segment.rules);
}

async function buildWhere(
  ctx: RequestContext,
  query: ContactListQuery,
): Promise<Prisma.ContactWhereInput> {
  const where: Prisma.ContactWhereInput = {};
  if (query.q !== undefined) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { email: { contains: query.q, mode: 'insensitive' } },
      { company: { name: { contains: query.q, mode: 'insensitive' } } },
      { id: { in: await tagMatchIds(ctx.workspaceId, query.q) } },
    ];
  }
  if (query.stage !== undefined) where.lifecycleStage = query.stage;
  if (query.ownerId !== undefined) where.ownerId = query.ownerId;
  if (query.companyId !== undefined) where.companyId = query.companyId;
  if (query.tag !== undefined) where.tags = { has: query.tag };
  if (query.createdSince !== undefined) where.createdAt = { gte: new Date(query.createdSince) };

  const and: Prisma.ContactWhereInput[] = [];
  if (query.needsFollowUp === true) and.push({ lifecycleStage: 'follow_up' });
  if (query.segmentId !== undefined)
    and.push({ id: { in: await segmentMemberIds(ctx, query.segmentId) } });
  if (and.length > 0) where.AND = and;
  return where;
}

export type ContactDetail = Contact & { company: Company | null };

export async function listContacts(
  ctx: RequestContext,
  query: ContactListQuery,
): Promise<{ items: Contact[]; total: number }> {
  const scoped = scopedDb(ctx.workspaceId);
  const where = await buildWhere(ctx, query);
  const [items, total] = await Promise.all([
    scoped.contact.findMany({
      where,
      orderBy: [parseSort(query.sort), { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    scoped.contact.count({ where }),
  ]);
  return { items: items.map(toSharedContact), total };
}

export async function getContact(ctx: RequestContext, id: string): Promise<ContactDetail> {
  const scoped = scopedDb(ctx.workspaceId);
  const row = await scoped.contact.findFirst({ where: { id } });
  if (row === null) throw notFound();
  const companyRow =
    row.companyId === null
      ? null
      : await scoped.company.findFirst({ where: { id: row.companyId } });
  return {
    ...toSharedContact(row),
    company: companyRow === null ? null : toSharedCompany(companyRow),
  };
}

export async function createContact(
  ctx: RequestContext,
  input: ContactCreateInput,
): Promise<Contact> {
  const scoped = scopedDb(ctx.workspaceId);
  await assertReferences(scoped, input);
  await assertNotDuplicate(scoped, input);

  const consentUpdatedAt = new Date();
  const row = await scoped.contact.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      companyId: input.companyId ?? null,
      jobRole: input.jobRole ?? null,
      source: input.source ?? null,
      lifecycleStage: input.lifecycleStage ?? 'new',
      ownerId: input.ownerId ?? ctx.userId,
      tags: input.tags ?? [],
      marketingConsent: input.marketingConsent ?? false,
      consentUpdatedAt: input.marketingConsent === undefined ? null : consentUpdatedAt,
    },
  });
  return toSharedContact(row);
}

/** PATCH /contacts/:id. `tx` runs it inside a caller's transaction (AI acceptance uses the same path). */
export async function updateContact(
  ctx: RequestContext,
  id: string,
  input: ContactUpdateInput,
  tx?: DbTx,
): Promise<Contact> {
  const scoped: DbTx = tx ?? scopedDb(ctx.workspaceId);
  const existing = await scoped.contact.findFirst({ where: { id } });
  if (existing === null) throw notFound();
  await assertReferences(scoped, input);
  await assertNotDuplicate(
    scoped,
    { email: input.email !== undefined ? input.email : existing.email },
    id,
  );

  const row = await scoped.contact.update({
    where: { id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.email === undefined ? {} : { email: input.email }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.companyId === undefined ? {} : { companyId: input.companyId }),
      ...(input.jobRole === undefined ? {} : { jobRole: input.jobRole }),
      ...(input.source === undefined ? {} : { source: input.source }),
      ...(input.lifecycleStage === undefined ? {} : { lifecycleStage: input.lifecycleStage }),
      ...(input.ownerId === undefined ? {} : { ownerId: input.ownerId }),
      ...(input.tags === undefined ? {} : { tags: input.tags }),
      ...(input.marketingConsent === undefined ? {} : { marketingConsent: input.marketingConsent }),
    },
  });
  return toSharedContact(row);
}

export async function deleteContact(ctx: RequestContext, id: string): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  const existing = await scoped.contact.findFirst({ where: { id } });
  if (existing === null) throw notFound();
  await scoped.contact.delete({ where: { id } });
}

// POST /contacts/:id/convert — a lead becomes a customer (docs/data-model.md, "Leads").
// Logs a stage_changed activity in the same transaction, like the deals /move endpoint.
export async function convertContact(ctx: RequestContext, id: string): Promise<Contact> {
  const scoped = scopedDb(ctx.workspaceId);
  return scoped.$transaction(async (tx) => {
    const row = await tx.contact.findFirst({ where: { id } });
    if (row === null) throw notFound();
    if (row.lifecycleStage === 'customer') return toSharedContact(row);

    const updated = await tx.contact.update({
      where: { id },
      data: { lifecycleStage: 'customer' },
    });
    await tx.activity.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: 'stage_changed',
        recordType: 'contact',
        recordId: id,
        sourceModule: 'crm',
        actorId: ctx.userId,
        payload: { fromLifecycleStage: row.lifecycleStage, toLifecycleStage: 'customer' },
      },
    });
    return toSharedContact(updated);
  });
}
