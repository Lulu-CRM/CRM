import {
  ERROR_CODES,
  companyDetail,
  summarizeCompany,
  type CompanyCreateInput,
  type CompanyDetail,
  type CompanyListItem,
  type CompanyListQuery,
  type CompanyUpdateInput,
} from '@lulu/shared';
import { db } from '../db/prisma';
import { scopedDb, type ScopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { toSharedCompany, type CompanyRow } from './companyMapper';
import { toSharedContact } from './contactMapper';
import { toSharedDeal, toSharedStage } from './dealMapper';

const SORTABLE = ['name', 'contactCount', 'openDealValue', 'lastTouchAt'];

function notFound(): AppError {
  return AppError.notFound(ERROR_CODES.COMPANY_NOT_FOUND);
}

async function assertExists(path: string, lookup: Promise<unknown>): Promise<void> {
  if ((await lookup) === null) {
    throw AppError.validation([{ path, code: 'custom', message: 'errors.validation.custom' }]);
  }
}

async function assertOwner(scoped: ScopedDb, ownerId: string | undefined): Promise<void> {
  if (ownerId) {
    await assertExists(
      'ownerId',
      scoped.user.findFirst({ where: { id: ownerId }, select: { id: true } }),
    );
  }
}

interface WorkspaceRecords {
  currency: string;
  contacts: ReturnType<typeof toSharedContact>[];
  deals: ReturnType<typeof toSharedDeal>[];
  stages: ReturnType<typeof toSharedStage>[];
}

// The workspace's live contacts, deals and stages. The company numbers are computed from
// them (never stored), so every company endpoint loads this shared context once.
async function loadWorkspaceRecords(ctx: RequestContext): Promise<WorkspaceRecords> {
  const scoped = scopedDb(ctx.workspaceId);
  const [workspace, contactRows, dealRows, stageRows] = await Promise.all([
    db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } }),
    scoped.contact.findMany({}),
    scoped.deal.findMany({}),
    scoped.stage.findMany({ orderBy: { order: 'asc' } }),
  ]);
  return {
    currency: workspace.defaultCurrency,
    contacts: contactRows.map(toSharedContact),
    deals: dealRows.map(toSharedDeal),
    stages: stageRows.map(toSharedStage),
  };
}

// The same records, narrowed to one company — used by create/update/detail, where only that
// company's contacts and deals are needed.
async function loadCompanyRecords(
  ctx: RequestContext,
  companyId: string,
): Promise<WorkspaceRecords> {
  const scoped = scopedDb(ctx.workspaceId);
  const [workspace, contactRows, dealRows, stageRows] = await Promise.all([
    db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } }),
    scoped.contact.findMany({ where: { companyId } }),
    scoped.deal.findMany({ where: { companyId } }),
    scoped.stage.findMany({ orderBy: { order: 'asc' } }),
  ]);
  return {
    currency: workspace.defaultCurrency,
    contacts: contactRows.map(toSharedContact),
    deals: dealRows.map(toSharedDeal),
    stages: stageRows.map(toSharedStage),
  };
}

function summarizeOne(
  row: CompanyRow,
  records: WorkspaceRecords,
  now = new Date(),
): CompanyListItem {
  return summarizeCompany(
    toSharedCompany(row),
    records.contacts,
    records.deals,
    records.stages,
    records.currency,
    now,
  );
}

function compareBy(sort: string | undefined): (a: CompanyListItem, b: CompanyListItem) => number {
  const raw = sort ?? '-openDealValue';
  const descending = raw.startsWith('-');
  const field = descending ? raw.slice(1) : raw;
  if (!SORTABLE.includes(field)) {
    throw AppError.validation([
      { path: 'sort', code: 'invalid_value', message: 'errors.validation.invalid_value' },
    ]);
  }
  const time = (value: string | null) => (value === null ? -Infinity : Date.parse(value));
  const comparators: Record<string, (a: CompanyListItem, b: CompanyListItem) => number> = {
    name: (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    contactCount: (a, b) => a.contactCount - b.contactCount,
    openDealValue: (a, b) => a.openDealValue.amount - b.openDealValue.amount,
    lastTouchAt: (a, b) => time(a.lastTouchAt) - time(b.lastTouchAt),
  };
  const comparator = comparators[field];
  if (comparator === undefined) {
    throw AppError.validation([
      { path: 'sort', code: 'invalid_value', message: 'errors.validation.invalid_value' },
    ]);
  }
  return (a, b) => {
    const result = comparator(a, b) * (descending ? -1 : 1);
    return result !== 0 ? result : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

// Computed fields (contactCount, openDealValue, health) cannot be sorted or filtered in SQL,
// and the health filter needs them too — so the list is computed for the workspace and
// filtered, sorted and paginated in memory, exactly like the mock (mock.ts companies.list).
// Recomputed on every request, never cached or stored.
export async function listCompanies(
  ctx: RequestContext,
  query: CompanyListQuery,
): Promise<{ items: CompanyListItem[]; total: number }> {
  const scoped = scopedDb(ctx.workspaceId);
  const [rows, records] = await Promise.all([
    scoped.company.findMany({}),
    loadWorkspaceRecords(ctx),
  ]);
  const now = new Date();

  let items = rows.map((row) => summarizeOne(row, records, now));
  if (query.q !== undefined) {
    const needle = query.q.toLowerCase();
    items = items.filter((c) =>
      [c.name, c.domain, c.industry].join(' ').toLowerCase().includes(needle),
    );
  }
  if (query.ownerId !== undefined) items = items.filter((c) => c.ownerId === query.ownerId);
  if (query.industry !== undefined) items = items.filter((c) => c.industry === query.industry);
  if (query.health !== undefined) items = items.filter((c) => c.health === query.health);

  items.sort(compareBy(query.sort));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length };
}

export async function getCompany(ctx: RequestContext, id: string): Promise<CompanyDetail> {
  const scoped = scopedDb(ctx.workspaceId);
  const row = await scoped.company.findFirst({ where: { id } });
  if (row === null) throw notFound();
  const records = await loadCompanyRecords(ctx, id);
  return companyDetail(
    toSharedCompany(row),
    records.contacts,
    records.deals,
    records.stages,
    records.currency,
  );
}

export async function createCompany(
  ctx: RequestContext,
  input: CompanyCreateInput,
): Promise<CompanyListItem> {
  const scoped = scopedDb(ctx.workspaceId);
  await assertOwner(scoped, input.ownerId);
  const row = await scoped.company.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: input.name,
      domain: input.domain ?? null,
      industry: input.industry ?? null,
      size: input.size ?? null,
      ownerId: input.ownerId ?? ctx.userId,
    },
  });
  return summarizeOne(row, await loadCompanyRecords(ctx, row.id));
}

export async function updateCompany(
  ctx: RequestContext,
  id: string,
  input: CompanyUpdateInput,
): Promise<CompanyListItem> {
  const scoped = scopedDb(ctx.workspaceId);
  const existing = await scoped.company.findFirst({ where: { id } });
  if (existing === null) throw notFound();
  await assertOwner(scoped, input.ownerId);

  const row = await scoped.company.update({
    where: { id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.domain === undefined ? {} : { domain: input.domain }),
      ...(input.industry === undefined ? {} : { industry: input.industry }),
      ...(input.size === undefined ? {} : { size: input.size }),
      ...(input.ownerId === undefined ? {} : { ownerId: input.ownerId }),
    },
  });
  return summarizeOne(row, await loadCompanyRecords(ctx, id));
}

export async function deleteCompany(ctx: RequestContext, id: string): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  const existing = await scoped.company.findFirst({ where: { id } });
  if (existing === null) throw notFound();
  // Soft delete only: the company's contacts and deals keep their link (docs/api.md).
  await scoped.company.delete({ where: { id } });
}
