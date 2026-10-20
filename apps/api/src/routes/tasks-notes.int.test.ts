import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { activitiesRouter } from './activities';
import { notesRouter } from './notes';
import { tasksRouter } from './tasks';
import { eventsRouter } from './events';

const workspaces: string[] = [];
let current: RequestContext;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.ctx = current;
  next();
});
app.use('/tasks', tasksRouter);
app.use('/notes', notesRouter);
app.use('/activities', activitiesRouter);
app.use('/events', eventsRouter);
app.use(errorHandler);

const data = <T>(r: { body: unknown }) => (r.body as { data: T }).data;
const code = (r: { body: unknown }) => (r.body as { error: { code: string } }).error.code;

async function workspace() {
  const ws = await db.workspace.create({ data: { name: `tn-${randomUUID()}` } });
  workspaces.push(ws.id);
  const user = (role: 'owner' | 'member') =>
    db.user.create({
      data: { workspaceId: ws.id, name: role, email: `${role}-${randomUUID()}@example.test`, role },
    });
  const [owner, member] = [await user('owner'), await user('member')];
  const contact = await db.contact.create({
    data: { workspaceId: ws.id, name: 'Ada', ownerId: owner.id },
  });
  return {
    ws,
    owner,
    member,
    contact,
    asOwner: () => (current = { workspaceId: ws.id, userId: owner.id, role: 'owner' }),
    asMember: () => (current = { workspaceId: ws.id, userId: member.id, role: 'member' }),
  };
}

afterAll(async () => {
  const where = { workspaceId: { in: workspaces } };
  await db.activity.deleteMany({ where });
  await db.note.deleteMany({ where });
  await db.task.deleteMany({ where });
  await db.contact.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({ where: { id: { in: workspaces } } });
  await db.$disconnect();
});

describe('Tasks API (int)', () => {
  it('creates, filters, completes (with activity), reopens and soft deletes', async () => {
    const t = await workspace();
    t.asOwner();
    const link = { recordType: 'contact', recordId: t.contact.id };
    const res = await request(app).post('/tasks').send({ title: 'Call Ada', ...link });
    expect(res.status).toBe(201);
    const task = data<{ id: string; ownerId: string; done: boolean }>(res);
    expect(task.ownerId).toBe(t.owner.id);

    const open = await request(app).get(`/tasks?done=false&recordId=${t.contact.id}`);
    expect(data<unknown[]>(open)).toHaveLength(1);

    const done = await request(app).patch(`/tasks/${task.id}`).send({ done: true });
    expect(data<{ done: boolean; doneAt: string }>(done)).toMatchObject({ done: true });
    expect(data<{ doneAt: string }>(done).doneAt).toBeTruthy();

    const acts = await request(app).get(`/activities?recordId=${t.contact.id}&type=task`);
    expect(data<{ payload: unknown }[]>(acts).map((a) => a.payload)).toEqual([
      { taskId: task.id, action: 'completed' },
    ]);

    const reopened = await request(app).patch(`/tasks/${task.id}`).send({ done: false });
    expect(data<{ doneAt: unknown }>(reopened).doneAt).toBeNull();

    expect((await request(app).delete(`/tasks/${task.id}`)).status).toBe(204);
    const gone = await request(app).patch(`/tasks/${task.id}`).send({ title: 'x' });
    expect(gone.status).toBe(404);
    expect(code(gone)).toBe('TASK_NOT_FOUND');
  });

  it('rejects a link to a record that is not in the workspace', async () => {
    const a = await workspace();
    const b = await workspace();
    b.asOwner();
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'x', recordType: 'contact', recordId: a.contact.id });
    expect(res.status).toBe(404);
    expect(code(res)).toBe('RECORD_NOT_FOUND');
  });

  it('pages and keeps workspaces apart', async () => {
    const a = await workspace();
    a.asOwner();
    for (const title of ['A', 'B', 'C']) await request(app).post('/tasks').send({ title });
    const page = await request(app).get('/tasks?page=2&pageSize=2');
    expect((page.body as { meta: unknown }).meta).toEqual({ page: 2, pageSize: 2, total: 3 });
    const b = await workspace();
    b.asOwner();
    expect(data<unknown[]>(await request(app).get('/tasks'))).toEqual([]);
  });
});

describe('Notes API (int)', () => {
  it('hides private notes from other users, for every role', async () => {
    const t = await workspace();
    t.asMember();
    const priv = await request(app)
      .post('/notes')
      .send({ title: 'Secret', visibility: 'private', recordType: 'contact', recordId: t.contact.id });
    expect(priv.status).toBe(201);
    const id = data<{ id: string }>(priv).id;

    t.asOwner();
    expect(data<unknown[]>(await request(app).get('/notes'))).toEqual([]);
    const patch = await request(app).patch(`/notes/${id}`).send({ title: 'x' });
    expect(patch.status).toBe(404);
    expect(code(patch)).toBe('NOTE_NOT_FOUND');
    expect((await request(app).delete(`/notes/${id}`)).status).toBe(404);

    t.asMember();
    expect(data<unknown[]>(await request(app).get('/notes'))).toHaveLength(1);
  });

  it('searches title and body, and rejects a half link', async () => {
    const t = await workspace();
    t.asOwner();
    await request(app).post('/notes').send({ title: 'Budget', body: 'needs APPROVAL' });
    expect(data<unknown[]>(await request(app).get('/notes?q=approval'))).toHaveLength(1);
    const half = await request(app).post('/notes').send({ title: 'x', recordType: 'contact' });
    expect(half.status).toBe(400);
  });
});

describe('Activities API (int)', () => {
  it('logs an activity by hand and lists newest first', async () => {
    const t = await workspace();
    t.asOwner();
    const link = { recordType: 'contact', recordId: t.contact.id };
    await request(app).post('/activities').send({ type: 'meeting', occurredAt: '2026-10-01T10:00:00Z', ...link });
    await request(app).post('/activities').send({ type: 'email', occurredAt: '2026-10-02T10:00:00Z', ...link });
    const list = await request(app).get(`/activities?recordId=${t.contact.id}`);
    expect(data<{ type: string }[]>(list).map((a) => a.type)).toEqual(['email', 'meeting']);
  });
});

describe('Contract details (int)', () => {
  it('logs an activity when an unlinked task is completed', async () => {
    const t = await workspace();
    t.asOwner();
    const task = data<{ id: string }>(await request(app).post('/tasks').send({ title: 'Loose' }));
    await request(app).patch(`/tasks/${task.id}`).send({ done: true });
    const acts = await db.activity.findMany({ where: { workspaceId: t.ws.id, type: 'task' } });
    expect(acts).toHaveLength(1);
    expect(acts[0]!.recordId).toBeNull();
  });

  it('answers RECORD_NOT_FOUND for an owner outside the workspace', async () => {
    const a = await workspace();
    const b = await workspace();
    b.asOwner();
    const res = await request(app).post('/tasks').send({ title: 'x', ownerId: a.owner.id });
    expect(res.status).toBe(404);
    expect(code(res)).toBe('RECORD_NOT_FOUND');
  });

  it('creates an unlinked note and unlinks a linked one', async () => {
    const t = await workspace();
    t.asOwner();
    const linked = await request(app)
      .post('/notes')
      .send({ title: 'N', recordType: 'contact', recordId: t.contact.id });
    const id = data<{ id: string }>(linked).id;
    const res = await request(app).patch(`/notes/${id}`).send({ recordType: null, recordId: null });
    expect(data<{ recordType: unknown }>(res).recordType).toBeNull();
  });

  it('records a module event on the contact and updates lastTouchAt', async () => {
    const t = await workspace();
    t.asOwner();
    await db.contact.update({ where: { id: t.contact.id }, data: { email: 'Ada@Example.test' } });
    const res = await request(app).post('/events').send({
      type: 'email.received',
      sourceModule: 'email',
      occurredAt: '2026-10-17T09:42:00Z',
      contact: { email: 'ada@example.test' },
      summary: 'Reply received',
    });
    expect(res.status).toBe(201);
    const contact = await db.contact.findUniqueOrThrow({ where: { id: t.contact.id } });
    expect(contact.lastTouchAt?.toISOString()).toBe('2026-10-17T09:42:00.000Z');
    const acts = await request(app).get(`/activities?recordId=${t.contact.id}&type=email`);
    expect(data<unknown[]>(acts)).toHaveLength(1);
  });

  it('answers CONTACT_NOT_FOUND for an unknown email', async () => {
    const t = await workspace();
    t.asOwner();
    const res = await request(app).post('/events').send({
      type: 'email.received',
      sourceModule: 'email',
      occurredAt: '2026-10-17T09:42:00Z',
      contact: { email: 'nobody@example.test' },
      summary: 'x',
    });
    expect(res.status).toBe(404);
    expect(code(res)).toBe('CONTACT_NOT_FOUND');
  });
});