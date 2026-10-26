import { randomUUID } from 'node:crypto';
import type { HeldRow, ImportJob, ImportPreview } from '@lulu/shared';
import ExcelJS from 'exceljs';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { closeQueues, importProcessQueue } from '../jobs/queues';
import { startWorkers, stopWorkers } from '../jobs/workers';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { processImport } from '../services/imports';
import { importsRouter } from './imports';

interface Tenant {
  workspaceId: string;
  userId: string;
  sophieId: string;
}

const tenants: Tenant[] = [];
let current: RequestContext;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.ctx = current;
  next();
});
app.use('/imports', importsRouter);
app.use(errorHandler);

function body<T>(response: { body: unknown }): T {
  return (response.body as { data: T }).data;
}
function errorCode(response: { body: unknown }): string {
  return (response.body as { error: { code: string } }).error.code;
}

/** A workspace with one contact already in it: Sophie at Northstar Studio. */
async function tenant(label: string): Promise<Tenant> {
  const workspace = await db.workspace.create({ data: { name: `${label}-${randomUUID()}` } });
  const user = await db.user.create({
    data: {
      workspaceId: workspace.id,
      name: `${label} user`,
      email: `${label}-${randomUUID()}@example.test`,
    },
  });
  const company = await db.company.create({
    data: { workspaceId: workspace.id, name: 'Northstar Studio', ownerId: user.id },
  });
  const sophie = await db.contact.create({
    data: {
      workspaceId: workspace.id,
      name: 'Sophie Laurent',
      email: 'sophie@northstar.studio',
      companyId: company.id,
      jobRole: 'Creative Director',
      ownerId: user.id,
      tags: ['Design'],
    },
  });
  const t = { workspaceId: workspace.id, userId: user.id, sophieId: sophie.id };
  tenants.push(t);
  return t;
}

function as(t: Tenant) {
  current = { workspaceId: t.workspaceId, userId: t.userId, role: 'owner' };
}

// One duplicate of Sophie (same email), one row with no name, email or phone, two new people (one at a new company).
const CSV = [
  'full_name,work_email,company,job_title',
  'Sophie L.,SOPHIE@northstar.studio,Northstar Studio,CEO',
  'Ada Lovelace,ada@example.com,Analytical Engines,Founder',
  ',,Nobody Ltd,',
  'Grace Hopper,grace@example.com,Northstar Studio,Admiral',
].join('\n');

async function uploaded(t: Tenant, csv = CSV, name = 'contacts.csv'): Promise<ImportJob> {
  as(t);
  const response = await request(app).post('/imports').attach('file', Buffer.from(csv), name);
  expect(response.status).toBe(201);
  return body<ImportJob>(response);
}

async function imported(
  t: Tenant,
  options: Record<string, unknown> = {},
  csv = CSV,
): Promise<ImportJob> {
  const job = await uploaded(t, csv);
  const confirm = await request(app).post(`/imports/${job.id}/confirm`).send(options);
  expect(body<ImportJob>(confirm).status).toBe('processing');
  return processImport({ importJobId: job.id, workspaceId: t.workspaceId });
}

afterAll(async () => {
  await stopWorkers();
  await importProcessQueue.obliterate({ force: true });
  const ids = tenants.map((t) => t.workspaceId);
  const where = { workspaceId: { in: ids } };
  await db.importRow.deleteMany({ where });
  await db.importJob.deleteMany({ where });
  await db.setting.deleteMany({ where });
  await db.contact.deleteMany({ where });
  await db.company.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({ where: { id: { in: ids } } });
  await closeQueues();
  await db.$disconnect();
});

describe('Import API (int)', () => {
  it('reads a CSV, stores its rows and guesses the mapping', async () => {
    const t = await tenant('upload');
    const job = await uploaded(t);
    expect(job).toMatchObject({
      fileName: 'contacts.csv',
      status: 'uploaded',
      columns: ['full_name', 'work_email', 'company', 'job_title'],
      mapping: { full_name: 'name', work_email: 'email', company: 'company', job_title: 'jobRole' },
      rowsTotal: 4,
      sampleRow: { full_name: 'Sophie L.', work_email: 'SOPHIE@northstar.studio' },
    });
    expect(await db.importRow.count({ where: { importJobId: job.id, status: 'pending' } })).toBe(4);
  });

  it('reads the first sheet of an XLSX file', async () => {
    const t = await tenant('xlsx');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Contacts');
    sheet.addRow(['Name', 'E-Mail', 'Firma']);
    sheet.addRow(['Tobias Klein', 'tobias@klarwerk.de', 'Klarwerk GmbH']);
    const file = Buffer.from(await workbook.xlsx.writeBuffer());
    as(t);
    const response = await request(app).post('/imports').attach('file', file, 'kontakte.xlsx');
    expect(response.status).toBe(201);
    expect(body<ImportJob>(response)).toMatchObject({
      columns: ['Name', 'E-Mail', 'Firma'],
      mapping: { Name: 'name', 'E-Mail': 'email', Firma: 'company' },
      rowsTotal: 1,
    });
  });

  it('explains files it cannot import', async () => {
    const t = await tenant('errors');
    as(t);
    const noFile = await request(app).post('/imports');
    expect(errorCode(noFile)).toBe('IMPORT_FILE_UNREADABLE');
    const wrongType = await request(app)
      .post('/imports')
      .attach('file', Buffer.from('hello'), 'notes.txt');
    expect(errorCode(wrongType)).toBe('IMPORT_FILE_UNREADABLE');
    const badXlsx = await request(app)
      .post('/imports')
      .attach('file', Buffer.from('not a zip'), 'sheet.xlsx');
    expect(errorCode(badXlsx)).toBe('IMPORT_FILE_UNREADABLE');
    const empty = await request(app)
      .post('/imports')
      .attach('file', Buffer.from('name,email\n'), 'empty.csv');
    expect(errorCode(empty)).toBe('IMPORT_EMPTY');
    const lines = ['name', ...Array.from({ length: 10_001 }, (_, i) => `Person ${i}`)].join('\n');
    const tooMany = await request(app)
      .post('/imports')
      .attach('file', Buffer.from(lines), 'big.csv');
    expect(tooMany.status).toBe(400);
    expect(errorCode(tooMany)).toBe('IMPORT_TOO_MANY_ROWS');
  });

  it('saves a mapping for the file’s own columns, only before the import starts', async () => {
    const t = await tenant('mapping');
    const job = await uploaded(t);
    const unknown = await request(app)
      .put(`/imports/${job.id}/mapping`)
      .send({ mapping: { not_a_column: 'name' } });
    expect(errorCode(unknown)).toBe('VALIDATION_ERROR');

    const saved = await request(app)
      .put(`/imports/${job.id}/mapping`)
      .send({ mapping: { ...job.mapping, job_title: 'ignore' } });
    expect(body<ImportJob>(saved).mapping.job_title).toBe('ignore');

    await request(app).post(`/imports/${job.id}/confirm`).send({});
    const late = await request(app)
      .put(`/imports/${job.id}/mapping`)
      .send({ mapping: job.mapping });
    expect(late.status).toBe(409);
    expect(errorCode(late)).toBe('IMPORT_ALREADY_STARTED');
  });

  it('previews counts for the whole file and the first rows', async () => {
    const t = await tenant('preview');
    const job = await uploaded(t);
    const preview = body<ImportPreview>(await request(app).get(`/imports/${job.id}/preview`));
    expect(preview).toMatchObject({
      rowsTotal: 4,
      newCount: 2,
      duplicateCount: 1,
      problemCount: 1,
    });
    expect(preview.rows[0]).toMatchObject({
      duplicateOfContactId: t.sophieId,
      duplicateMatch: 'email',
    });
    expect(preview.rows[2]!.problems).toEqual(['nameMissing']);
  });

  it('imports in the background: adds new people, holds duplicates, skips problems', async () => {
    const t = await tenant('process');
    const job = await imported(t, { tag: 'Imported 2026' });
    expect(job).toMatchObject({
      status: 'done',
      rowsAdded: 2,
      rowsHeld: 1,
      rowsSkipped: 1,
      rowsUpdated: 0,
    });

    const ada = await db.contact.findFirstOrThrow({
      where: { workspaceId: t.workspaceId, email: 'ada@example.com' },
    });
    expect(ada).toMatchObject({
      name: 'Ada Lovelace',
      jobRole: 'Founder',
      source: 'import',
      lifecycleStage: 'new',
      ownerId: t.userId,
      tags: ['Imported 2026'],
      marketingConsent: false,
    });
    // A new company is created once; a known one (ignoring case) is reused.
    const companies = await db.company.findMany({
      where: { workspaceId: t.workspaceId },
      orderBy: { name: 'asc' },
    });
    expect(companies.map((c) => c.name)).toEqual(['Analytical Engines', 'Northstar Studio']);
    const grace = await db.contact.findFirstOrThrow({
      where: { workspaceId: t.workspaceId, email: 'grace@example.com' },
    });
    expect(grace.companyId).toBe(companies[1]!.id);
    // Sophie is untouched until someone decides.
    expect((await db.contact.findUniqueOrThrow({ where: { id: t.sophieId } })).jobRole).toBe(
      'Creative Director',
    );
  });

  it('resolves held duplicates: merge fills gaps, create adds, skip drops, and only once', async () => {
    const t = await tenant('held');
    const job = await imported(t, { tag: 'Imported 2026' });
    const held = body<HeldRow[]>(await request(app).get(`/imports/${job.id}/held`));
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({
      rowNumber: 1,
      duplicateOfContactId: t.sophieId,
      duplicateMatch: 'email',
      status: 'held',
    });
    expect(held[0]!.contact).toMatchObject({ name: 'Sophie L.', jobRole: 'CEO' });

    const merged = await request(app)
      .post(`/imports/${job.id}/held/${held[0]!.id}/resolve`)
      .send({ action: 'merge' });
    expect(body<HeldRow>(merged).status).toBe('merged');
    // Merge never overwrites: Sophie keeps her role and name, and gets the tag.
    const sophie = await db.contact.findUniqueOrThrow({ where: { id: t.sophieId } });
    expect(sophie).toMatchObject({ name: 'Sophie Laurent', jobRole: 'Creative Director' });
    expect(sophie.tags).toEqual(['Design', 'Imported 2026']);

    const again = await request(app)
      .post(`/imports/${job.id}/held/${held[0]!.id}/resolve`)
      .send({ action: 'create' });
    expect(errorCode(again)).toBe('IMPORT_ROW_NOT_FOUND');

    const after = await db.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after).toMatchObject({ rowsHeld: 0, rowsUpdated: 1, rowsAdded: 2 });
    expect(body<HeldRow[]>(await request(app).get(`/imports/${job.id}/held`))).toEqual([]);
  });

  it('can add a held row as a new contact instead', async () => {
    const t = await tenant('create');
    const job = await imported(t);
    const [row] = body<HeldRow[]>(await request(app).get(`/imports/${job.id}/held`));
    await request(app)
      .post(`/imports/${job.id}/held/${row!.id}/resolve`)
      .send({ action: 'create' });
    expect(
      await db.contact.count({ where: { workspaceId: t.workspaceId, name: 'Sophie L.' } }),
    ).toBe(1);
  });

  it('with "update", overwrites the existing contact; with "skip", leaves duplicates out', async () => {
    const updated = await tenant('update');
    expect(await imported(updated, { duplicateHandling: 'update' })).toMatchObject({
      rowsUpdated: 1,
      rowsHeld: 0,
    });
    expect(await db.contact.findUniqueOrThrow({ where: { id: updated.sophieId } })).toMatchObject({
      name: 'Sophie L.',
      jobRole: 'CEO',
    });

    const skipped = await tenant('skip');
    expect(await imported(skipped, { duplicateHandling: 'skip' })).toMatchObject({
      rowsSkipped: 2,
      rowsHeld: 0,
    });
    expect((await db.contact.findUniqueOrThrow({ where: { id: skipped.sophieId } })).name).toBe(
      'Sophie Laurent',
    );
  });

  it('gives imported contacts marketing consent only when the workspace rule says so', async () => {
    const t = await tenant('consent');
    await db.setting.create({
      data: {
        workspaceId: t.workspaceId,
        key: 'consent',
        value: {
          requireConsentForMarketing: true,
          requireConsentEvidence: true,
          importedContactsConsent: 'granted',
        },
      },
    });
    await imported(t);
    const ada = await db.contact.findFirstOrThrow({
      where: { workspaceId: t.workspaceId, email: 'ada@example.com' },
    });
    expect(ada.marketingConsent).toBe(true);
    expect(ada.consentUpdatedAt).not.toBeNull();
  });

  it("never shows another workspace's import", async () => {
    const owner = await tenant('owner');
    const other = await tenant('other');
    const job = await uploaded(owner);
    as(other);
    const response = await request(app).get(`/imports/${job.id}`);
    expect(response.status).toBe(404);
    expect(errorCode(response)).toBe('IMPORT_NOT_FOUND');
  });

  it('imports a 1,000-row file through the queue and the worker, holding its duplicates', async () => {
    const t = await tenant('thousand');
    const lines = ['full_name,work_email,company'];
    for (let i = 1; i <= 1000; i++) {
      if (i % 100 === 0) lines.push(`Sophie ${i},sophie@northstar.studio,Northstar Studio`);
      else if (i % 250 === 1) lines.push(`,,Missing ${i}`);
      else lines.push(`Person ${i},person${i}@example.com,Company ${i % 7}`);
    }
    const job = await uploaded(t, lines.join('\n'), 'thousand.csv');
    startWorkers();
    await request(app).post(`/imports/${job.id}/confirm`).send({});

    let latest = job;
    for (let i = 0; i < 300 && latest.status !== 'done' && latest.status !== 'failed'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      latest = body<ImportJob>(await request(app).get(`/imports/${job.id}`));
    }
    expect(latest).toMatchObject({
      status: 'done',
      rowsTotal: 1000,
      rowsAdded: 986,
      rowsHeld: 10,
      rowsSkipped: 4,
    });
    expect(await db.contact.count({ where: { workspaceId: t.workspaceId } })).toBe(1 + 986);
    expect(body<HeldRow[]>(await request(app).get(`/imports/${job.id}/held`))).toHaveLength(10);
  }, 120_000);
});
