import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { companiesRouter } from './companies';
import { contactsRouter } from './contacts';
import { dealsRouter } from './deals';

const STAGES = [
  ['new', 0.1, 'open'],
  ['qualified', 0.3, 'open'],
  ['proposal', 0.5, 'open'],
  ['negotiation', 0.75, 'open'],
  ['won', 1, 'won'],
  ['lost', 0, 'lost'],
] as const;

type StageKey = (typeof STAGES)[number][0];

interface Tenant {
  workspaceId: string;
  userId: string;
  otherUserId: string;
  stages: Record<StageKey, string>;
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

interface CompanyBody {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  ownerId: string;
  workspaceId: string;
  contactCount: number;
  openDealValue: { amount: number; currency: string };
  openDealCount: number;
  otherCurrencyDeals: number;
  lastTouchAt: string | null;
  health: 'strong' | 'watch' | 'new';
  contacts?: Array<{ id: string; lastTouchAt: string | null }>;
  deals?: Array<{ id: string; value: number }>;
}

interface ContactBody {
  id: string;
  lastTouchAt: string | null;
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

app.use('/companies', companiesRouter);
app.use('/contacts', contactsRouter);
app.use('/deals', dealsRouter);
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

  const pipeline = await db.pipeline.create({
    data: { workspaceId: workspace.id, key: 'sales', name: 'Sales', isDefault: true },
  });

  const stages = {} as Record<StageKey, string>;

  for (const [index, [key, probability, type]] of STAGES.entries()) {
    const stage = await db.stage.create({
      data: {
        workspaceId: workspace.id,
        pipelineId: pipeline.id,
        key,
        name: key,
        order: index,
        probability,
        type,
      },
    });
    stages[key] = stage.id;
  }

  const created: Tenant = {
    workspaceId: workspace.id,
    userId: user.id,
    otherUserId: otherUser.id,
    stages,
  };

  tenants.push(created);
  return created;
}

function as(t: Tenant): void {
  current = { workspaceId: t.workspaceId, userId: t.userId, role: 'owner' };
}

async function newCompany(t: Tenant, body: Record<string, unknown> = {}): Promise<CompanyBody> {
  as(t);
  const res = await request(app)
    .post('/companies')
    .send({ name: 'Company', ...body });
  expect(res.status).toBe(201);
  return responseBody<ApiEnvelope<CompanyBody>>(res).data;
}

async function newContact(t: Tenant, body: Record<string, unknown> = {}): Promise<ContactBody> {
  as(t);
  const res = await request(app)
    .post('/contacts')
    .send({ name: 'Contact', ...body });
  expect(res.status).toBe(201);
  return responseBody<ApiEnvelope<ContactBody>>(res).data;
}

async function newDeal(t: Tenant, body: Record<string, unknown> = {}): Promise<{ id: string }> {
  as(t);
  const res = await request(app)
    .post('/deals')
    .send({ name: 'Deal', value: 1000, stageId: t.stages.new, ...body });
  expect(res.status).toBe(201);
  return responseBody<ApiEnvelope<{ id: string }>>(res).data;
}

async function list(
  t: Tenant,
  query = '',
): Promise<{ items: CompanyBody[]; meta: { page: number; pageSize: number; total: number } }> {
  as(t);
  const res = await request(app).get(`/companies${query}`);
  expect(res.status).toBe(200);
  const body = responseBody<ApiEnvelope<CompanyBody[]>>(res);
  return { items: body.data, meta: body.meta! };
}

afterAll(async () => {
  const ids = tenants.map((t) => t.workspaceId);
  const where = { workspaceId: { in: ids } };

  await db.activity.deleteMany({ where });
  await db.deal.deleteMany({ where });
  await db.contact.deleteMany({ where });
  await db.company.deleteMany({ where });
  await db.stage.deleteMany({ where });
  await db.pipeline.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe('companies API (int)', () => {
  it('creates a company with computed defaults', async () => {
    const t = await tenant('create');
    const company = await newCompany(t, { name: 'Atlas Logistics', domain: 'AtlasLogistics.co' });

    expect(company).toMatchObject({
      name: 'Atlas Logistics',
      // The shared schema lowercases and validates the host.
      domain: 'atlaslogistics.co',
      industry: null,
      ownerId: t.userId,
      workspaceId: t.workspaceId,
      contactCount: 0,
      openDealValue: { amount: 0, currency: 'EUR' },
      openDealCount: 0,
      otherCurrencyDeals: 0,
      lastTouchAt: null,
      health: 'new',
    });
  });

  it('saves, edits and clears the lead and social fields (Oct 23, 2026)', async () => {
    const t = await tenant('extra-fields');
    const company = await newCompany(t, {
      name: 'Blue Harbor',
      leadStatus: 'qualified',
      whatsapp: '+49 151 000 111',
      instagram: '@blueharbor',
      facebook: 'facebook.com/blueharbor',
      productService: 'Boat rentals',
      aiNotes: 'Seasonal business, busy in summer.',
    });
    expect(company).toMatchObject({
      leadStatus: 'qualified',
      whatsapp: '+49 151 000 111',
      instagram: '@blueharbor',
      facebook: 'facebook.com/blueharbor',
      productService: 'Boat rentals',
      aiNotes: 'Seasonal business, busy in summer.',
    });

    as(t);
    const edited = await request(app)
      .patch(`/companies/${company.id}`)
      .send({ leadStatus: 'customer', instagram: null });
    expect(edited.status).toBe(200);
    expect(responseBody<{ data: Record<string, unknown> }>(edited).data).toMatchObject({
      leadStatus: 'customer',
      instagram: null,
      whatsapp: '+49 151 000 111',
    });

    const badStatus = await request(app)
      .post('/companies')
      .send({ name: 'Bad', leadStatus: 'hot' });
    expect(badStatus.status).toBe(400);
  });

  it('validates the domain, the size band and the owner', async () => {
    const t = await tenant('validation');

    as(t);

    const badDomain = await request(app)
      .post('/companies')
      .send({ name: 'Bad', domain: 'https://example.com/path' });

    expect(badDomain.status).toBe(400);
    expect(responseBody<ErrorEnvelope>(badDomain).error.code).toBe('VALIDATION_ERROR');

    const badSize = await request(app).post('/companies').send({ name: 'Bad', size: 'huge' });

    expect(badSize.status).toBe(400);

    const badOwner = await request(app)
      .post('/companies')
      .send({ name: 'Bad', ownerId: randomUUID() });

    expect(badOwner.status).toBe(400);
    expect(responseBody<ErrorEnvelope>(badOwner).error.code).toBe('VALIDATION_ERROR');
  });

  it('computes contact counts, open deal value and health', async () => {
    const t = await tenant('numbers');
    const company = await newCompany(t, { name: 'Northstar Studio' });

    const daniel = await newContact(t, { name: 'Daniel', companyId: company.id });
    const sophie = await newContact(t, { name: 'Sophie', companyId: company.id });

    const touch = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await db.contact.update({
      where: { id: daniel.id },
      data: { lastTouchAt: touch },
    });

    // An open deal in the workspace currency, and one in another currency.
    await newDeal(t, { companyId: company.id, value: 40000 });
    await newDeal(t, {
      companyId: company.id,
      value: 5000,
      currency: 'USD',
      stageId: t.stages.qualified,
    });
    // A deal past the first stage at 75% plus a recent touch: strong.
    await newDeal(t, { companyId: company.id, value: 2500, stageId: t.stages.negotiation });

    const [item] = (await list(t)).items;

    expect(item).toMatchObject({
      id: company.id,
      contactCount: 2,
      openDealValue: { amount: 42500, currency: 'EUR' },
      openDealCount: 3,
      otherCurrencyDeals: 1,
      health: 'strong',
    });
    expect(item?.lastTouchAt).not.toBeNull();

    // Sophia is never touched: lastTouchAt is the newest of the contacts that have one.
    await db.contact.update({ where: { id: sophie.id }, data: { lastTouchAt: null } });

    const [recomputed] = (await list(t)).items;
    expect(recomputed?.lastTouchAt).toBe(touch.toISOString());
  });

  it('filters by q, owner and industry, sorts and pages', async () => {
    const t = await tenant('list');
    const atlas = await newCompany(t, {
      name: 'Atlas Logistics',
      domain: 'atlaslogistics.co',
      industry: 'Logistics',
      ownerId: t.userId,
    });
    const haus = await newCompany(t, {
      name: 'Haus am Fluss',
      industry: 'Hospitality',
      ownerId: t.otherUserId,
    });
    await newCompany(t, { name: 'Klarwerk', industry: 'Manufacturing' });

    expect((await list(t, '?q=atlas')).items.map((c) => c.id)).toEqual([atlas.id]);
    expect((await list(t, '?q=hospitality')).items.map((c) => c.id)).toEqual([haus.id]);
    expect((await list(t, '?q=fluss')).items.map((c) => c.id)).toEqual([haus.id]);
    expect((await list(t, `?ownerId=${t.otherUserId}`)).items.map((c) => c.id)).toEqual([haus.id]);
    expect((await list(t, '?industry=Logistics')).items.map((c) => c.id)).toEqual([atlas.id]);
    expect((await list(t, '?health=new')).meta.total).toBe(3);
    expect((await list(t, '?health=strong')).meta.total).toBe(0);

    const byName = await list(t, '?sort=name');
    expect(byName.items.map((c) => c.name)).toEqual([
      'Atlas Logistics',
      'Haus am Fluss',
      'Klarwerk',
    ]);

    const page2 = await list(t, '?sort=name&pageSize=2&page=2');
    expect(page2.items.map((c) => c.name)).toEqual(['Klarwerk']);
    expect(page2.meta).toEqual({ page: 2, pageSize: 2, total: 3 });

    as(t);
    const bad = await request(app).get('/companies?sort=password');

    expect(bad.status).toBe(400);
    expect(responseBody<ErrorEnvelope>(bad).error.code).toBe('VALIDATION_ERROR');
  });

  it('sorts by open deal value descending by default', async () => {
    const t = await tenant('value-sort');
    const small = await newCompany(t, { name: 'Small Co' });
    const large = await newCompany(t, { name: 'Large Co' });

    await newDeal(t, { companyId: large.id, value: 50000 });
    await newDeal(t, { companyId: small.id, value: 100 });

    const { items } = await list(t);

    expect(items.map((c) => c.id)).toEqual([large.id, small.id]);
    expect((await list(t, '?sort=openDealValue')).items.map((c) => c.id)).toEqual([
      small.id,
      large.id,
    ]);
  });

  it('returns the detail with people and deals', async () => {
    const t = await tenant('detail');
    const company = await newCompany(t, { name: 'Detail Co' });

    const older = await newContact(t, { name: 'Older', companyId: company.id });
    const newer = await newContact(t, { name: 'Newer', companyId: company.id });

    await db.contact.update({
      where: { id: older.id },
      data: { lastTouchAt: new Date('2026-01-01T00:00:00.000Z') },
    });
    await db.contact.update({
      where: { id: newer.id },
      data: { lastTouchAt: new Date('2026-06-01T00:00:00.000Z') },
    });

    const deal = await newDeal(t, { companyId: company.id, value: 750 });

    as(t);
    const res = await request(app).get(`/companies/${company.id}`);

    expect(res.status).toBe(200);
    const detail = responseBody<ApiEnvelope<CompanyBody>>(res).data;

    expect(detail.contacts?.map((c) => c.id)).toEqual([newer.id, older.id]);
    expect(detail.deals?.map((d) => d.id)).toEqual([deal.id]);
    expect(detail.contactCount).toBe(2);
  });

  it('edits a company and returns the computed shape', async () => {
    const t = await tenant('patch');
    const company = await newCompany(t, { name: 'Before' });
    const contact = await newContact(t, { name: 'Person', companyId: company.id });

    as(t);
    const res = await request(app)
      .patch(`/companies/${company.id}`)
      .send({ name: 'After', industry: 'Design', ownerId: t.otherUserId });

    expect(res.status).toBe(200);

    const updated = responseBody<ApiEnvelope<CompanyBody>>(res).data;

    expect(updated).toMatchObject({
      name: 'After',
      industry: 'Design',
      ownerId: t.otherUserId,
      contactCount: 1,
      openDealValue: { amount: 0, currency: 'EUR' },
      health: 'new',
    });
    expect(contact.id).toBeDefined();
  });

  it('soft deletes a company and keeps the links on its contacts', async () => {
    const t = await tenant('delete');
    const company = await newCompany(t, { name: 'Doomed' });
    const contact = await newContact(t, { name: 'Keeps Link', companyId: company.id });

    as(t);
    expect((await request(app).delete(`/companies/${company.id}`)).status).toBe(204);
    expect((await request(app).get(`/companies/${company.id}`)).status).toBe(404);
    expect((await list(t)).meta.total).toBe(0);

    const companyRow = await db.company.findUnique({ where: { id: company.id } });
    expect(companyRow?.deletedAt).not.toBeNull();

    const contactRow = await db.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(contactRow.companyId).toBe(company.id);
  });

  it("never shows or changes another workspace's company", async () => {
    const a = await tenant('iso-a');
    const b = await tenant('iso-b');
    const company = await newCompany(a, { name: 'Secret' });

    as(b);

    expect((await request(app).get(`/companies/${company.id}`)).status).toBe(404);
    expect((await request(app).patch(`/companies/${company.id}`).send({ name: 'x' })).status).toBe(
      404,
    );
    expect((await request(app).delete(`/companies/${company.id}`)).status).toBe(404);
    expect((await list(b)).meta.total).toBe(0);

    const untouched = await db.company.findUniqueOrThrow({ where: { id: company.id } });

    expect(untouched.name).toBe('Secret');
    expect(untouched.deletedAt).toBeNull();
  });
});
