import { randomUUID } from 'node:crypto';
import {
  segmentListItemSchema,
  segmentSchema,
  type Contact,
  type Segment,
  type SegmentListItem,
} from '@lulu/shared';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { segmentsRouter } from './segments';

const DAY_MS = 24 * 60 * 60 * 1000;
const workspaces: string[] = [];
let current: RequestContext;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.ctx = current;
  next();
});
app.use('/segments', segmentsRouter);
app.use(errorHandler);

function body<T>(response: { body: unknown }): T {
  return (response.body as { data: T }).data;
}
function meta(response: { body: unknown }) {
  return (response.body as { meta: { page: number; pageSize: number; total: number } }).meta;
}
function errorCode(response: { body: unknown }): string {
  return (response.body as { error: { code: string } }).error.code;
}

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);
const newsletter = {
  match: 'all',
  conditions: [{ field: 'marketingConsent', op: 'is', value: true }],
};
const highIntent = {
  match: 'all',
  conditions: [
    { field: 'lifecycleStage', op: 'is', value: 'qualified' },
    { field: 'lastTouch', op: 'within_days', value: 14 },
  ],
};

/** A workspace with an owner, a member and 3 contacts: 2 opted in, 1 qualified and touched lately. */
async function workspace() {
  const ws = await db.workspace.create({ data: { name: `segments-${randomUUID()}` } });
  workspaces.push(ws.id);
  const user = (role: 'owner' | 'member') =>
    db.user.create({
      data: { workspaceId: ws.id, name: role, email: `${role}-${randomUUID()}@example.test`, role },
    });
  const [owner, member] = [await user('owner'), await user('member')];
  const contact = (name: string, extra: Record<string, unknown>) =>
    db.contact.create({ data: { workspaceId: ws.id, name, ownerId: owner.id, ...extra } });
  await contact('Ada', { marketingConsent: true, lastTouchAt: daysAgo(1) });
  await contact('Grace', { marketingConsent: true, lastTouchAt: daysAgo(5) });
  await contact('Linus', { lifecycleStage: 'qualified', lastTouchAt: daysAgo(2) });
  const asOwner = () => (current = { workspaceId: ws.id, userId: owner.id, role: 'owner' });
  const asMember = () => (current = { workspaceId: ws.id, userId: member.id, role: 'member' });
  return { ws, owner, asOwner, asMember };
}

async function create(name: string, rules: unknown, color?: string) {
  const response = await request(app)
    .post('/segments')
    .send({ name, rules, ...(color === undefined ? {} : { color }) });
  expect(response.status).toBe(201);
  return segmentSchema.parse(body<Segment>(response));
}

async function list() {
  const response = await request(app).get('/segments');
  expect(response.status).toBe(200);
  return body<SegmentListItem[]>(response).map((s) => segmentListItemSchema.parse(s));
}

afterAll(async () => {
  const where = { workspaceId: { in: workspaces } };
  await db.segment.deleteMany({ where });
  await db.contact.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({ where: { id: { in: workspaces } } });
  await db.$disconnect();
});

describe('Segments API (int)', () => {
  it('lists segments with live member counts', async () => {
    const t = await workspace();
    t.asOwner();
    await create('Newsletter', newsletter, 'mint');
    await create('High intent', highIntent);
    const segments = await list();
    expect(segments.map((s) => [s.name, s.color, s.memberCount])).toEqual([
      ['Newsletter', 'mint', 2],
      ['High intent', 'violet', 1],
    ]);
  });

  it('counts a matching contact as soon as it is added', async () => {
    const t = await workspace();
    t.asOwner();
    const segment = await create('Newsletter', newsletter);
    expect((await list())[0]!.memberCount).toBe(2);
    await db.contact.create({
      data: {
        workspaceId: t.ws.id,
        name: 'Katherine',
        ownerId: t.owner.id,
        marketingConsent: true,
      },
    });
    expect((await list())[0]!.memberCount).toBe(3);
    const contacts = await request(app).get(`/segments/${segment.id}/contacts`);
    expect(meta(contacts).total).toBe(3);
  });

  it('pages the members, most recently touched first', async () => {
    const t = await workspace();
    t.asOwner();
    const segment = await create('Newsletter', newsletter);
    const first = await request(app).get(`/segments/${segment.id}/contacts?page=1&pageSize=1`);
    expect(first.status).toBe(200);
    expect(body<Contact[]>(first).map((c) => c.name)).toEqual(['Ada']);
    expect(meta(first)).toEqual({ page: 1, pageSize: 1, total: 2 });
    const second = await request(app).get(`/segments/${segment.id}/contacts?page=2&pageSize=1`);
    expect(body<Contact[]>(second).map((c) => c.name)).toEqual(['Grace']);
  });

  it('updates and soft deletes a segment', async () => {
    const t = await workspace();
    t.asOwner();
    const segment = await create('Newsletter', newsletter);
    const updated = await request(app)
      .patch(`/segments/${segment.id}`)
      .send({ name: 'Hot leads', rules: highIntent, color: 'coral' });
    expect(updated.status).toBe(200);
    expect(body<Segment>(updated)).toMatchObject({ name: 'Hot leads', color: 'coral' });
    expect((await list())[0]!.memberCount).toBe(1);

    expect((await request(app).delete(`/segments/${segment.id}`)).status).toBe(204);
    expect(await list()).toEqual([]);
    const row = await db.segment.findUniqueOrThrow({ where: { id: segment.id } });
    expect(row.deletedAt).not.toBeNull();
    const gone = await request(app).get(`/segments/${segment.id}/contacts`);
    expect(gone.status).toBe(404);
    expect(errorCode(gone)).toBe('SEGMENT_NOT_FOUND');
  });

  it('rejects invalid rules', async () => {
    const t = await workspace();
    t.asOwner();
    const response = await request(app)
      .post('/segments')
      .send({ name: 'Bad', rules: { match: 'all', conditions: [{ field: 'nope', op: 'is' }] } });
    expect(response.status).toBe(400);
  });

  it('lets a member view but not change segments', async () => {
    const t = await workspace();
    t.asOwner();
    const segment = await create('Newsletter', newsletter);
    t.asMember();
    expect((await list())[0]!.memberCount).toBe(2);
    expect((await request(app).get(`/segments/${segment.id}/contacts`)).status).toBe(200);
    expect(
      (await request(app).post('/segments').send({ name: 'X', rules: newsletter })).status,
    ).toBe(403);
    expect((await request(app).patch(`/segments/${segment.id}`).send({ name: 'X' })).status).toBe(
      403,
    );
    expect((await request(app).delete(`/segments/${segment.id}`)).status).toBe(403);
  });

  it('keeps workspaces apart', async () => {
    const a = await workspace();
    a.asOwner();
    const segment = await create('Newsletter', newsletter);
    const b = await workspace();
    b.asOwner();
    expect(await list()).toEqual([]);
    expect((await request(app).get(`/segments/${segment.id}/contacts`)).status).toBe(404);
    expect((await request(app).patch(`/segments/${segment.id}`).send({ name: 'X' })).status).toBe(
      404,
    );
    expect((await request(app).delete(`/segments/${segment.id}`)).status).toBe(404);
  });
});
