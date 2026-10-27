import {
  ERROR_CODES,
  MAX_IMPORT_ROWS,
  consentSettingsSchema,
  defaultConsentSettings,
  guessMapping,
  heldRowSchema,
  importConfirmSchema,
  importJobSchema,
  importMappingSchema,
  importedContactSchema,
  mergeIntoContact,
  parseCsv,
  planImport,
  tableFromRecords,
  withMainCompany,
  type HeldRow,
  type ImportConfirmInput,
  type ImportJob,
  type ImportMapping,
  type ImportPreview,
  type ImportResolveAction,
  type ImportedContact,
} from '@lulu/shared';
import ExcelJS from 'exceljs';
import { scopedDb, type ScopedDb } from '../db/scoped';
import type {
  ImportJob as ImportJobRow,
  ImportRow as ImportRowRow,
  Prisma,
} from '../generated/prisma/client';
import type { ImportProcessPayload } from '../jobs/queues';
import { enqueueImportProcess } from '../jobs/queues';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { toSharedCompany } from './companyMapper';
import { toSharedContact } from './contactMapper';

// Contact import (docs/api.md, "Import"). The file is read and stored row by row at upload; the
// import.process background job applies the shared rules (import-logic.ts) so the preview and the
// import agree. Duplicates are held for review unless the user chose to skip or update them.

const PREVIEW_ROWS = 20;
const INSERT_CHUNK = 1000;

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString());

export function toSharedJob(row: ImportJobRow): ImportJob {
  return importJobSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    fileName: row.fileName,
    status: row.status,
    columns: row.columns,
    sampleRow: row.sampleRow ?? null,
    mapping: row.mapping,
    rowsTotal: row.rowsTotal,
    rowsAdded: row.rowsAdded,
    rowsUpdated: row.rowsUpdated,
    rowsHeld: row.rowsHeld,
    rowsSkipped: row.rowsSkipped,
    ownerId: row.ownerId,
    tag: row.tag,
    duplicateHandling: row.duplicateHandling,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  });
}

function toHeldRow(row: ImportRowRow): HeldRow {
  return heldRowSchema.parse({
    id: row.id,
    importJobId: row.importJobId,
    rowNumber: row.rowNumber,
    contact: row.contact,
    duplicateOfContactId: row.duplicateOfContactId,
    duplicateMatch: row.duplicateMatch,
    status: row.status,
  });
}

// ---------- Reading the file ----------

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

const unreadable = () => new AppError(ERROR_CODES.IMPORT_FILE_UNREADABLE, 400);

/** The first sheet of an XLSX workbook as rows of cell text. */
async function readXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw unreadable();
  }
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) return [];
  const width = sheet.columnCount;
  const records: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    records.push(Array.from({ length: width }, (_, i) => row.getCell(i + 1).text ?? ''));
  });
  return records;
}

/** CSV or XLSX into columns and rows, with the same header and row rules for both. */
export async function readTable(file: UploadedFile) {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.csv')) return parseCsv(file.buffer.toString('utf8'));
  if (name.endsWith('.xlsx')) return tableFromRecords(await readXlsx(file.buffer));
  throw unreadable();
}

// ---------- Jobs ----------

async function findJob(scoped: ScopedDb, id: string) {
  const job = await scoped.importJob.findFirst({ where: { id } });
  if (job === null) throw AppError.notFound(ERROR_CODES.IMPORT_NOT_FOUND);
  return job;
}

function assertNotStarted(job: ImportJobRow) {
  if (job.status !== 'uploaded') throw AppError.conflict(ERROR_CODES.IMPORT_ALREADY_STARTED);
}

/** POST /imports: read the file, store its rows, guess the mapping. */
export async function createImport(ctx: RequestContext, file: UploadedFile): Promise<ImportJob> {
  const { columns, rows } = await readTable(file);
  if (rows.length === 0) throw new AppError(ERROR_CODES.IMPORT_EMPTY, 400);
  if (rows.length > MAX_IMPORT_ROWS) throw new AppError(ERROR_CODES.IMPORT_TOO_MANY_ROWS, 400);

  const scoped = scopedDb(ctx.workspaceId);
  const job = await scoped.importJob.create({
    data: {
      workspaceId: ctx.workspaceId,
      fileName: file.originalname,
      status: 'uploaded',
      columns,
      sampleRow: rows[0] ?? {},
      mapping: guessMapping(columns),
      rowsTotal: rows.length,
      ownerId: ctx.userId,
    },
  });
  for (let start = 0; start < rows.length; start += INSERT_CHUNK) {
    await scoped.importRow.createMany({
      data: rows.slice(start, start + INSERT_CHUNK).map((raw, i) => ({
        workspaceId: ctx.workspaceId,
        importJobId: job.id,
        rowNumber: start + i + 1,
        raw,
        status: 'pending' as const,
      })),
    });
  }
  return toSharedJob(job);
}

export async function getImport(ctx: RequestContext, id: string): Promise<ImportJob> {
  return toSharedJob(await findJob(scopedDb(ctx.workspaceId), id));
}

/** PUT /imports/:id/mapping: only before the import starts, and only for the file's own columns. */
export async function saveMapping(
  ctx: RequestContext,
  id: string,
  mapping: ImportMapping,
): Promise<ImportJob> {
  const scoped = scopedDb(ctx.workspaceId);
  const job = await findJob(scoped, id);
  assertNotStarted(job);
  const parsed = importMappingSchema.parse(mapping);
  const unknown = Object.keys(parsed).filter((column) => !job.columns.includes(column));
  if (unknown.length > 0) {
    throw AppError.validation(
      unknown.map((column) => ({
        path: `mapping.${column}`,
        code: 'custom',
        message: 'errors.validation.custom',
      })),
    );
  }
  const updated = await scoped.importJob.update({ where: { id }, data: { mapping: parsed } });
  return toSharedJob(updated);
}

async function workspaceRecords(scoped: ScopedDb) {
  const [contactRows, companyRows] = await Promise.all([
    scoped.contact.findMany({}),
    scoped.company.findMany({}),
  ]);
  return {
    contacts: contactRows.map(toSharedContact),
    companies: companyRows.map(toSharedCompany),
  };
}

async function storedRows(scoped: ScopedDb, jobId: string, status?: 'pending') {
  return scoped.importRow.findMany({
    where: { importJobId: jobId, ...(status === undefined ? {} : { status }) },
    orderBy: { rowNumber: 'asc' },
  });
}

/** GET /imports/:id/preview: counts for the whole file, and the first rows as they will be imported. */
export async function previewImport(ctx: RequestContext, id: string): Promise<ImportPreview> {
  const scoped = scopedDb(ctx.workspaceId);
  const job = await findJob(scoped, id);
  const rows = await storedRows(scoped, id);
  const { contacts, companies } = await workspaceRecords(scoped);
  const plan = planImport(
    rows.map((row) => row.raw as Record<string, string>),
    importMappingSchema.parse(job.mapping),
    contacts,
    companies,
  );
  const problems = plan.filter((r) => r.problems.length > 0).length;
  const duplicates = plan.filter((r) => r.duplicateOfContactId !== null).length;
  return {
    rowsTotal: plan.length,
    newCount: plan.length - problems - duplicates,
    duplicateCount: duplicates,
    problemCount: problems,
    rows: plan.slice(0, PREVIEW_ROWS),
  };
}

/** POST /imports/:id/confirm: save the options and hand the import to the background job. */
export async function confirmImport(
  ctx: RequestContext,
  id: string,
  input: ImportConfirmInput,
): Promise<ImportJob> {
  const options = importConfirmSchema.parse(input);
  const scoped = scopedDb(ctx.workspaceId);
  const job = await findJob(scoped, id);
  assertNotStarted(job);
  if (options.ownerId !== undefined) {
    const owner = await scoped.user.findFirst({
      where: { id: options.ownerId },
      select: { id: true },
    });
    if (owner === null) {
      throw AppError.validation([
        { path: 'ownerId', code: 'custom', message: 'errors.validation.custom' },
      ]);
    }
  }
  const updated = await scoped.importJob.update({
    where: { id },
    data: {
      status: 'processing',
      ownerId: options.ownerId ?? ctx.userId,
      tag: options.tag ?? null,
      duplicateHandling: options.duplicateHandling,
    },
  });
  await enqueueImportProcess({ importJobId: id, workspaceId: ctx.workspaceId });
  return toSharedJob(updated);
}

// ---------- Writing contacts ----------

/** Finds a company by name (ignoring case) or creates it; remembers what it found for the rest of the run. */
function companyResolver(scoped: ScopedDb, workspaceId: string, ownerId: string) {
  const cache = new Map<string, string>();
  return async (name: string | null): Promise<string | null> => {
    if (name === null) return null;
    const key = name.toLocaleLowerCase();
    const known = cache.get(key);
    if (known !== undefined) return known;
    const existing = await scoped.company.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    const id =
      existing?.id ??
      (await scoped.company.create({ data: { workspaceId, name, ownerId }, select: { id: true } }))
        .id;
    cache.set(key, id);
    return id;
  };
}

/** Imported contacts follow the workspace's consent rule (docs/data-model.md, "Consent"). */
async function importedConsent(scoped: ScopedDb): Promise<boolean> {
  const setting = await scoped.setting.findFirst({ where: { key: 'consent' } });
  const rules = consentSettingsSchema.safeParse(setting?.value);
  return (
    (rules.success ? rules.data : defaultConsentSettings).importedContactsConsent === 'granted'
  );
}

interface WriteContext {
  scoped: ScopedDb;
  workspaceId: string;
  ownerId: string;
  tag: string | null;
  consent: boolean;
  companyId: (name: string | null) => Promise<string | null>;
}

async function createImportedContact(w: WriteContext, contact: ImportedContact): Promise<void> {
  await w.scoped.contact.create({
    data: {
      workspaceId: w.workspaceId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      ...withMainCompany(
        { companyId: null, companyIds: [] },
        await w.companyId(contact.companyName),
      ),
      jobRole: contact.jobRole,
      language: contact.language,
      country: contact.country,
      source: contact.source ?? 'import',
      lifecycleStage: contact.lifecycleStage ?? 'new',
      ownerId: w.ownerId,
      tags: [...new Set([...contact.tags, ...(w.tag === null ? [] : [w.tag])])],
      marketingConsent: w.consent,
      consentUpdatedAt: w.consent ? new Date() : null,
    },
  });
}

async function mergeImportedContact(
  w: WriteContext,
  contactId: string,
  contact: ImportedContact,
  mode: 'fill' | 'overwrite',
): Promise<void> {
  const existing = await w.scoped.contact.findFirst({ where: { id: contactId } });
  if (existing === null) throw AppError.notFound(ERROR_CODES.CONTACT_NOT_FOUND);
  const withTag = { ...contact, tags: [...contact.tags, ...(w.tag === null ? [] : [w.tag])] };
  const update = mergeIntoContact(
    toSharedContact(existing),
    withTag,
    mode,
    await w.companyId(contact.companyName),
  );
  // Leave out fields the merge did not set (the API's strict optional types reject undefined).
  const data = Object.fromEntries(
    Object.entries(update).filter(([, value]) => value !== undefined),
  ) as Prisma.ContactUncheckedUpdateInput;
  await w.scoped.contact.update({ where: { id: contactId }, data });
}

async function writeContext(scoped: ScopedDb, job: ImportJobRow): Promise<WriteContext> {
  const ownerId = job.ownerId!;
  return {
    scoped,
    workspaceId: job.workspaceId,
    ownerId,
    tag: job.tag,
    consent: await importedConsent(scoped),
    companyId: companyResolver(scoped, job.workspaceId, ownerId),
  };
}

/** Recounts the job's rows by status, so the numbers stay right even when a job is retried. */
async function recount(scoped: ScopedDb, jobId: string) {
  const groups = await scoped.importRow.groupBy({
    by: ['status'],
    where: { importJobId: jobId },
    _count: { _all: true },
  });
  const count = (...statuses: string[]) =>
    groups.filter((g) => statuses.includes(g.status)).reduce((sum, g) => sum + g._count._all, 0);
  return {
    rowsAdded: count('added'),
    rowsUpdated: count('updated', 'merged'),
    rowsHeld: count('held'),
    rowsSkipped: count('skipped'),
  };
}

/**
 * The import.process job. Only rows still pending are processed, so a retried job carries on where it
 * stopped. Rows with problems are skipped; duplicates are held, skipped or used to update the contact.
 */
export async function processImport(payload: ImportProcessPayload): Promise<ImportJob> {
  const scoped = scopedDb(payload.workspaceId);
  const job = await findJob(scoped, payload.importJobId);
  try {
    const rows = await storedRows(scoped, job.id, 'pending');
    const { contacts, companies } = await workspaceRecords(scoped);
    const plan = planImport(
      rows.map((row) => row.raw as Record<string, string>),
      importMappingSchema.parse(job.mapping),
      contacts,
      companies,
    );
    const w = await writeContext(scoped, job);

    for (const [i, planned] of plan.entries()) {
      const row = rows[i]!;
      if (planned.problems.length > 0) {
        await scoped.importRow.update({ where: { id: row.id }, data: { status: 'skipped' } });
      } else if (planned.duplicateOfContactId !== null) {
        if (job.duplicateHandling === 'skip') {
          await scoped.importRow.update({
            where: { id: row.id },
            data: { status: 'skipped', duplicateOfContactId: planned.duplicateOfContactId },
          });
        } else if (job.duplicateHandling === 'update') {
          await mergeImportedContact(w, planned.duplicateOfContactId, planned.contact, 'overwrite');
          await scoped.importRow.update({
            where: { id: row.id },
            data: { status: 'updated', duplicateOfContactId: planned.duplicateOfContactId },
          });
        } else {
          await scoped.importRow.update({
            where: { id: row.id },
            data: {
              status: 'held',
              contact: planned.contact,
              duplicateMatch: planned.duplicateMatch,
              duplicateOfContactId: planned.duplicateOfContactId,
            },
          });
        }
      } else {
        await createImportedContact(w, planned.contact);
        await scoped.importRow.update({ where: { id: row.id }, data: { status: 'added' } });
      }
    }

    const done = await scoped.importJob.update({
      where: { id: job.id },
      data: { status: 'done', error: null, ...(await recount(scoped, job.id)) },
    });
    return toSharedJob(done);
  } catch (err) {
    await scoped.importJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: ERROR_CODES.INTERNAL_ERROR,
        ...(await recount(scoped, job.id)),
      },
    });
    throw err;
  }
}

// ---------- Held duplicates ----------

/** GET /imports/:id/held: the rows waiting for a decision. */
export async function heldRows(ctx: RequestContext, id: string): Promise<HeldRow[]> {
  const scoped = scopedDb(ctx.workspaceId);
  await findJob(scoped, id);
  const rows = await scoped.importRow.findMany({
    where: { importJobId: id, status: 'held' },
    orderBy: { rowNumber: 'asc' },
  });
  return rows.map(toHeldRow);
}

/** POST /imports/:id/held/:rowId/resolve: skip the row, add it as a new contact, or merge it (fill only). */
export async function resolveHeldRow(
  ctx: RequestContext,
  id: string,
  rowId: string,
  action: ImportResolveAction,
): Promise<HeldRow> {
  const scoped = scopedDb(ctx.workspaceId);
  const job = await findJob(scoped, id);
  const row = await scoped.importRow.findFirst({
    where: { id: rowId, importJobId: id, status: 'held' },
  });
  if (row === null) throw AppError.notFound(ERROR_CODES.IMPORT_ROW_NOT_FOUND);
  const contact = importedContactSchema.parse(row.contact);
  const w = await writeContext(scoped, job);

  if (action === 'create') await createImportedContact(w, contact);
  if (action === 'merge') await mergeImportedContact(w, row.duplicateOfContactId!, contact, 'fill');
  const status = action === 'create' ? 'added' : action === 'merge' ? 'merged' : 'skipped';

  const updated = await scoped.importRow.update({ where: { id: rowId }, data: { status } });
  await scoped.importJob.update({ where: { id }, data: await recount(scoped, id) });
  return toHeldRow(updated);
}
