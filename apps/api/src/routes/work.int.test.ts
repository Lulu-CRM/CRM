import { randomUUID } from 'node:crypto';
import {
  activitySchema,
  noteSchema,
  taskSchema,
  type Activity,
  type Note,
  type Task,
  type TimelineItem,
} from '@lulu/shared';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { activitiesRouter, eventsRouter } from './activities';
import { contactsRouter } from './contacts';
import { notesRouter } from './notes';
import { tasksRouter } from './tasks';

// Task 5: tasks, notes, activities, POST /events and the contact timeline.

const DAY_MS = 24 * 60 * 60 * 1000;
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
app.use('/contacts', contactsRouter);
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

const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

/** A workspace with an owner, a member and one contact, Sophie. */
async function workspace() {
  const ws = await db.workspace.create({ data: { name: `work-${randomUUID()}` } });
  workspaces.push(ws.id);
  const user = (role: 'owner' | 'member') =>
    db.user.create({
      data: { workspaceId: ws.id, name: role, email: `${role}-${randomUUID()}@example.test`, role },
    });
  const [owner, member] = [await user('owner'), await user('member')];
  const sophie = await db.contact.create({
    data: {
      workspaceId: ws.id,
      name: 'Sophie',
      email: 'sophie@northstar.studio',
      ownerId: owner.id,
      lastTouchAt: new Date(Date.now() - 10 * DAY_MS),
    },
  });
  const asOwner = () => (current = { workspaceId: ws.id, userId: owner.id, role: 'owner' });
  const asMember = () => (current = { workspaceId: ws.id, userId: member.id, role: 'member' });
  return { ws, owner, member, sophie, asOwner, asMember };
}

afterAll(async () => {
  const where = { workspaceId: { in: workspaces } };
  await db.activity.deleteMany({ where });
  await db.task.deleteMany({ where });
  await db.note.deleteMany({ where });
  await db.contact.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({ where: { id: { in: workspaces } } });
  await db.$disconnect();
});

describe('POST /events (int)', () => {
  it('shows a posted event on the contact timeline and moves lastTouchAt', async () => {
    const t = await workspace();
    t.asOwner();
    const occurredAt = new Date().toISOString();
    const posted = await request(app)
      .post('/events')
      .send({
        type: 'email.received',
        sourceModule: 'email',
        occurredAt,
        contact: { email: 'SOPHIE@northstar.studio' },
        summary: 'Reply received from Sophie Laurent',
        payload: { threadId: 't-1' },
      });
    expect(posted.status).toBe(201);
    const activity = activitySchema.parse(body<Activity>(posted));
    expect(activity).toMatchObject({
      type: 'email',
      sourceModule: 'email',
      recordType: 'contact',
      recordId: t.sophie.id,
      payload: { threadId: 't-1', event: 'email.received' },
    });

    const timeline = await request(app).get(`/contacts/${t.sophie.id}/timeline`);
    expect(timeline.status).toBe(200);
    const items = body<TimelineItem[]>(timeline);
    expect(items[0]).toMatchObject({ kind: 'activity', activity: { id: activity.id } });

    const contact = await db.contact.findUniqueOrThrow({ where: { id: t.sophie.id } });
    expect(contact.lastTouchAt?.toISOString()).toBe(occurredAt);
  });

  it('maps calendar and marketplace events, and never moves lastTouchAt back', async () => {
    const t = await workspace();
    t.asOwner();
    const send = (type: string, sourceModule: string, occurredAt: string) =>
      request(app)
        .post('/events')
        .send({
          type,
          sourceModule,
          occurredAt,
          contact: { email: 'sophie@northstar.studio' },
          summary: 'x',
        });
    const meeting = await send('calendar.booked', 'calendar', daysFromNow(-1));
    expect(body<Activity>(meeting).type).toBe('meeting');
    const order = await send('marketplace.order_placed', 'marketplace', daysFromNow(-30));
    expect(body<Activity>(order).type).toBe('marketplace');
    const contact = await db.contact.findUniqueOrThrow({ where: { id: t.sophie.id } });
    expect(contact.lastTouchAt?.toISOString().slice(0, 10)).toBe(daysFromNow(-1).slice(0, 10));
  });

  it('answers CONTACT_NOT_FOUND for an unknown email and 400 for a bad event', async () => {
    const t = await workspace();
    t.asOwner();
    const event = {
      type: 'email.received',
      sourceModule: 'email',
      occurredAt: new Date().toISOString(),
      contact: { email: 'nobody@example.test' },
      summary: 'x',
    };
    const unknown = await request(app).post('/events').send(event);
    expect(unknown.status).toBe(404);
    expect(errorCode(unknown)).toBe('CONTACT_NOT_FOUND');
    const bad = await request(app)
      .post('/events')
      .send({ ...event, type: 'crm.whatever' });
    expect(bad.status).toBe(400);
  });

  it('does not find a contact in another workspace', async () => {
    await workspace();
    const other = await workspace();
    await db.contact.deleteMany({ where: { workspaceId: other.ws.id } });
    other.asOwner();
    const response = await request(app)
      .post('/events')
      .send({
        type: 'email.received',
        sourceModule: 'email',
        occurredAt: new Date().toISOString(),
        contact: { email: 'sophie@northstar.studio' },
        summary: 'x',
      });
    expect(response.status).toBe(404);
  });
});

describe('Tasks API (int)', () => {
  it('creates, lists open tasks first by due date, and filters', async () => {
    const t = await workspace();
    t.asOwner();
    const create = async (input: Record<string, unknown>) => {
      const response = await request(app).post('/tasks').send(input);
      expect(response.status).toBe(201);
      return taskSchema.parse(body<Task>(response));
    };
    const later = await create({ title: 'Later', dueAt: daysFromNow(5) });
    const soon = await create({
      title: 'Soon',
      dueAt: daysFromNow(1),
      recordType: 'contact',
      recordId: t.sophie.id,
      priority: 'high',
    });
    const undated = await create({ title: 'Someday' });
    expect(soon).toMatchObject({ ownerId: t.owner.id, done: false, priority: 'high' });
    expect(undated.priority).toBe('normal');

    const all = await request(app).get('/tasks');
    expect(body<Task[]>(all).map((task) => task.id)).toEqual([soon.id, later.id, undated.id]);
    expect(meta(all).total).toBe(3);

    const forSophie = await request(app).get(`/tasks?recordType=contact&recordId=${t.sophie.id}`);
    expect(body<Task[]>(forSophie).map((task) => task.id)).toEqual([soon.id]);
    const due = await request(app).get(`/tasks?dueBefore=${encodeURIComponent(daysFromNow(2))}`);
    expect(body<Task[]>(due).map((task) => task.id)).toEqual([soon.id]);
  });

  it('ticking a task sets doneAt and logs a task activity; unticking clears it', async () => {
    const t = await workspace();
    t.asOwner();
    const task = body<Task>(
      await request(app)
        .post('/tasks')
        .send({ title: 'Call back', recordType: 'contact', recordId: t.sophie.id }),
    );
    const done = await request(app).patch(`/tasks/${task.id}`).send({ done: true });
    expect(done.status).toBe(200);
    expect(body<Task>(done).done).toBe(true);
    expect(body<Task>(done).doneAt).not.toBeNull();

    const activities = await request(app).get(
      `/activities?recordType=contact&recordId=${t.sophie.id}&type=task`,
    );
    expect(body<Activity[]>(activities)[0]!.payload).toEqual({
      taskId: task.id,
      action: 'completed',
    });

    // Sending done again changes nothing and logs nothing.
    await request(app).patch(`/tasks/${task.id}`).send({ done: true });
    const reopened = await request(app).patch(`/tasks/${task.id}`).send({ done: false });
    expect(body<Task>(reopened).doneAt).toBeNull();
    const after = await request(app).get('/activities?type=task');
    expect(body<Activity[]>(after).map((a) => a.payload.action)).toEqual(['reopened', 'completed']);

    // done=false lists open tasks only.
    await request(app).post('/tasks').send({ title: 'Other' });
    await request(app).patch(`/tasks/${task.id}`).send({ done: true });
    const open = await request(app).get('/tasks?done=false');
    expect(body<Task[]>(open).map((x) => x.title)).toEqual(['Other']);
  });

  it('logs an activity without a record for an unlinked task', async () => {
    const t = await workspace();
    t.asOwner();
    const task = body<Task>(await request(app).post('/tasks').send({ title: 'Loose' }));
    await request(app).patch(`/tasks/${task.id}`).send({ done: true });
    const activity = body<Activity[]>(await request(app).get('/activities'))[0]!;
    expect(activity).toMatchObject({ type: 'task', recordType: null, recordId: null });
  });

  it('rejects an unknown linked record, an unknown owner and a half link', async () => {
    const t = await workspace();
    t.asOwner();
    const missing = await request(app)
      .post('/tasks')
      .send({ title: 'x', recordType: 'deal', recordId: randomUUID() });
    expect(missing.status).toBe(422);
    expect(errorCode(missing)).toBe('RECORD_NOT_FOUND');
    const owner = await request(app).post('/tasks').send({ title: 'x', ownerId: randomUUID() });
    expect(owner.status).toBe(400);
    const half = await request(app).post('/tasks').send({ title: 'x', recordType: 'contact' });
    expect(half.status).toBe(400);
  });

  it('soft deletes; a member may edit but not delete', async () => {
    const t = await workspace();
    t.asMember();
    const task = body<Task>(await request(app).post('/tasks').send({ title: 'Mine' }));
    expect(task.ownerId).toBe(t.member.id);
    expect((await request(app).patch(`/tasks/${task.id}`).send({ title: 'Renamed' })).status).toBe(
      200,
    );
    expect((await request(app).delete(`/tasks/${task.id}`)).status).toBe(403);

    t.asOwner();
    expect((await request(app).delete(`/tasks/${task.id}`)).status).toBe(204);
    expect(body<Task[]>(await request(app).get('/tasks'))).toEqual([]);
    const row = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(row.deletedAt).not.toBeNull();
    const gone = await request(app).patch(`/tasks/${task.id}`).send({ title: 'x' });
    expect(gone.status).toBe(404);
    expect(errorCode(gone)).toBe('TASK_NOT_FOUND');
  });

  it('keeps workspaces apart', async () => {
    const a = await workspace();
    a.asOwner();
    const task = body<Task>(await request(app).post('/tasks').send({ title: 'A' }));
    const b = await workspace();
    b.asOwner();
    expect(body<Task[]>(await request(app).get('/tasks'))).toEqual([]);
    expect((await request(app).patch(`/tasks/${task.id}`).send({ done: true })).status).toBe(404);
    // A record of workspace A cannot be linked from workspace B.
    const link = await request(app)
      .post('/tasks')
      .send({ title: 'x', recordType: 'contact', recordId: a.sophie.id });
    expect(link.status).toBe(422);
  });
});

describe('Notes API (int)', () => {
  it('creates standalone and linked notes, newest edit first, with search', async () => {
    const t = await workspace();
    t.asOwner();
    const loose = await request(app).post('/notes').send({ title: 'Ideas', body: 'Pricing' });
    expect(loose.status).toBe(201);
    expect(noteSchema.parse(body<Note>(loose))).toMatchObject({
      authorId: t.owner.id,
      visibility: 'shared',
      recordType: null,
    });
    const linked = body<Note>(
      await request(app)
        .post('/notes')
        .send({ title: 'Call notes', recordType: 'contact', recordId: t.sophie.id }),
    );
    await request(app)
      .patch(`/notes/${body<Note>(loose).id}`)
      .send({ body: 'Pricing v2' });

    const all = await request(app).get('/notes');
    expect(body<Note[]>(all).map((n) => n.title)).toEqual(['Ideas', 'Call notes']);
    const found = await request(app).get('/notes?q=pricing');
    expect(body<Note[]>(found).map((n) => n.title)).toEqual(['Ideas']);
    const forSophie = await request(app).get(`/notes?recordType=contact&recordId=${t.sophie.id}`);
    expect(body<Note[]>(forSophie).map((n) => n.id)).toEqual([linked.id]);

    // Unlink with both fields null; a half link is refused.
    const unlinked = await request(app)
      .patch(`/notes/${linked.id}`)
      .send({ recordType: null, recordId: null });
    expect(body<Note>(unlinked).recordId).toBeNull();
    const half = await request(app).patch(`/notes/${linked.id}`).send({ recordType: 'contact' });
    expect(half.status).toBe(400);
  });

  it('keeps private notes for their author only, for every role', async () => {
    const t = await workspace();
    t.asMember();
    const secret = body<Note>(
      await request(app).post('/notes').send({
        title: 'Secret',
        visibility: 'private',
        recordType: 'contact',
        recordId: t.sophie.id,
      }),
    );
    expect(body<Note[]>(await request(app).get('/notes')).map((n) => n.id)).toEqual([secret.id]);

    t.asOwner();
    expect(body<Note[]>(await request(app).get('/notes'))).toEqual([]);
    expect(meta(await request(app).get('/notes')).total).toBe(0);
    const edit = await request(app).patch(`/notes/${secret.id}`).send({ title: 'x' });
    expect(edit.status).toBe(404);
    expect(errorCode(edit)).toBe('NOTE_NOT_FOUND');
    expect((await request(app).delete(`/notes/${secret.id}`)).status).toBe(404);
    const timeline = body<TimelineItem[]>(
      await request(app).get(`/contacts/${t.sophie.id}/timeline`),
    );
    expect(timeline.filter((item) => item.kind === 'note')).toEqual([]);
  });

  it('soft deletes; members cannot delete', async () => {
    const t = await workspace();
    t.asOwner();
    const note = body<Note>(await request(app).post('/notes').send({ title: 'Shared' }));
    t.asMember();
    expect((await request(app).delete(`/notes/${note.id}`)).status).toBe(403);
    t.asOwner();
    expect((await request(app).delete(`/notes/${note.id}`)).status).toBe(204);
    expect(body<Note[]>(await request(app).get('/notes'))).toEqual([]);
    expect((await db.note.findUniqueOrThrow({ where: { id: note.id } })).deletedAt).not.toBeNull();
  });

  it('rejects a link to a record that is not in the workspace', async () => {
    const t = await workspace();
    t.asOwner();
    const response = await request(app)
      .post('/notes')
      .send({ title: 'x', recordType: 'company', recordId: randomUUID() });
    expect(response.status).toBe(422);
    expect(errorCode(response)).toBe('RECORD_NOT_FOUND');
  });
});

describe('Activities API (int)', () => {
  it('logs an activity by hand, touches the contact, and lists newest first', async () => {
    const t = await workspace();
    t.asMember();
    const occurredAt = new Date().toISOString();
    const logged = await request(app)
      .post('/activities')
      .send({ type: 'meeting', recordType: 'contact', recordId: t.sophie.id, occurredAt });
    expect(logged.status).toBe(201);
    expect(body<Activity>(logged)).toMatchObject({
      actorId: t.member.id,
      sourceModule: 'crm',
      payload: {},
    });
    await request(app)
      .post('/activities')
      .send({
        type: 'email',
        recordType: 'contact',
        recordId: t.sophie.id,
        occurredAt: daysFromNow(-3),
      });

    const list = await request(app).get('/activities?pageSize=1');
    expect(body<Activity[]>(list).map((a) => a.type)).toEqual(['meeting']);
    expect(meta(list)).toEqual({ page: 1, pageSize: 1, total: 2 });
    const emails = await request(app).get('/activities?type=email');
    expect(body<Activity[]>(emails)).toHaveLength(1);

    const contact = await db.contact.findUniqueOrThrow({ where: { id: t.sophie.id } });
    expect(contact.lastTouchAt?.toISOString()).toBe(occurredAt);
  });

  it('rejects an unknown record', async () => {
    const t = await workspace();
    t.asOwner();
    const response = await request(app)
      .post('/activities')
      .send({ type: 'email', recordType: 'contact', recordId: randomUUID() });
    expect(response.status).toBe(422);
  });
});
