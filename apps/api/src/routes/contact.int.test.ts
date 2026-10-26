import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { contactsRouter } from './contacts';

interface Tenant {
  workspaceId: string;
  userId: string;
  otherUserId: string;
}

interface ApiEnvelope<T> {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
  };
}

interface ErrorEnvelope {
  error: { code: string };
}

interface ContactBody {
  id: string;
  name: string;
  email: string | null;
  lifecycleStage: string;
  ownerId: string;
  workspaceId: string;
  companyId: string | null;
  tags: string[];
  marketingConsent: boolean;
  consentUpdatedAt: string | null;
  lastTouchAt: string | null;
  company?: { id: string; name: string } | null;
}

interface TimelineItemBody {
  kind: 'activity' | 'note' | 'task';
  at: string;
}

/**
 * Supertest exposes response.body as `any`.
 * This helper confines that untyped boundary to one place and gives
 * each test an explicit response shape.
 */
function responseBody<T>(response: { body: unknown }): T {
  return response.body as T;
}

const tenants: Tenant[] = [];
let current: RequestContext;

const app = express();

app.use(express.json());

app.use((req, _res, next) => {
  req.ctx = current;
  next();
});

app.use('/contacts', contactsRouter);
app.use(errorHandler);

async function tenant(label: string): Promise<Tenant> {
  const workspace = await db.workspace.create({
    data: { name: `${label}-${randomUUID()}` },
  });

  const user = await db.user.create({
    data: {
      workspaceId: workspace.id,
      name: `${label} user`,
      email: `${label}-${randomUUID()}@example.test`,
    },
  });

  const otherUser = await db.user.create({
    data: {
      workspaceId: workspace.id,
      name: `${label} other`,
      email: `${label}-other-${randomUUID()}@example.test`,
    },
  });

  const created: Tenant = {
    workspaceId: workspace.id,
    userId: user.id,
    otherUserId: otherUser.id,
  };

  tenants.push(created);
  return created;
}

function as(t: Tenant, role: 'owner' | 'admin' | 'member' = 'owner'): void {
  current = { workspaceId: t.workspaceId, userId: t.userId, role };
}

async function newContact(t: Tenant, body: Record<string, unknown> = {}): Promise<ContactBody> {
  as(t);
  const res = await request(app)
    .post('/contacts')
    .send({ name: 'Contact', ...body });

  expect(res.status).toBe(201);
  return responseBody<ApiEnvelope<ContactBody>>(res).data;
}

async function newCompany(t: Tenant, name: string): Promise<{ id: string }> {
  const row = await db.company.create({ data: { workspaceId: t.workspaceId, name } });
  return { id: row.id };
}

async function list(
  t: Tenant,
  query = '',
): Promise<{ items: ContactBody[]; meta: { page: number; pageSize: number; total: number } }> {
  as(t);
  const res = await request(app).get(`/contacts${query}`);
  expect(res.status).toBe(200);
  const body = responseBody<ApiEnvelope<ContactBody[]>>(res);
  return { items: body.data, meta: body.meta! };
}

afterAll(async () => {
  const ids = tenants.map((t) => t.workspaceId);
  const where = { workspaceId: { in: ids } };

  await db.activity.deleteMany({ where });
  await db.note.deleteMany({ where });
  await db.task.deleteMany({ where });
  await db.segment.deleteMany({ where });
  await db.contact.deleteMany({ where });
  await db.company.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe('contacts API (int)', () => {
  it('creates a contact with the documented defaults', async () => {
    const t = await tenant('create');
    const contact = await newContact(t, { name: 'Sophie Laurent' });

    expect(contact).toMatchObject({
      name: 'Sophie Laurent',
      email: null,
      lifecycleStage: 'new',
      ownerId: t.userId,
      workspaceId: t.workspaceId,
      companyId: null,
      tags: [],
      marketingConsent: false,
      consentUpdatedAt: null,
      lastTouchAt: null,
    });

    const withConsent = await newContact(t, {
      name: 'Consent Given',
      marketingConsent: true,
      ownerId: t.otherUserId,
    });

    expect(withConsent.ownerId).toBe(t.otherUserId);
    expect(withConsent.marketingConsent).toBe(true);
    expect(withConsent.consentUpdatedAt).not.toBeNull();
  });

  it('saves, edits and clears language and country (Dave, Oct 26, 2026)', async () => {
    const t = await tenant('lang');
    const contact = await newContact(t, { name: 'Lena', language: 'German', country: 'Germany' });
    expect(contact).toMatchObject({ language: 'German', country: 'Germany' });

    as(t);
    const res = await request(app)
      .patch(`/contacts/${contact.id}`)
      .send({ language: 'English', country: null });
    expect(res.status).toBe(200);
    expect(responseBody<ApiEnvelope<ContactBody>>(res).data).toMatchObject({
      language: 'English',
      country: null,
    });
    expect(await newContact(t, { name: 'Plain' })).toMatchObject({ language: null, country: null });
  });

  it('rejects a duplicate email but allows two people with the same name', async () => {
    const t = await tenant('dupe');
    const company = await newCompany(t, 'Northstar Studio');

    await newContact(t, {
      name: 'Sophie Laurent',
      email: 'sophie@northstar.studio',
      companyId: company.id,
    });

    as(t);

    const byEmail = await request(app)
      .post('/contacts')
      .send({ name: 'Someone Else', email: 'SOPHIE@northstar.studio' });

    expect(byEmail.status).toBe(409);
    expect(responseBody<ErrorEnvelope>(byEmail).error.code).toBe('DUPLICATE_CONTACT');

    // Same name at the same company can be a different person: allowed for manual creates.
    const sameNameSameCompany = await request(app)
      .post('/contacts')
      .send({ name: 'sophie laurent', companyId: company.id });

    expect(sameNameSameCompany.status).toBe(201);

    // Same name without a company, or at another company, is a different person too.
    const noCompany = await request(app).post('/contacts').send({ name: 'Sophie Laurent' });
    expect(noCompany.status).toBe(201);

    const otherCompany = await newCompany(t, 'Klarwerk');
    const otherCompanySameName = await request(app)
      .post('/contacts')
      .send({ name: 'Sophie Laurent', companyId: otherCompany.id });

    expect(otherCompanySameName.status).toBe(201);

    // Editing a contact to a taken email is a duplicate too, editing its own values is not.
    const contact = responseBody<ApiEnvelope<ContactBody>>(noCompany).data;
    const ownPatch = await request(app)
      .patch(`/contacts/${contact.id}`)
      .send({ name: 'Sophie L.' });
    expect(ownPatch.status).toBe(200);

    const takenEmail = await request(app)
      .patch(`/contacts/${contact.id}`)
      .send({ email: 'sophie@northstar.studio' });

    expect(takenEmail.status).toBe(409);
  });

  it('validates references to the workspace on create and edit', async () => {
    const t = await tenant('refs');

    as(t);

    const badCompany = await request(app)
      .post('/contacts')
      .send({ name: 'Chris', companyId: randomUUID() });

    expect(badCompany.status).toBe(400);
    expect(responseBody<ErrorEnvelope>(badCompany).error.code).toBe('VALIDATION_ERROR');

    const badOwner = await request(app)
      .post('/contacts')
      .send({ name: 'Chris', ownerId: randomUUID() });

    expect(badOwner.status).toBe(400);
    expect(responseBody<ErrorEnvelope>(badOwner).error.code).toBe('VALIDATION_ERROR');
  });

  it('filters the list by stage, owner, company, tag, follow-up and createdSince', async () => {
    const t = await tenant('filters');
    const company = await newCompany(t, 'Atlas');

    const sophie = await newContact(t, {
      name: 'Sophie',
      lifecycleStage: 'qualified',
      ownerId: t.userId,
      companyId: company.id,
      tags: ['Design'],
    });
    const tobia = await newContact(t, {
      name: 'Tobias',
      lifecycleStage: 'follow_up',
      ownerId: t.otherUserId,
      tags: ['Finance'],
    });
    await newContact(t, { name: 'Mila', lifecycleStage: 'new', ownerId: t.userId });

    expect((await list(t, '?stage=qualified')).items.map((c) => c.id)).toEqual([sophie.id]);
    expect((await list(t, '?ownerId=' + t.otherUserId)).items.map((c) => c.id)).toEqual([tobia.id]);
    expect((await list(t, '?companyId=' + company.id)).items.map((c) => c.id)).toEqual([sophie.id]);
    expect((await list(t, '?tag=Design')).items.map((c) => c.id)).toEqual([sophie.id]);
    expect((await list(t, '?needsFollowUp=true')).items.map((c) => c.id)).toEqual([tobia.id]);
    expect((await list(t, '?needsFollowUp=false')).meta.total).toBe(3);

    // createdSince compares against createdAt; push Sophie into the past.
    await db.contact.update({
      where: { id: sophie.id },
      data: { createdAt: new Date('2020-01-01T00:00:00.000Z') },
    });

    const since = await list(t, '?createdSince=2021-01-01T00:00:00.000Z');
    expect(since.items.map((c) => c.id)).not.toContain(sophie.id);
    expect(since.meta.total).toBe(2);
  });

  it('searches across name, email, company name and tags', async () => {
    const t = await tenant('search');
    const zebralog = await newCompany(t, 'Zebralog');

    const sophie = await newContact(t, {
      name: 'Sophie Laurent',
      email: 'sophie@northstar.studio',
      tags: ['Design'],
    });
    const chris = await newContact(t, {
      name: 'Chris',
      email: null,
      companyId: zebralog.id,
      tags: ['VIP-customer'],
    });

    expect((await list(t, '?q=sophie')).items.map((c) => c.id)).toEqual([sophie.id]);
    expect((await list(t, '?q=LAURENT')).items.map((c) => c.id)).toEqual([sophie.id]);
    expect((await list(t, '?q=zebra')).items.map((c) => c.id)).toEqual([chris.id]);
    // Substring of a tag, case-insensitive, like the mock.
    expect((await list(t, '?q=vip')).items.map((c) => c.id)).toEqual([chris.id]);
    expect((await list(t, '?q=nobody')).meta.total).toBe(0);
  });

  it('filters by segment with the shared rules', async () => {
    const t = await tenant('segment');
    const fresh = await newContact(t, { name: 'Fresh', lifecycleStage: 'new' });
    await newContact(t, { name: 'Nurtured', lifecycleStage: 'qualified' });

    const segment = await db.segment.create({
      data: {
        workspaceId: t.workspaceId,
        name: 'New leads',
        rules: {
          match: 'all',
          conditions: [{ field: 'lifecycleStage', op: 'is', value: 'new' }],
        },
      },
    });

    expect((await list(t, `?segmentId=${segment.id}`)).items.map((c) => c.id)).toEqual([fresh.id]);

    as(t);
    const unknown = await request(app).get(`/contacts?segmentId=${randomUUID()}`);

    expect(unknown.status).toBe(404);
    expect(responseBody<ErrorEnvelope>(unknown).error.code).toBe('SEGMENT_NOT_FOUND');
  });

  it('sorts, pages and rejects an unknown sort', async () => {
    const t = await tenant('sort');
    const a = await newContact(t, { name: 'Bravo' });
    const b = await newContact(t, { name: 'Alpha' });
    const c = await newContact(t, { name: 'Charlie' });

    await db.contact.update({
      where: { id: a.id },
      data: { lastTouchAt: new Date('2026-01-01T00:00:00.000Z') },
    });
    await db.contact.update({
      where: { id: b.id },
      data: { lastTouchAt: new Date('2026-03-01T00:00:00.000Z') },
    });

    // Default sort -lastTouchAt: most recent first, never touched last (like the mock).
    expect((await list(t)).items.map((x) => x.id)).toEqual([b.id, a.id, c.id]);

    const byName = await list(t, '?sort=name');
    expect(byName.items.map((x) => x.id)).toEqual([b.id, a.id, c.id]);

    const page2 = await list(t, '?sort=name&pageSize=2&page=2');
    expect(page2.items.map((x) => x.id)).toEqual([c.id]);
    expect(page2.meta).toEqual({ page: 2, pageSize: 2, total: 3 });

    as(t);
    const bad = await request(app).get('/contacts?sort=password');

    expect(bad.status).toBe(400);
    expect(responseBody<ErrorEnvelope>(bad).error.code).toBe('VALIDATION_ERROR');
  });

  it('soft deletes a contact and leaves the row in the database', async () => {
    const t = await tenant('delete');
    const contact = await newContact(t, { name: 'Temporary' });
    await newContact(t, { name: 'Permanent' });

    as(t);
    expect((await request(app).delete(`/contacts/${contact.id}`)).status).toBe(204);
    expect((await request(app).get(`/contacts/${contact.id}`)).status).toBe(404);
    expect((await list(t)).meta.total).toBe(1);

    const row = await db.contact.findUnique({ where: { id: contact.id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
  });

  it('converts a lead to a customer and logs one activity', async () => {
    const t = await tenant('convert');
    const contact = await newContact(t, { name: 'Lead', lifecycleStage: 'follow_up' });

    as(t);
    const converted = await request(app).post(`/contacts/${contact.id}/convert`).send({});

    expect(converted.status).toBe(200);
    expect(responseBody<ApiEnvelope<ContactBody>>(converted).data.lifecycleStage).toBe('customer');

    // Converting again changes nothing and does not log a second activity.
    expect((await request(app).post(`/contacts/${contact.id}/convert`).send({})).status).toBe(200);

    const activities = await db.activity.findMany({
      where: { workspaceId: t.workspaceId, recordType: 'contact', recordId: contact.id },
    });

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      type: 'stage_changed',
      actorId: t.userId,
      payload: { fromLifecycleStage: 'follow_up', toLifecycleStage: 'customer' },
    });

    const missing = await request(app).post(`/contacts/${randomUUID()}/convert`).send({});

    expect(missing.status).toBe(404);
    expect(responseBody<ErrorEnvelope>(missing).error.code).toBe('CONTACT_NOT_FOUND');
  });

  it('returns the linked company on the profile, null otherwise', async () => {
    const t = await tenant('detail');
    const company = await newCompany(t, 'Atlas Logistics');
    const linked = await newContact(t, { name: 'Daniel', companyId: company.id });
    const alone = await newContact(t, { name: 'Solo' });

    as(t);

    const linkedRes = await request(app).get(`/contacts/${linked.id}`);
    expect(linkedRes.status).toBe(200);
    expect(responseBody<ApiEnvelope<ContactBody>>(linkedRes).data.company).toMatchObject({
      id: company.id,
      name: 'Atlas Logistics',
    });

    const aloneRes = await request(app).get(`/contacts/${alone.id}`);
    expect(responseBody<ApiEnvelope<ContactBody>>(aloneRes).data.company).toBeNull();
  });

  it('combines activities, notes and open tasks newest first, hiding private notes', async () => {
    const t = await tenant('timeline');
    const contact = await newContact(t, { name: 'Timeline' });

    await db.activity.create({
      data: {
        workspaceId: t.workspaceId,
        type: 'email',
        recordType: 'contact',
        recordId: contact.id,
        occurredAt: new Date('2026-01-03T00:00:00.000Z'),
        sourceModule: 'crm',
        payload: {},
      },
    });
    await db.note.create({
      data: {
        workspaceId: t.workspaceId,
        title: 'Shared note',
        body: '',
        visibility: 'shared',
        authorId: t.otherUserId,
        recordType: 'contact',
        recordId: contact.id,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    });
    await db.note.create({
      data: {
        workspaceId: t.workspaceId,
        title: 'Private note',
        body: '',
        visibility: 'private',
        authorId: t.otherUserId,
        recordType: 'contact',
        recordId: contact.id,
        createdAt: new Date('2026-01-04T00:00:00.000Z'),
      },
    });
    await db.task.create({
      data: {
        workspaceId: t.workspaceId,
        title: 'Open task',
        ownerId: t.userId,
        recordType: 'contact',
        recordId: contact.id,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    await db.task.create({
      data: {
        workspaceId: t.workspaceId,
        title: 'Done task',
        ownerId: t.userId,
        done: true,
        recordType: 'contact',
        recordId: contact.id,
        createdAt: new Date('2025-12-01T00:00:00.000Z'),
      },
    });

    as(t);
    const res = await request(app).get(`/contacts/${contact.id}/timeline`);

    expect(res.status).toBe(200);
    const items = responseBody<ApiEnvelope<TimelineItemBody[]>>(res).data;

    expect(items.map((item) => item.kind)).toEqual(['activity', 'note', 'task']);
    expect(items[0]?.at).toBe('2026-01-03T00:00:00.000Z');

    const missing = await request(app).get(`/contacts/${randomUUID()}/timeline`);

    expect(missing.status).toBe(404);
    expect(responseBody<ErrorEnvelope>(missing).error.code).toBe('CONTACT_NOT_FOUND');
  });

  it("never shows or changes another workspace's contact", async () => {
    const a = await tenant('iso-a');
    const b = await tenant('iso-b');
    const contact = await newContact(a, { name: 'Secret' });

    as(b);

    expect((await request(app).get(`/contacts/${contact.id}`)).status).toBe(404);
    expect((await request(app).patch(`/contacts/${contact.id}`).send({ name: 'x' })).status).toBe(
      404,
    );
    expect((await request(app).delete(`/contacts/${contact.id}`)).status).toBe(404);
    expect((await list(b)).meta.total).toBe(0);

    const untouched = await db.contact.findUniqueOrThrow({ where: { id: contact.id } });

    expect(untouched.name).toBe('Secret');
    expect(untouched.deletedAt).toBeNull();
  });
});
